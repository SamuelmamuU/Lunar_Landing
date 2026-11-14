"""Construcción, proyección y validación del catálogo de sitios lunares."""

from __future__ import annotations

import json
from pathlib import Path

import rasterio
from pyproj import Transformer

from app.core.constants import MOON_LONGLAT_PROJ, MOON_SP_STERE_PROJ
from app.core.logging import get_logger
from app.schemas.sites import SiteItem, SitesCatalog

logger = get_logger(__name__)

_DEFAULT_DEM_HALF_EXTENT_M = 304_000.0


def _dem_bounds(dem_path: Path | None) -> tuple[float, float, float, float] | None:
    if dem_path is None or not dem_path.exists():
        return None
    try:
        with rasterio.open(dem_path) as ds:
            bounds = ds.bounds
            return (
                float(bounds.left),
                float(bounds.bottom),
                float(bounds.right),
                float(bounds.top),
            )
    except Exception as exc:
        logger.warning("sites_dem_bounds_unreadable", dem_path=str(dem_path), error=str(exc))
        return None


def build_sites(
    sites_path: Path,
    *,
    dem_path: Path | None = None,
    write: bool = True,
) -> SitesCatalog:
    """Completa `x_m`/`y_m` e `in_dem` en `sites.json` y valida contra `SitesCatalog`."""
    raw = json.loads(sites_path.read_text(encoding="utf-8"))
    catalog = SitesCatalog.model_validate(raw)

    transformer = Transformer.from_crs(MOON_LONGLAT_PROJ, MOON_SP_STERE_PROJ, always_xy=True)
    bounds = _dem_bounds(dem_path)

    updated_sites: list[SiteItem] = []
    for site in catalog.sites:
        x_val, y_val = transformer.transform(site.lon_deg, site.lat_deg)
        x_m = round(float(x_val), 2)
        y_m = round(float(y_val), 2)

        if bounds is not None and (bounds[2] - bounds[0]) >= 600_000.0:
            left, bottom, right, top = bounds
            in_dem = (left <= x_m <= right) and (bottom <= y_m <= top)
        else:
            in_dem = (
                site.lat_deg <= -80.0
                and abs(x_m) <= _DEFAULT_DEM_HALF_EXTENT_M
                and abs(y_m) <= _DEFAULT_DEM_HALF_EXTENT_M
            )

        updated_sites.append(site.model_copy(update={"x_m": x_m, "y_m": y_m, "in_dem": in_dem}))

    result = SitesCatalog(version=catalog.version, sites=updated_sites)
    if write:
        tmp_path = sites_path.with_name(sites_path.name + ".tmp")
        tmp_path.write_text(
            json.dumps(result.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        tmp_path.replace(sites_path)

    logger.info("sites_catalog_validated", total=len(result.sites), path=str(sites_path))
    return result
