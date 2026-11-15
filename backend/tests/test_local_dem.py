"""Pruebas para la grilla local DEM 64x64 incluida en horizon.local_dem."""
import math

from fastapi.testclient import TestClient

from api import app
from lunar.horizon import mask_for, sphere_mask
from lunar.sites import get_site


def _assert_valid_patch(patch: dict, expected_size: int = 64) -> None:
    assert patch is not None
    assert patch["size"] == expected_size
    assert patch["extent_m"] == 16000.0
    assert patch["step_m"] > 0
    heights = patch["heights_m"]
    assert len(heights) == expected_size
    assert all(len(row) == expected_size for row in heights)
    flat = [v for row in heights for v in row]
    assert all(isinstance(v, (int, float)) and math.isfinite(v) for v in flat)
    assert patch["min_z_m"] <= patch["center_z_m"] <= patch["max_z_m"]
    assert abs(patch["min_z_m"] - min(min(flat), patch["center_z_m"])) < 0.05
    assert abs(patch["max_z_m"] - max(max(flat), patch["center_z_m"])) < 0.05


def test_local_dem_sitio_polo_sur_y_coordenada_libre():
    shack = mask_for(get_site("mons-mouton-im2"), compute=True)
    assert shack.terrain is True
    _assert_valid_patch(shack.local_dem)
    summary = shack.summary(include_profile=True)
    assert summary["local_dem"] is not None
    assert summary["local_dem"]["size"] == 64

    custom = mask_for(get_site(lat=-85.4, lon=31.2), compute=True)
    assert custom.terrain is True
    _assert_valid_patch(custom.local_dem)

    # Cerca del borde 80S: debe rellenar NaN marginales sin fallar
    border = mask_for(get_site(lat=-80.05, lon=15.0), compute=True)
    assert border.terrain is True
    _assert_valid_patch(border.local_dem)


def test_local_dem_sitio_catalogo_fuera_de_cobertura_dem():
    apollo = mask_for(get_site("apollo14"), compute=True)
    assert apollo.terrain is True
    _assert_valid_patch(apollo.local_dem)


def test_sphere_mask_sin_local_dem():
    m = sphere_mask()
    assert m.terrain is False
    assert m.local_dem is None
    assert m.summary(include_profile=True)["local_dem"] is None


def test_evaluate_endpoint_incluye_local_dem_y_vectores_3d():
    with TestClient(app) as client:
        res = client.post(
            "/api/evaluate",
            json={
                "site_id": "mons-mouton-im2",
                "start": "2025-03-06T17:29:00Z",
                "end": "2025-03-07T05:29:00Z",
                "step_min": 60,
                "include_series": True,
            },
        )
    assert res.status_code == 200
    body = res.json()
    _assert_valid_patch(body["horizon"]["local_dem"])
    v3d = body["at_start"]["vectors_3d"]
    assert v3d["frame"] == "MOON_ME"
    assert len(v3d["positions_km"]["site"]) == 3
    assert len(v3d["unit_directions"]["sun"]) == 3
    assert len(v3d["unit_directions"]["earth"]) == 3
    assert len(body["series"]["sun_interference"]) == body["series"]["count"]
    assert len(body["series"]["earth_interference"]) == body["series"]["count"]
