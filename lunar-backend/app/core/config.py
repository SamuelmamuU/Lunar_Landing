"""Configuración de la aplicación mediante variables de entorno (pydantic-settings)."""

import json
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from pydantic import AwareDatetime, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración tipada del servicio cargada desde entorno y `.env`."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = "dev"
    app_version: str = "1.0.0"

    data_dir: Path = Path("./data")
    meta_kernel: Path = Path("./data/kernels/meta.tm")
    dem_path: Path = Path("./data/dem/LDEM_80S_20MPP_ADJ.TIF")
    dem_hires_path: Path | None = None
    sites_path: Path = Path("./data/sites/sites.json")
    manifest_path: Path = Path("./data/manifest.json")
    horizon_cache_dir: Path = Path("./data/cache/horizons")

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    date_min: AwareDatetime = datetime(2000, 1, 1, 0, 0, 0, tzinfo=UTC)
    date_max: AwareDatetime = datetime(2100, 1, 1, 0, 0, 0, tzinfo=UTC)

    max_duration_days: int = Field(default=60, ge=1, le=366)
    sync_max_samples: int = Field(default=20_000, ge=1)
    job_max_samples: int = Field(default=200_000, ge=1)
    compare_max_scenarios: int = Field(default=10, ge=1, le=50)
    max_request_body_bytes: int = Field(default=65_536, ge=1024)

    default_observer_height_m: float = Field(default=2.0, ge=0.0, le=100.0)
    default_az_step_deg: float = Field(default=0.25, ge=0.05, le=2.0)
    default_max_distance_km: float = Field(default=150.0, ge=1.0, le=300.0)
    sun_fraction_threshold: float = Field(default=0.0, ge=0.0, lt=1.0)
    earth_margin_deg: float = Field(default=0.0, ge=-5.0, le=10.0)

    viability_power_good_pct: float = Field(default=70.0, ge=0.0, le=100.0)
    viability_power_limited_pct: float = Field(default=40.0, ge=0.0, le=100.0)
    viability_comm_good_pct: float = Field(default=70.0, ge=0.0, le=100.0)
    viability_comm_limited_pct: float = Field(default=30.0, ge=0.0, le=100.0)

    workers: int = Field(default=2, ge=1)
    log_level: str = "INFO"
    redis_url: str = ""
    data_required: bool = False

    @field_validator("dem_hires_path", mode="before")
    @classmethod
    def _empty_str_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                parsed = json.loads(raw)
                return [str(item).strip() for item in parsed if str(item).strip()]
            return [part.strip() for part in raw.split(",") if part.strip()]
        raise ValueError("cors_origins debe ser una lista o una cadena separada por comas")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Devuelve la instancia cacheada de configuración."""
    return Settings()
