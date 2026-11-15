"""Fecha y hora de salida de la Luna (slice B7): la serie de /api/evaluate no pasa de `end`."""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from api import app

IM2 = "mons-mouton-im2"
LANDING = "2025-03-06T17:29:00Z"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _t(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


# ------------------------------------------------------------------ /api/evaluate: la serie no pasa de `end`
@pytest.mark.parametrize("end,step", [
    ("2025-03-08T08:15:00Z", 60),   # antes la última muestra quedaba 14 min después del fin
    ("2025-03-08T08:45:00Z", 60),
    ("2025-03-06T19:10:00Z", 60),   # antes: 19 min después del fin
    ("2025-03-07T17:29:00Z", 60),   # alineado: la última muestra es el fin exacto
    ("2025-03-09T03:07:00Z", 45),
])
def test_evaluate_ultima_muestra_no_pasa_del_fin(client, end, step):
    d = client.post("/api/evaluate", json={"site_id": IM2, "start": LANDING, "end": end, "step_min": step,
                                           "include_series": True}).json()
    sr, fin = d["series"], _t(d["input"]["end_utc"])
    last = _t(sr["t_utc"][-1])
    assert last <= fin < last + timedelta(minutes=step)
    assert sr["count"] == len(sr["t_utc"]) == len(sr["earth_frac"]) == len(sr["candidate"])
    for w in d["result"]["landing_windows"]:
        assert _t(w["end_utc"]) <= fin


def test_evaluate_dias_completos_igual_que_antes(client):
    """Lo que manda hoy el front (inicio + N días, 60 min): misma cantidad de muestras, de inicio a fin exactos."""
    d = client.post("/api/evaluate", json={"site_id": IM2, "start": "2025-03-06T17:28:50.000Z",
                                           "end": "2025-03-13T17:28:50.000Z", "step_min": 60,
                                           "include_series": True}).json()
    assert d["series"]["count"] == 7 * 24 + 1
    assert d["series"]["t_utc"][-1] == d["input"]["end_utc"] == "2025-03-13T17:28:50Z"


@pytest.mark.parametrize("start,end,esperado", [
    ("2025-03-06T17:29", "2025-03-07T17:29", ("2025-03-06T17:29:00Z", "2025-03-07T17:29:00Z")),
    ("2025-03-06T11:29-06:00", "2025-03-07T05:00-06:00", ("2025-03-06T17:29:00Z", "2025-03-07T11:00:00Z")),
    ("2025-03-06", "2025-03-07", ("2025-03-06T00:00:00Z", "2025-03-07T00:00:00Z")),
])
def test_evaluate_formatos_de_fecha_y_hora(client, start, end, esperado):
    d = client.post("/api/evaluate", json={"site_id": IM2, "start": start, "end": end, "step_min": 360}).json()
    assert (d["input"]["start_utc"], d["input"]["end_utc"]) == esperado
