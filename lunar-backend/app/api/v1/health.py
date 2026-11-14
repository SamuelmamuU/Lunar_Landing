"""Endpoint de salud y disponibilidad de datos (`/api/v1/health`)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DataStatus, get_data_status, get_settings_dep
from app.core.config import Settings
from app.core.errors import DataNotReadyError
from app.schemas.common import (
    HealthDataInfo,
    HealthResponse,
    ProblemDetails,
    TimeCoverageInfo,
)

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Estado del servicio y cobertura de datos",
    responses={
        503: {
            "model": ProblemDetails,
            "description": "Datos científicos (kernels SPICE o DEM) no disponibles",
        }
    },
)
async def health_check(
    settings: Annotated[Settings, Depends(get_settings_dep)],
    data_status: Annotated[DataStatus, Depends(get_data_status)],
) -> HealthResponse:
    """Devuelve el estado de salud del servicio y los metadatos de datos cargados."""
    if not data_status.ready:
        raise DataNotReadyError(data_status.reason or "Los datos requeridos no están disponibles.")

    return HealthResponse(
        status="ok",
        version=settings.app_version,
        data=HealthDataInfo(
            kernels=data_status.kernels,
            dem=data_status.dem,
            time_coverage=TimeCoverageInfo(
                min_utc=data_status.min_utc,
                max_utc=data_status.max_utc,
            ),
        ),
    )
