"""Pruebas de la API: python -m pytest tests -q"""
from fastapi.testclient import TestClient

from api import app


def test_evaluate_im2_cubre_aterrizaje_real():
    """IM-2 aterrizó el 2025-03-06 17:29 UTC: debe caer dentro de una ventana de aterrizaje."""
    with TestClient(app) as c:
        d = c.post("/api/evaluate", json={"x": 29.1957, "y": -84.7906,
                                          "start": "2025-03-01", "end": "2025-03-20"}).json()
    assert d["result"]["label"] == "CANDIDATO"
    assert any(w["start_utc"] <= "2025-03-06T17:29:00Z" <= w["end_utc"] for w in d["result"]["landing_windows"])


def test_lado_oculto_no_candidato():
    with TestClient(app) as c:
        d = c.post("/api/evaluate", json={"x": -153.99, "y": -41.64,
                                          "start": "2026-11-14", "end": "2026-12-14"}).json()
    assert d["result"]["label"] == "NO CANDIDATO"


def test_errores_de_entrada():
    with TestClient(app) as c:
        assert c.post("/api/evaluate", json={"start": "2026-12-01"}).status_code == 422
        assert c.post("/api/evaluate", json={"x": 0, "y": 0, "start": "2026-12-01", "end": "2026-11-01"}).status_code == 422
        assert c.post("/api/evaluate", json={"x": 0, "y": 200, "start": "2026-11-01", "end": "2026-12-01"}).status_code == 422
