"""Verificación de integridad de kernels SPICE, DEM LOLA y `manifest.json`."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import spiceypy

from app.core.constants import MOON_FRAME
from app.core.logging import get_logger
from pipeline.download_dem import validate_dem_file

logger = get_logger(__name__)

_REQUIRED_MANIFEST_KEYS = {"file", "url", "sha256", "bytes", "downloaded_utc", "version"}


def _parse_meta_kernel_paths(meta_kernel: Path) -> tuple[Path, list[str]]:
    """Extrae `PATH_VALUES` y `KERNELS_TO_LOAD` desde un archivo `meta.tm`."""
    text = meta_kernel.read_text(encoding="utf-8")
    # Une continuaciones de cadenas SPICE `'chunk+' \n 'next'`
    joined = re.sub(r"\+'\s*\n\s*'", "", text)

    path_match = re.search(r"PATH_VALUES\s*=\s*\(\s*'([^']+)'\s*\)", joined)
    base_dir = Path(path_match.group(1)) if path_match else meta_kernel.parent

    kernels_block_match = re.search(r"KERNELS_TO_LOAD\s*=\s*\((.*?)\)", joined, re.DOTALL)
    names: list[str] = []
    if kernels_block_match:
        for entry in re.findall(r"'([^']+)'", kernels_block_match.group(1)):
            names.append(entry.replace("$K/", "").lstrip("/"))
    return base_dir, names


def verify_spice_kernels(meta_kernel: Path) -> dict[str, Any]:
    """Verifica existencia de kernels, carga SPICE y prueba de humo Tierra-Luna."""
    if not meta_kernel.exists():
        raise RuntimeError(f"Meta-kernel SPICE no encontrado: {meta_kernel}")

    base_dir, kernel_names = _parse_meta_kernel_paths(meta_kernel)
    if len(kernel_names) < 6:
        raise RuntimeError(
            f"El meta-kernel '{meta_kernel}' declara menos de 6 kernels: {kernel_names}"
        )

    for name in kernel_names:
        candidate = base_dir / name
        if not candidate.exists():
            raise RuntimeError(f"Falta el archivo de kernel SPICE requerido: {candidate}")

    spiceypy.kclear()
    try:
        spiceypy.furnsh(str(meta_kernel))
        et = float(spiceypy.str2et("2026-01-01T00:00:00"))
        pos, _ = spiceypy.spkpos("EARTH", et, MOON_FRAME, "NONE", "MOON")
        dist_km = float(np.linalg.norm(np.asarray(pos, dtype=np.float64)))
        if not (356_000.0 <= dist_km <= 407_000.0):
            raise RuntimeError(
                f"Prueba de humo Tierra-Luna fuera de rango físico [356000, 407000] km: "
                f"{dist_km:.2f} km"
            )
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            f"Error cargando o consultando SPICE con '{meta_kernel}': {exc}"
        ) from exc
    finally:
        spiceypy.kclear()

    return {"kernels_count": len(kernel_names), "smoke_earth_moon_km": round(dist_km, 3)}


def verify_dem_file(dem_path: Path, *, min_extent_km: float | None = None) -> dict[str, Any]:
    """Valida integridad, proyección, pixel y altura polar del DEM LOLA."""
    return validate_dem_file(dem_path, min_extent_km=min_extent_km)


def verify_manifest(manifest_path: Path) -> dict[str, Any]:
    """Valida que `manifest.json` cumple el esquema requerido."""
    if not manifest_path.exists():
        raise RuntimeError(f"Manifest no encontrado: {manifest_path}")

    try:
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RuntimeError(f"Error leyendo manifest '{manifest_path}': {exc}") from exc

    if not isinstance(raw, dict):
        raise RuntimeError(f"Estructura inválida en manifest '{manifest_path}'")

    entries = raw.get("files")
    if not isinstance(entries, list) or not entries:
        raise RuntimeError(f"El manifest '{manifest_path}' no contiene entradas en 'files'")

    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise RuntimeError(f"Entrada #{idx} inválida en manifest")
        missing = _REQUIRED_MANIFEST_KEYS - set(entry.keys())
        if missing:
            raise RuntimeError(f"Entrada '{entry.get('file')}' sin claves: {sorted(missing)}")
        if not re.fullmatch(r"[0-9a-f]{64}", str(entry["sha256"])):
            raise RuntimeError(f"SHA-256 inválido en manifest para '{entry['file']}'")
        if int(entry["bytes"]) <= 0:
            raise RuntimeError(f"Tamaño en bytes inválido en manifest para '{entry['file']}'")
        downloaded = str(entry["downloaded_utc"])
        if not downloaded.endswith("Z"):
            raise RuntimeError(f"Fecha sin sufijo Z en manifest para '{entry['file']}'")
        datetime.fromisoformat(downloaded.replace("Z", "+00:00"))

    return raw


def verify_all(
    meta_kernel: Path,
    dem_path: Path,
    manifest_path: Path,
) -> dict[str, Any]:
    """Ejecuta verificación completa de kernels SPICE, DEM y `manifest.json`."""
    errors: list[str] = []
    report: dict[str, Any] = {}

    dem_mode = "full"
    try:
        manifest = verify_manifest(manifest_path)
        report["manifest_files"] = len(manifest["files"])
        dem_section = manifest.get("dem")
        if isinstance(dem_section, dict) and isinstance(dem_section.get("mode"), str):
            dem_mode = dem_section["mode"]
    except RuntimeError as exc:
        errors.append(str(exc))

    try:
        report["spice"] = verify_spice_kernels(meta_kernel)
    except RuntimeError as exc:
        errors.append(str(exc))

    min_extent = 300.0 if dem_mode == "full" else None
    try:
        report["dem"] = verify_dem_file(dem_path, min_extent_km=min_extent)
    except RuntimeError as exc:
        errors.append(str(exc))

    if errors:
        raise RuntimeError(" | ".join(errors))

    logger.info("verify_data_ok", report=report)
    return report
