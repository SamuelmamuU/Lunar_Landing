"""Descarga idempotente de kernels SPICE desde NAIF y generación de `meta.tm`."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import yaml
from tenacity import (
    Retrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    wait_none,
)

from app.core.logging import get_logger

logger = get_logger(__name__)

SOURCES_YAML_PATH = Path(__file__).resolve().parent / "sources.yaml"
KERNEL_LOAD_ORDER = (
    "lsk",
    "pck_text",
    "spk_planets",
    "pck_moon",
    "fk_moon",
    "fk_moon_assoc",
)
_CHUNK_SIZE = 1_048_576
_SPICE_STR_CHUNK = 70


class IncompleteDownloadError(httpx.HTTPError):
    """Error lanzado cuando la descarga termina con menos bytes de los esperados."""


def load_sources_config(sources_path: Path | None = None) -> dict[str, Any]:
    """Carga y devuelve el contenido YAML de `sources.yaml`."""
    path = sources_path or SOURCES_YAML_PATH
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise ValueError(f"Configuración inválida en {path}")
    return loaded


def compute_sha256(file_path: Path) -> str:
    """Calcula el digest SHA-256 hexadecimal en bloques para archivos arbitrarios."""
    hasher = hashlib.sha256()
    with file_path.open("rb") as fh:
        while chunk := fh.read(_CHUNK_SIZE):
            hasher.update(chunk)
    return hasher.hexdigest()


def _utc_now_z() -> str:
    return datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def select_latest_fk_moon(
    client: httpx.Client,
    base_url: str,
    dir_path: str,
    pattern: str,
    fallback: str,
) -> str:
    """Consulta el índice HTTP de NAIF y elige el kernel `moon_de440_YYMMDD.tf` más reciente."""
    clean_base = base_url.rstrip("/")
    clean_dir = dir_path.strip("/")
    listing_url = f"{clean_base}/{clean_dir}/"
    regex = re.compile(pattern)

    try:
        response = client.get(listing_url, timeout=30.0)
        response.raise_for_status()
        candidates: set[str] = set()
        for href in re.findall(r'href=["\']([^"\']+)["\']', response.text):
            name = href.rstrip("/").rsplit("/", 1)[-1]
            if regex.fullmatch(name):
                candidates.add(name)

        if not candidates:
            for token in re.findall(r"[A-Za-z0-9_.-]+\.tf", response.text):
                if regex.fullmatch(token):
                    candidates.add(token)

        if not candidates:
            logger.warning(
                "fk_moon_no_matches_fallback",
                listing_url=listing_url,
                pattern=pattern,
                fallback=fallback,
            )
            return fallback

        def _sort_key(filename: str) -> tuple[int, str]:
            match = re.search(r"(\d{6})", filename)
            return (int(match.group(1)) if match else -1, filename)

        latest = max(candidates, key=_sort_key)
        return f"{clean_dir}/{latest}"
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning(
            "fk_moon_listing_error_fallback",
            listing_url=listing_url,
            fallback=fallback,
            error=str(exc),
        )
        return fallback


def download_file_atomic(
    client: httpx.Client,
    url: str,
    dest_path: Path,
    version: str = "1",
    *,
    retry_wait_base: float = 0.5,
    timeout_s: float = 120.0,
) -> dict[str, Any]:
    """Descarga `url` hacia `dest_path` de forma idempotente, con reintentos y escritura `.part`."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = dest_path.with_name(dest_path.name + ".part")

    expected_head_len: int | None = None
    try:
        head_resp = client.head(url, timeout=30.0, follow_redirects=True)
        if head_resp.status_code < 400:
            raw_len = head_resp.headers.get("Content-Length")
            if raw_len is not None and raw_len.isdigit():
                expected_head_len = int(raw_len)
    except httpx.HTTPError as exc:
        logger.warning("head_request_failed", url=url, error=str(exc))

    if (
        expected_head_len is not None
        and expected_head_len > 0
        and dest_path.exists()
        and dest_path.stat().st_size == expected_head_len
    ):
        sha = compute_sha256(dest_path)
        logger.info("download_skipped_idempotent", file=dest_path.name, bytes=expected_head_len)
        return {
            "file": dest_path.name,
            "url": url,
            "sha256": sha,
            "bytes": expected_head_len,
            "downloaded_utc": _utc_now_z(),
            "version": version,
        }

    wait_strategy = (
        wait_exponential(multiplier=retry_wait_base, min=retry_wait_base, max=16 * retry_wait_base)
        if retry_wait_base > 0
        else wait_none()
    )

    retrier = Retrying(
        stop=stop_after_attempt(5),
        wait=wait_strategy,
        retry=retry_if_exception_type((httpx.HTTPError, OSError, IncompleteDownloadError)),
        reraise=True,
    )

    digest = ""
    received = 0
    for attempt in retrier:
        with attempt:
            if part_path.exists():
                part_path.unlink()
            hasher = hashlib.sha256()
            received = 0
            try:
                with client.stream("GET", url, timeout=timeout_s, follow_redirects=True) as resp:
                    resp.raise_for_status()
                    raw_get_len = resp.headers.get("Content-Length")
                    expected_len = (
                        int(raw_get_len)
                        if raw_get_len is not None and raw_get_len.isdigit()
                        else expected_head_len
                    )
                    with part_path.open("wb") as fh:
                        for chunk in resp.iter_bytes(chunk_size=_CHUNK_SIZE):
                            if not chunk:
                                continue
                            fh.write(chunk)
                            hasher.update(chunk)
                            received += len(chunk)
                    if expected_len is not None and received != expected_len:
                        raise IncompleteDownloadError(
                            f"Descarga incompleta de {url}: {received} != {expected_len}"
                        )
                part_path.replace(dest_path)
                digest = hasher.hexdigest()
            except Exception:
                if part_path.exists():
                    part_path.unlink()
                raise

    return {
        "file": dest_path.name,
        "url": url,
        "sha256": digest,
        "bytes": received,
        "downloaded_utc": _utc_now_z(),
        "version": version,
    }


def _format_spice_path_value(posix_path: str) -> str:
    """Formatea `PATH_VALUES` respetando el límite de línea (~70 chars) y continuación `+` SPICE."""
    if len(posix_path) <= _SPICE_STR_CHUNK:
        return f"'{posix_path}'"
    chunks = [
        posix_path[i : i + _SPICE_STR_CHUNK] for i in range(0, len(posix_path), _SPICE_STR_CHUNK)
    ]
    lines: list[str] = []
    for idx, chunk in enumerate(chunks):
        suffix = "+" if idx < len(chunks) - 1 else ""
        if idx == 0:
            lines.append(f"'{chunk}{suffix}'")
        else:
            lines.append(f"                 '{chunk}{suffix}'")
    return "\n".join(lines)


def generate_meta_tm(kernels_dir: Path, ordered_kernel_filenames: list[str]) -> Path:
    """Genera `data/kernels/meta.tm` con `PATH_VALUES` absoluto y orden explícito de carga."""
    kernels_dir.mkdir(parents=True, exist_ok=True)
    abs_posix = kernels_dir.resolve().as_posix()
    path_value_block = _format_spice_path_value(abs_posix)

    kernels_lines = "\n".join(f"  '$K/{name}'" for name in ordered_kernel_filenames)
    content = (
        "KPL/MK\n\n"
        "Meta-kernel generado automáticamente por lunar-backend/pipeline.\n\n"
        "\\begindata\n"
        f"PATH_VALUES  = ( {path_value_block} )\n"
        "PATH_SYMBOLS = ( 'K' )\n"
        "KERNELS_TO_LOAD = (\n"
        f"{kernels_lines}\n"
        ")\n"
        "\\begintext\n"
    )
    meta_path = kernels_dir / "meta.tm"
    meta_path.write_text(content, encoding="utf-8")
    return meta_path


def update_manifest(
    manifest_path: Path,
    *,
    kernel_entries: list[dict[str, Any]] | None = None,
    dem_entry: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Actualiza de forma atómica `data/manifest.json` preservando secciones existentes."""
    existing: dict[str, Any] = {}
    if manifest_path.exists():
        try:
            loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                existing = loaded
        except (OSError, ValueError):
            existing = {}

    kernels_list = (
        kernel_entries
        if kernel_entries is not None
        else [item for item in existing.get("kernels", []) if isinstance(item, dict)]
    )
    dem_obj = dem_entry if dem_entry is not None else existing.get("dem")

    all_files: list[dict[str, Any]] = list(kernels_list)
    if isinstance(dem_obj, dict):
        all_files.append(dem_obj)

    payload: dict[str, Any] = {
        "version": "1.0",
        "generated_utc": _utc_now_z(),
        "kernels": kernels_list,
        "dem": dem_obj,
        "files": all_files,
    }

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = manifest_path.with_name(manifest_path.name + ".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp_path.replace(manifest_path)
    return payload


def _extract_kernel_version(filename: str) -> str:
    return filename.rsplit(".", 1)[0]


def download_kernels(
    kernels_dir: Path,
    manifest_path: Path,
    sources_path: Path | None = None,
    *,
    client: httpx.Client | None = None,
    retry_wait_base: float = 0.5,
) -> list[dict[str, Any]]:
    """Descarga los 6 kernels SPICE de NAIF, genera `meta.tm` y actualiza `manifest.json`."""
    cfg = load_sources_config(sources_path)
    naif_base = str(cfg["naif_base"]).rstrip("/")
    specs = cfg["kernels"]

    owns_client = client is None
    active_client = client or httpx.Client(follow_redirects=True)

    try:
        entries_by_id: dict[str, dict[str, Any]] = {}
        for spec in specs:
            kernel_id = str(spec["id"])
            if "path" in spec:
                rel_path = str(spec["path"]).lstrip("/")
            else:
                rel_path = select_latest_fk_moon(
                    client=active_client,
                    base_url=naif_base,
                    dir_path=str(spec["dir"]),
                    pattern=str(spec["pattern"]),
                    fallback=str(spec["fallback"]),
                ).lstrip("/")

            url = f"{naif_base}/{rel_path}"
            filename = rel_path.rsplit("/", 1)[-1]
            dest_path = kernels_dir / filename
            entry = download_file_atomic(
                client=active_client,
                url=url,
                dest_path=dest_path,
                version=_extract_kernel_version(filename),
                retry_wait_base=retry_wait_base,
            )
            entries_by_id[kernel_id] = entry

        ordered_entries = [
            entries_by_id[k_id] for k_id in KERNEL_LOAD_ORDER if k_id in entries_by_id
        ]
        for k_id, entry in entries_by_id.items():
            if k_id not in KERNEL_LOAD_ORDER:
                ordered_entries.append(entry)

        ordered_filenames = [str(entry["file"]) for entry in ordered_entries]
        generate_meta_tm(kernels_dir, ordered_filenames)
        update_manifest(manifest_path, kernel_entries=ordered_entries)
        return ordered_entries
    finally:
        if owns_client:
            active_client.close()
