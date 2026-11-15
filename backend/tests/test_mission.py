"""Pruebas de la evaluación de misión (fecha de aterrizaje + fecha de salida de la Luna)."""
from fastapi.testclient import TestClient

from api import app
from fechas import salida

IM2 = {"x": 29.1957, "y": -84.7906, "landing": "2025-03-06T17:29:00Z"}


def test_im2_10_dias_candidato():
    """IM-2 real: aterrizó el 6 de marzo de 2025 con ~10 días de misión planeada."""
    with TestClient(app) as c:
        d = c.post("/api/mission", json={**IM2, "departure": salida(IM2["landing"], 10)}).json()
    assert d["result"]["label"] == "CANDIDATO"
    assert d["during_mission"]["pct_sun"] == 100


def test_im2_20_dias_no_candidato_y_sugiere():
    """20 días ya cruzan el ocaso y el Earthset: no debe pasar, y debe sugerir otra fecha o explicar por qué."""
    with TestClient(app) as c:
        d = c.post("/api/mission", json={**IM2, "departure": salida(IM2["landing"], 20)}).json()
    assert d["result"]["label"] == "NO CANDIDATO"
    assert d["result"]["reasons"]


def test_lado_oculto():
    with TestClient(app) as c:
        d = c.get("/api/mission", params={"x": -153.99, "y": -41.64, "landing": "2026-11-20",
                                          "departure": "2026-11-25"}).json()
    assert d["result"]["label"] == "NO CANDIDATO"
    assert d["result"]["alternatives"]["before"] is None and d["result"]["alternatives"]["after"] is None
