"""Entradas aleatorias del usuario: cualquier punto, fecha y duración válidos deben responder 200 con un JSON coherente."""
import random
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from api import app

rng = random.Random(42)  # semilla fija: mismas pruebas cada vez
CASOS = []
for _ in range(40):
    fecha = datetime(1960, 1, 1) + timedelta(hours=rng.uniform(0, 89 * 365 * 24))  # 1960–2048
    CASOS.append({
        "x": round(rng.uniform(-180, 180), 4),
        "y": round(rng.uniform(-90, 90), 4),
        "landing": fecha.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "departure": (fecha + timedelta(days=round(rng.uniform(0.5, 40), 1))).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "eps_sun_deg": round(rng.uniform(0, 3), 2),
        "eps_earth_deg": round(rng.uniform(0, 3), 2),
        "battery_hours": rng.choice([0, 12, 48, 200]),
        "max_comm_gap_hours": rng.choice([0, 24, 100, 1000]),
        "h_obs_m": rng.choice([0, 2, 10, 50]),
    })


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize("p", CASOS, ids=[f"{c['y']},{c['x']}@{c['landing'][:10]}" for c in CASOS])
def test_entrada_aleatoria(client, p):
    r = client.get("/api/mission", params=p)
    assert r.status_code == 200, r.text
    d = r.json()
    res = d["result"]
    assert res["label"] in ("CANDIDATO", "NO CANDIDATO")
    assert res["is_candidate"] == (res["label"] == "CANDIDATO") == all(c["ok"] for c in res["checks"])
    assert res["is_candidate"] or res["reasons"]           # si no es candidato, siempre explica por qué
    dm = d["during_mission"]
    for k in ("pct_sun", "pct_earth", "pct_sun_and_earth"):
        assert 0 <= dm[k] <= 100
    assert dm["pct_sun_and_earth"] <= min(dm["pct_sun"], dm["pct_earth"]) + 1e-9
    for b in ("sun", "earth"):
        assert -90 <= d["at_landing"][b]["elevation_deg"] <= 90
        assert 0 <= d["at_landing"][b]["azimuth_deg"] < 360
