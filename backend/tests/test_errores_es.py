"""Los errores de validación (422) llegan en español, con la misma forma que antes: {detail: [{loc, msg, type}]}."""
import pytest
from fastapi.testclient import TestClient

from api import app

M = {"site_id": "mons-mouton-im2", "landing": "2025-03-06T17:29:00Z", "departure": "2025-03-16T05:00:00Z"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _detail(r):
    assert r.status_code == 422, r.text
    d = r.json()["detail"]
    assert isinstance(d, list) and d
    for e in d:
        assert set(e) >= {"loc", "msg", "type"}
    return d


@pytest.mark.parametrize("body,loc,texto", [
    ({k: v for k, v in M.items() if k != "departure"}, ["body", "departure"], "departure: falta el campo obligatorio"),
    ({**M, "y": 200, "x": 0}, ["body", "y"], "y: debe ser menor o igual a 90"),
    ({**M, "battery_hours": -1}, ["body", "battery_hours"], "battery_hours: debe ser mayor o igual a 0"),
    ({**M, "battery_hours": "mucho"}, ["body", "battery_hours"], "battery_hours: debe ser un número"),
])
def test_mission_campos(client, body, loc, texto):
    d = _detail(client.post("/api/mission", json=body))
    e = next(e for e in d if e["loc"] == loc)
    assert e["msg"] == texto


def test_validador_propio_sin_prefijo_en_ingles(client):
    d = _detail(client.post("/api/mission", json={"landing": M["landing"], "departure": M["departure"]}))
    assert d[0]["msg"] == "Envía x y y (coordenadas) o un site_id"


def test_evaluate_step_fuera_de_rango(client):
    d = _detail(client.post("/api/evaluate", json={"site_id": "mons-mouton-im2", "start": "2025-03-06",
                                                   "end": "2025-03-07", "step_min": 0}))
    assert d[0]["msg"] == "step_min: debe ser mayor o igual a 1"


def test_cuerpo_no_json(client):
    d = _detail(client.post("/api/evaluate", content="{no es json", headers={"Content-Type": "application/json"}))
    assert "JSON" in d[0]["msg"]


def test_get_parametro_faltante(client):
    d = _detail(client.get("/api/mission", params={"y": -84.79, "landing": M["landing"], "departure": M["departure"]}))
    assert d[0]["loc"] == ["query", "x"] and d[0]["msg"] == "x: falta el campo obligatorio"


def test_get_validacion_del_modelo(client):
    """GET /api/mission arma el modelo a mano: su detalle usa {campo, mensaje} y también va en español."""
    r = client.get("/api/mission", params={"x": 0, "y": 95, "landing": M["landing"], "departure": M["departure"]})
    assert r.status_code == 422
    d = r.json()["detail"]
    assert d[0]["campo"] == "y" and d[0]["mensaje"] == "y: debe ser menor o igual a 90"


def test_ningun_mensaje_en_ingles(client):
    casos = [client.post("/api/mission", json={}), client.post("/api/evaluate", json={"x": "a", "y": None})]
    ingles = ("Field required", "Input should", "Value error")
    for r in casos:
        for e in _detail(r):
            assert not any(p in e["msg"] for p in ingles), e
