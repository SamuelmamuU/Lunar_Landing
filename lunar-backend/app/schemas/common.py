"""Modelos base y esquemas compartidos (errores RFC 7807 y /health)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    """Modelo base estricto que prohíbe campos adicionales no declarados."""

    model_config = ConfigDict(extra="forbid")


class ProblemDetails(StrictModel):
    """Respuesta de error estructurada conforme a RFC 7807."""

    type: str
    title: str
    status: int
    detail: str
    instance: str
    request_id: str


class DemHealthInfo(StrictModel):
    """Metadatos del DEM activo reportados por /health."""

    file: str
    pixel_m: float
    sha256_prefix: str
    mode: str


class TimeCoverageInfo(StrictModel):
    """Cobertura temporal válida de las efemérides en UTC ISO-8601."""

    min_utc: str
    max_utc: str


class HealthDataInfo(StrictModel):
    """Inventario resumido de datos cargados por el servicio."""

    kernels: list[str]
    dem: DemHealthInfo | None = None
    time_coverage: TimeCoverageInfo


class HealthResponse(StrictModel):
    """Respuesta de `GET /api/v1/health`."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "status": "ok",
                "version": "1.0.0",
                "data": {
                    "kernels": [
                        "naif0012.tls",
                        "pck00011.tpc",
                        "de440s.bsp",
                        "moon_pa_de440_200625.bpc",
                        "moon_de440_250416.tf",
                        "moon_assoc_me.tf",
                    ],
                    "dem": {
                        "file": "LDEM_80S_20MPP_ADJ.TIF",
                        "pixel_m": 20.0,
                        "sha256_prefix": "a1b2c3d4e5f6",
                        "mode": "window",
                    },
                    "time_coverage": {
                        "min_utc": "2000-01-01T00:00:00Z",
                        "max_utc": "2100-01-01T00:00:00Z",
                    },
                },
            }
        },
    )

    status: Literal["ok"]
    version: str
    data: HealthDataInfo
