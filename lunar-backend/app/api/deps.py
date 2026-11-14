"""Inyección de dependencias para los routers de la API v1."""

import json
from dataclasses import dataclass, field
from typing import Annotated

from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.core.timeutils import format_utc_z
from app.schemas.common import DemHealthInfo


@dataclass(slots=True)
class DataStatus:
    """Estado de disponibilidad y metadatos de los datos científicos."""

    ready: bool
    reason: str | None = None
    kernels: list[str] = field(default_factory=list)
    dem: DemHealthInfo | None = None
    min_utc: str = "2000-01-01T00:00:00Z"
    max_utc: str = "2100-01-01T00:00:00Z"


def get_settings_dep() -> Settings:
    """Provee la configuración de la aplicación."""
    return get_settings()


def build_default_data_status(settings: Settings) -> DataStatus:
    """Evalúa el estado inicial de kernels/DEM a partir de la configuración y manifest."""
    min_utc = format_utc_z(settings.date_min)
    max_utc = format_utc_z(settings.date_max)

    kernels: list[str] = []
    dem_info: DemHealthInfo | None = None
    if settings.manifest_path.exists():
        try:
            raw = json.loads(settings.manifest_path.read_text(encoding="utf-8"))
            for item in raw.get("kernels", []):
                if isinstance(item, dict) and isinstance(item.get("file"), str):
                    kernels.append(item["file"])
            dem_entry = raw.get("dem")
            if isinstance(dem_entry, dict) and isinstance(dem_entry.get("file"), str):
                sha = str(dem_entry.get("sha256", ""))
                dem_info = DemHealthInfo(
                    file=dem_entry["file"],
                    pixel_m=float(dem_entry.get("pixel_m", 20.0)),
                    sha256_prefix=sha[:12],
                    mode=str(dem_entry.get("mode", "window")),
                )
        except (OSError, ValueError, TypeError):
            pass

    if settings.data_required and (
        not settings.meta_kernel.exists() or not settings.dem_path.exists()
    ):
        return DataStatus(
            ready=False,
            reason="Faltan kernels SPICE o el archivo DEM en el directorio de datos.",
            kernels=kernels,
            dem=dem_info,
            min_utc=min_utc,
            max_utc=max_utc,
        )

    return DataStatus(
        ready=True,
        kernels=kernels,
        dem=dem_info,
        min_utc=min_utc,
        max_utc=max_utc,
    )


def get_data_status(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> DataStatus:
    """Obtiene el estado actual de los datos desde `app.state` o configuración."""
    cached = getattr(request.app.state, "data_status", None)
    if isinstance(cached, DataStatus):
        return cached
    return build_default_data_status(settings)
