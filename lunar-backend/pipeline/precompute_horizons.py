"""Precálculo en lote de máscaras de horizonte para sitios cubiertos por el DEM."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.core.logging import get_logger
from app.schemas.sites import SitesCatalog

logger = get_logger(__name__)


def precompute_horizons(
    sites_path: Path,
    dem_path: Path,
    cache_dir: Path,
    *,
    observer_height_m: float = 2.0,
    az_step_deg: float = 0.25,
    max_distance_km: float = 150.0,
) -> int:
    """Precalcula y guarda `.npz` de horizonte para todos los sitios con `in_dem=True`."""
    if not sites_path.exists():
        raise RuntimeError(f"Catálogo de sitios no encontrado: {sites_path}")
    if not dem_path.exists():
        raise RuntimeError(f"Archivo DEM no encontrado para precálculo: {dem_path}")

    raw = json.loads(sites_path.read_text(encoding="utf-8"))
    catalog = SitesCatalog.model_validate(raw)
    targets = [s for s in catalog.sites if s.in_dem and s.x_m is not None and s.y_m is not None]

    try:
        from app.services import horizon as horizon_mod
        from app.services import terrain as terrain_mod
    except ImportError as exc:
        logger.warning("precompute_services_unavailable", error=str(exc))
        return 0

    compute_fn: Any = getattr(horizon_mod, "HorizonService", None)
    terrain_cls: Any = getattr(terrain_mod, "TerrainService", None)
    if compute_fn is None or terrain_cls is None:
        logger.info(
            "precompute_horizons_pending_phase3",
            eligible_sites=len(targets),
            cache_dir=str(cache_dir),
        )
        return 0

    cache_dir.mkdir(parents=True, exist_ok=True)
    terrain_svc = terrain_cls(dem_path)
    horizon_svc = compute_fn(terrain_svc, cache_dir=cache_dir)
    count = 0
    for site in targets:
        assert site.x_m is not None
        assert site.y_m is not None
        horizon_svc.get_horizon_mask(
            x_m=site.x_m,
            y_m=site.y_m,
            observer_height_m=observer_height_m,
            az_step_deg=az_step_deg,
            max_distance_km=max_distance_km,
        )
        count += 1
    logger.info("precompute_horizons_done", count=count, cache_dir=str(cache_dir))
    return count
