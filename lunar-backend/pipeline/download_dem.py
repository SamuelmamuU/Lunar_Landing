"""Descarga y extracción de ventanas del DEM LOLA (modos `full` y `window`)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, cast

import httpx
import numpy as np
import rasterio
from pyproj import CRS
from rasterio.errors import RasterioIOError
from rasterio.transform import Affine
from rasterio.windows import Window, from_bounds
from tenacity import Retrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.constants import MOON_SP_STERE_PROJ
from app.core.logging import get_logger
from app.schemas.sites import SitesCatalog
from pipeline.download_kernels import (
    _utc_now_z,
    compute_sha256,
    download_file_atomic,
    load_sources_config,
    update_manifest,
)

logger = get_logger(__name__)

MOON_STERE_CRS = CRS.from_proj4(MOON_SP_STERE_PROJ)


def validate_or_assign_dem_crs(dem_path: Path) -> bool:
    """Verifica el CRS del DEM; si falta, asigna `MOON_SP_STERE_PROJ` y registra advertencia."""
    with rasterio.open(dem_path, "r") as ds:
        has_crs = ds.crs is not None and bool(ds.crs.to_wkt())

    if has_crs:
        return True

    logger.warning(
        "dem_crs_missing_assigned_default",
        dem_path=str(dem_path),
        assigned_crs=MOON_SP_STERE_PROJ,
    )
    with rasterio.open(dem_path, "r+") as ds_rw:
        ds_rw.crs = MOON_STERE_CRS
    return False


def _validate_height_array(data: np.ndarray, nodata: float | None) -> None:
    arr = data.astype(np.float64, copy=False)
    valid_mask = np.isfinite(arr)
    if nodata is not None and not np.isnan(nodata):
        valid_mask &= arr != nodata
    if not np.any(valid_mask):
        raise RuntimeError("El DEM no contiene píxeles válidos finitos en la muestra verificada.")
    valid_vals = arr[valid_mask]
    min_h = float(np.min(valid_vals))
    max_h = float(np.max(valid_vals))
    if min_h < -10_000.0 or max_h > 10_000.0:
        raise RuntimeError(
            f"Alturas del DEM fuera de rango físico [-10000, 10000] m: [{min_h:.1f}, {max_h:.1f}]"
        )


def validate_dem_file(dem_path: Path, *, min_extent_km: float | None = None) -> dict[str, Any]:
    """Valida que el GeoTIFF DEM abre, tiene proyección, pixel ~20 m y alturas físicas."""
    if not dem_path.exists():
        raise RuntimeError(f"Archivo DEM no encontrado: {dem_path}")

    try:
        with rasterio.open(dem_path) as ds:
            if ds.crs is None:
                raise RuntimeError(f"El DEM '{dem_path}' carece de CRS.")

            res_x, res_y = ds.res
            if abs(res_x - 20.0) > 1.0 or abs(res_y - 20.0) > 1.0:
                raise RuntimeError(
                    f"Tamaño de píxel inesperado en DEM '{dem_path}': {res_x:.3f} x {res_y:.3f} m"
                )

            bounds = ds.bounds
            if min_extent_km is not None:
                req_m = min_extent_km * 1000.0
                if (
                    bounds.left > -req_m
                    or bounds.right < req_m
                    or bounds.bottom > -req_m
                    or bounds.top < req_m
                ):
                    raise RuntimeError(
                        f"Cobertura insuficiente del DEM '{dem_path}': {bounds}, "
                        f"se requiere al menos ±{min_extent_km} km"
                    )

            # Verifica que el polo sur (0, 0) si está dentro del DEM tenga altura finita
            if bounds.left <= 0.0 <= bounds.right and bounds.bottom <= 0.0 <= bounds.top:
                row, col = ds.index(0.0, 0.0)
                if 0 <= row < ds.height and 0 <= col < ds.width:
                    pole_val = float(ds.read(1, window=Window(col, row, 1, 1))[0, 0])
                    if not np.isfinite(pole_val) or (
                        ds.nodata is not None and pole_val == ds.nodata
                    ):
                        raise RuntimeError("El píxel del polo (0, 0) en el DEM no es finito.")

            # Muestrea ventana central de hasta 512x512 para validar rango de alturas
            sample_w = min(512, ds.width)
            sample_h = min(512, ds.height)
            col_off = max(0, (ds.width - sample_w) // 2)
            row_off = max(0, (ds.height - sample_h) // 2)
            sample = ds.read(1, window=Window(col_off, row_off, sample_w, sample_h))
            _validate_height_array(sample, ds.nodata)

            return {
                "width": ds.width,
                "height": ds.height,
                "pixel_m": float(res_x),
                "bounds": [bounds.left, bounds.bottom, bounds.right, bounds.top],
                "crs": ds.crs.to_string(),
            }
    except RasterioIOError as exc:
        raise RuntimeError(f"Error al abrir o leer el DEM '{dem_path}': {exc}") from exc


def _read_window_with_retry(
    src: rasterio.DatasetReader, source: str | Path, win: Window
) -> np.ndarray:
    """Lee una ventana del DEM reintentando errores transitorios sin depender de caché dañada."""
    retrier = Retrying(
        stop=stop_after_attempt(6),
        wait=wait_exponential(multiplier=1.0, min=1.0, max=16.0),
        retry=retry_if_exception_type(RasterioIOError),
        reraise=True,
    )
    for attempt in retrier:
        with attempt:
            if attempt.retry_state.attempt_number == 1:
                return cast(np.ndarray, src.read(1, window=win))
            with (
                rasterio.Env(CPL_VSIL_CURL_NON_CACHED=str(source)),
                rasterio.open(str(source)) as fresh_src,
            ):
                return cast(np.ndarray, fresh_src.read(1, window=win))
    raise RuntimeError("No se pudo leer la ventana del DEM tras múltiples reintentos.")


def extract_dem_window(
    source: str | Path,
    output_path: Path,
    x_center: float,
    y_center: float,
    radius_km: float,
    *,
    compress: str = "DEFLATE",
    chunk_px: int = 1024,
) -> Path:
    """Extrae una ventana cuadrada `[±radius_km]` desde `source` (`/vsicurl/` o local)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = output_path.with_name(output_path.name + ".part")
    if part_path.exists():
        part_path.unlink()

    radius_m = float(radius_km) * 1000.0
    gdal_env = {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".TIF,.tif",
        "CPL_VSIL_CURL_CHUNK_SIZE": "2097152",
        "GDAL_HTTP_MULTIRANGE": "SERIAL",
        "GDAL_HTTP_MAX_RETRY": "6",
        "GDAL_HTTP_RETRY_DELAY": "2",
        "GDAL_HTTP_TIMEOUT": "120",
        "VSI_CACHE": "FALSE",
    }

    try:
        with rasterio.Env(**gdal_env), rasterio.open(str(source)) as src:
            active_crs = src.crs
            if active_crs is None or not active_crs.to_wkt():
                logger.warning(
                    "source_dem_crs_missing_using_default",
                    source=str(source),
                    assigned_crs=MOON_SP_STERE_PROJ,
                )
                active_crs = MOON_STERE_CRS

            raw_win = from_bounds(
                x_center - radius_m,
                y_center - radius_m,
                x_center + radius_m,
                y_center + radius_m,
                src.transform,
            )
            rounded = raw_win.round_offsets().round_lengths()
            col_off = max(0, int(rounded.col_off))
            row_off = max(0, int(rounded.row_off))
            width = min(src.width - col_off, max(1, int(rounded.width)))
            height = min(src.height - row_off, max(1, int(rounded.height)))
            clamped = Window(col_off, row_off, width, height)
            out_transform: Affine = src.window_transform(clamped)

            profile: dict[str, Any] = {
                "driver": "GTiff",
                "height": height,
                "width": width,
                "count": 1,
                "dtype": src.dtypes[0],
                "crs": active_crs,
                "transform": out_transform,
                "compress": compress,
            }
            if src.nodata is not None:
                profile["nodata"] = src.nodata
            if width >= 256 and height >= 256:
                profile["tiled"] = True
                profile["blockxsize"] = 256
                profile["blockysize"] = 256

            has_valid_data = False
            with rasterio.open(part_path, "w", **profile) as dst:
                total_blocks = ((height + chunk_px - 1) // chunk_px) * (
                    (width + chunk_px - 1) // chunk_px
                )
                done_blocks = 0
                for y in range(0, height, chunk_px):
                    bh = min(chunk_px, height - y)
                    for x in range(0, width, chunk_px):
                        bw = min(chunk_px, width - x)
                        src_win = Window(col_off + x, row_off + y, bw, bh)
                        dst_win = Window(x, y, bw, bh)
                        chunk = _read_window_with_retry(src, source, src_win)
                        if not has_valid_data:
                            arr = chunk.astype(np.float64, copy=False)
                            mask = np.isfinite(arr)
                            if src.nodata is not None and not np.isnan(src.nodata):
                                mask &= arr != src.nodata
                            if np.any(mask):
                                has_valid_data = True
                        dst.write(chunk, 1, window=dst_win)
                        done_blocks += 1
                        if total_blocks > 1:
                            logger.info(
                                "dem_window_chunk",
                                done=done_blocks,
                                total=total_blocks,
                            )

            if not has_valid_data:
                raise RuntimeError("El recorte del DEM no contiene píxeles válidos finitos.")

        part_path.replace(output_path)
        return output_path
    except Exception:
        if part_path.exists():
            part_path.unlink()
        raise


def _resolve_window_center(sites_path: Path | None) -> tuple[float, float]:
    """Determina `(x_center, y_center)` para extracción en modo `window`."""
    if sites_path is None or not sites_path.exists():
        return (0.0, 0.0)
    raw = json.loads(sites_path.read_text(encoding="utf-8"))
    catalog = SitesCatalog.model_validate(raw)
    in_dem_sites = [
        s for s in catalog.sites if s.in_dem and s.x_m is not None and s.y_m is not None
    ]
    if len(in_dem_sites) == 1:
        site = in_dem_sites[0]
        assert site.x_m is not None
        assert site.y_m is not None
        return (site.x_m, site.y_m)
    return (0.0, 0.0)


def download_dem(
    dem_path: Path,
    manifest_path: Path,
    *,
    mode: str = "window",
    sites_path: Path | None = None,
    radius_km: float = 150.0,
    sources_path: Path | None = None,
    source_override: str | Path | None = None,
    per_site_dir: Path | None = None,
    client: httpx.Client | None = None,
    retry_wait_base: float = 0.5,
) -> dict[str, Any]:
    """Descarga o recorta el DEM LOLA en modo `full` o `window` y actualiza `manifest.json`."""
    if mode not in {"full", "window"}:
        raise ValueError(f"Modo de DEM inválido: {mode!r}. Use 'full' o 'window'.")

    cfg = load_sources_config(sources_path)
    dem_cfg = cfg["dem"]
    dem_base = str(dem_cfg["base"]).rstrip("/")
    primary_name = str(dem_cfg["primary"][0])
    remote_url = f"{dem_base}/{primary_name}"

    if mode == "full":
        if source_override is not None:
            src_path = Path(source_override)
            dem_path.parent.mkdir(parents=True, exist_ok=True)
            part_path = dem_path.with_name(dem_path.name + ".part")
            shutil.copyfile(src_path, part_path)
            part_path.replace(dem_path)
            dem_entry: dict[str, Any] = {
                "file": dem_path.name,
                "url": remote_url,
                "sha256": compute_sha256(dem_path),
                "bytes": dem_path.stat().st_size,
                "downloaded_utc": _utc_now_z(),
                "version": "LOLA_20mpp",
            }
        else:
            owns_client = client is None
            active_client = client or httpx.Client(follow_redirects=True)
            try:
                dem_entry = download_file_atomic(
                    client=active_client,
                    url=remote_url,
                    dest_path=dem_path,
                    version="LOLA_20mpp",
                    retry_wait_base=retry_wait_base,
                    timeout_s=600.0,
                )
            finally:
                if owns_client:
                    active_client.close()
        min_req_extent: float | None = 300.0
    else:
        source_uri = (
            str(source_override) if source_override is not None else f"/vsicurl/{remote_url}"
        )
        x_center, y_center = _resolve_window_center(sites_path)
        extract_dem_window(source_uri, dem_path, x_center, y_center, radius_km)

        if per_site_dir is not None and sites_path is not None and sites_path.exists():
            raw = json.loads(sites_path.read_text(encoding="utf-8"))
            catalog = SitesCatalog.model_validate(raw)
            for site in catalog.sites:
                if site.in_dem and site.x_m is not None and site.y_m is not None:
                    site_rad = max(float(site.region_size_km or 15.0), min(radius_km, 50.0))
                    extract_dem_window(
                        source_uri,
                        per_site_dir / f"{site.id}.tif",
                        site.x_m,
                        site.y_m,
                        site_rad,
                    )

        dem_entry = {
            "file": dem_path.name,
            "url": remote_url,
            "sha256": compute_sha256(dem_path),
            "bytes": dem_path.stat().st_size,
            "downloaded_utc": _utc_now_z(),
            "version": "LOLA_20mpp",
        }
        min_req_extent = None

    validate_or_assign_dem_crs(dem_path)
    dem_meta = validate_dem_file(dem_path, min_extent_km=min_req_extent)
    dem_entry["pixel_m"] = dem_meta["pixel_m"]
    dem_entry["mode"] = mode

    update_manifest(manifest_path, dem_entry=dem_entry)
    return dem_entry
