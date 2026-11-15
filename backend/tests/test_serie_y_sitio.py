"""Slice B4: `earth_frac` en la serie y `site_id` gana si también llegan `x`/`y`."""
import pytest
from fastapi.testclient import TestClient

from api import app

IM2 = {"id": "mons-mouton-im2", "lat": -84.7906, "lon": 29.1957}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_earth_frac_en_la_serie(client):
    """30 días en IM-2: la Tierra sale y se pone, así que hay valores de 0, 1 e intermedios posibles."""
    d = client.post("/api/evaluate", json={"site_id": IM2["id"], "start": "2025-03-06T17:29:00Z",
                                           "end": "2025-04-05T17:29:00Z", "step_min": 60,
                                           "include_series": True}).json()
    sr = d["series"]
    frac, vis = sr["earth_frac"], sr["earth_visible"]
    assert len(frac) == sr["count"]
    assert all(0 <= f <= 1 for f in frac)
    # Tierra visible = centro sobre el terreno = más de la mitad del disco
    assert all(f >= 0.5 for f, v in zip(frac, vis) if v)
    assert all(f <= 0.5 for f, v in zip(frac, vis) if not v)
    assert any(vis) and not all(vis)


def test_earth_frac_lado_oculto_siempre_cero(client):
    d = client.post("/api/evaluate", json={"site_id": "change6", "start": "2026-11-14", "end": "2026-11-20",
                                           "step_min": 360, "include_series": True}).json()
    assert set(d["series"]["earth_frac"]) == {0.0}


def test_earth_frac_en_mission(client):
    d = client.post("/api/mission", json={"site_id": IM2["id"], "landing": "2025-03-06T17:29:00Z",
                                          "duration_days": 2, "include_series": True}).json()
    sr = d["series"]
    assert len(sr["earth_frac"]) == sr["count"]


@pytest.mark.parametrize("endpoint,extra", [
    ("/api/evaluate", {"start": "2025-03-06T17:29:00Z", "end": "2025-03-07T17:29:00Z", "step_min": 360}),
    ("/api/mission", {"landing": "2025-03-06T17:29:00Z", "duration_days": 1}),
])
def test_site_id_gana_sobre_xy(client, endpoint, extra):
    """Con site_id y x/y distintos se usa el sitio del catálogo y su relieve precalculado."""
    d = client.post(endpoint, json={"site_id": IM2["id"], "x": 0.0, "y": 0.0, **extra}).json()
    assert d["site"]["id"] == IM2["id"]
    assert (d["input"]["x_lon"], d["input"]["y_lat"]) == (IM2["lon"], IM2["lat"])
    assert d["horizon"]["terrain"] is True


def test_site_id_inexistente_con_xy_da_404(client):
    """Antes se ignoraba el site_id; ahora un id mal escrito no pasa en silencio."""
    r = client.post("/api/evaluate", json={"site_id": "no-existe", "x": 29.1957, "y": -84.7906,
                                           "start": "2025-03-06", "end": "2025-03-07"})
    assert r.status_code == 404


def test_solo_xy_sigue_siendo_sitio_personalizado(client):
    d = client.post("/api/evaluate", json={"x": 29.1957, "y": -84.7906, "start": "2025-03-06",
                                           "end": "2025-03-07", "step_min": 360}).json()
    assert d["site"]["id"].startswith("custom_")
