"""Esquemas Pydantic del catálogo de sitios lunares."""

from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import StrictModel

SiteCategory = Literal[
    "artemis_iii_candidate",
    "historic_apollo",
    "commercial_clps",
    "international_lander",
    "polar_reference",
]


class SiteItem(StrictModel):
    """Definición validada de un sitio lunar o región de interés."""

    id: str = Field(..., pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str = Field(..., min_length=1)
    category: SiteCategory
    tags: list[str] = Field(default_factory=list)
    lat_deg: float = Field(..., ge=-90.0, le=90.0)
    lon_deg: float = Field(..., ge=-180.0, le=180.0)
    x_m: float | None = None
    y_m: float | None = None
    in_dem: bool = False
    region_size_km: float | None = Field(default=None, gt=0.0)
    description: str = Field(..., min_length=1)
    source_url: str | None = None
    verified: bool = False

    @model_validator(mode="after")
    def _validate_verified_source(self) -> "SiteItem":
        if self.verified and (not self.source_url or not self.source_url.startswith("https://")):
            raise ValueError(
                f"El sitio '{self.id}' está marcado verified=True pero carece de source_url https://"
            )
        return self


class SitesCatalog(StrictModel):
    """Catálogo completo de sitios lunares (`data/sites/sites.json`)."""

    version: str = Field(..., min_length=1)
    sites: list[SiteItem]

    @model_validator(mode="after")
    def _validate_unique_ids(self) -> "SitesCatalog":
        seen: set[str] = set()
        duplicates: list[str] = []
        for site in self.sites:
            if site.id in seen:
                duplicates.append(site.id)
            seen.add(site.id)
        if duplicates:
            raise ValueError(f"Identificadores de sitio duplicados en sites.json: {duplicates}")
        return self
