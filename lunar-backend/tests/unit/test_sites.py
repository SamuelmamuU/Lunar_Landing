"""Pruebas unitarias del catálogo de sitios lunares (`sites.json` y `build_sites.py`)."""

import json
import re
from pathlib import Path

from app.schemas.sites import SitesCatalog
from pipeline.build_sites import build_sites

ROOT_DIR = Path(__file__).resolve().parents[2]
REAL_SITES_PATH = ROOT_DIR / "data" / "sites" / "sites.json"


def test_UT_SITE_01_sites_json_validates_schema() -> None:
    """UT-SITE-01: sites.json real valida contra el esquema Pydantic, IDs únicos en kebab-case."""
    raw = json.loads(REAL_SITES_PATH.read_text(encoding="utf-8"))
    catalog = SitesCatalog.model_validate(raw)

    assert len(catalog.sites) >= 20
    ids = [site.id for site in catalog.sites]
    assert len(ids) == len(set(ids))
    for site_id in ids:
        assert re.fullmatch(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", site_id), site_id


def test_UT_SITE_02_contains_9_artemis_iii_regions() -> None:
    """UT-SITE-02: sites.json contiene exactamente las 9 regiones candidatas de Artemis III."""
    raw = json.loads(REAL_SITES_PATH.read_text(encoding="utf-8"))
    catalog = SitesCatalog.model_validate(raw)

    expected_names = {
        "Peak near Cabeus B",
        "Haworth",
        "Malapert Massif",
        "Mons Mouton Plateau",
        "Mons Mouton",
        "Nobile Rim 1",
        "Nobile Rim 2",
        "de Gerlache Rim 2",
        "Slater Plain",
    }
    artemis_names = {
        site.name for site in catalog.sites if site.category == "artemis_iii_candidate"
    }
    assert artemis_names == expected_names


def test_UT_SITE_03_build_sites_computes_xy_and_in_dem(tmp_path: Path) -> None:
    """UT-SITE-03: build_sites completa x_m/y_m desde lat/lon y marca in_dem correctamente."""
    sample_catalog = {
        "version": "2026-11-14",
        "sites": [
            {
                "id": "polar-test",
                "name": "Polar Test -85",
                "category": "polar_reference",
                "tags": ["south_pole"],
                "lat_deg": -85.0,
                "lon_deg": 0.0,
                "x_m": None,
                "y_m": None,
                "in_dem": False,
                "region_size_km": 10.0,
                "description": "Sitio polar de prueba.",
                "source_url": "https://pgda.gsfc.nasa.gov/products/78",
                "verified": True,
            },
            {
                "id": "apollo-11",
                "name": "Apollo 11",
                "category": "historic_apollo",
                "tags": ["apollo"],
                "lat_deg": 0.67416,
                "lon_deg": 23.47314,
                "x_m": None,
                "y_m": None,
                "in_dem": True,
                "region_size_km": 1.0,
                "description": "Mare Tranquillitatis.",
                "source_url": "https://www.lroc.asu.edu/",
                "verified": True,
            },
        ],
    }
    sites_file = tmp_path / "sites.json"
    sites_file.write_text(json.dumps(sample_catalog), encoding="utf-8")

    catalog = build_sites(sites_file)
    by_id = {site.id: site for site in catalog.sites}

    polar = by_id["polar-test"]
    assert polar.x_m is not None
    assert polar.y_m is not None
    assert abs(polar.x_m) < 1e-3
    assert abs(polar.y_m) > 100_000.0
    assert polar.in_dem is True

    apollo = by_id["apollo-11"]
    assert apollo.x_m is not None
    assert apollo.y_m is not None
    assert apollo.in_dem is False


def test_UT_SITE_04_verified_sites_have_https_source_url() -> None:
    """UT-SITE-04: todo sitio con verified=True tiene source_url que empieza con https://."""
    raw = json.loads(REAL_SITES_PATH.read_text(encoding="utf-8"))
    catalog = SitesCatalog.model_validate(raw)

    for site in catalog.sites:
        if site.verified:
            assert site.source_url is not None
            assert site.source_url.startswith("https://")


def test_sites_schema_validation_errors_and_dem_bounds(tmp_path: Path) -> None:
    """Valida errores del esquema `SitesCatalog` y detección real con `dem_path`."""
    import numpy as np
    import pytest

    from app.schemas.sites import SiteItem
    from tests.conftest import make_dem

    with pytest.raises(ValueError, match="https://"):
        SiteItem(
            id="bad-site",
            name="Bad Site",
            category="polar_reference",
            tags=["test"],
            lat_deg=-89.0,
            lon_deg=0.0,
            description="No https",
            source_url="http://insecure.example.com",
            verified=True,
        )

    site_payload = {
        "id": "dup-site",
        "name": "Dup",
        "category": "polar_reference",
        "tags": ["test"],
        "lat_deg": -90.0,
        "lon_deg": 0.0,
        "description": "Duplicado",
        "source_url": "https://pgda.gsfc.nasa.gov/products/78",
        "verified": True,
    }
    with pytest.raises(ValueError, match="duplicados"):
        SitesCatalog(
            version="2026-11-14",
            sites=[SiteItem.model_validate(site_payload), SiteItem.model_validate(site_payload)],
        )

    dem_center = make_dem(
        tmp_path / "center.tif",
        np.zeros((100, 100), dtype=np.float32),
        x_center=0.0,
        y_center=0.0,
    )
    sites_file = tmp_path / "sites.json"
    sites_file.write_text(
        json.dumps({"version": "2026-11-14", "sites": [site_payload]}),
        encoding="utf-8",
    )
    catalog = build_sites(sites_file, dem_path=dem_center, write=False)
    assert catalog.sites[0].in_dem is True
