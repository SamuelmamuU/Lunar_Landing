"""Pruebas del contrato con el frontend (docs/contrato-api.md).

Protegen dos cosas:
1. El azimut y la elevación que devuelve la API (SPICE azlcpo) coinciden con un cálculo independiente hecho a
   partir de `vectors_3d.unit_directions` (marco local Este-Norte-Cénit armado a mano).
2. La forma de las respuestas que consume el frontend: si alguien renombra o quita uno de estos campos, la prueba
   falla. Agregar campos nuevos no la rompe.
"""
import math
import re

import numpy as np
import pytest
from fastapi.testclient import TestClient

from api import app

ISO_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _evaluate(client, **body) -> dict:
    r = client.post("/api/evaluate", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------ 1. azimut / elevación
def _az_el(site_unit: list[float], direction: list[float]) -> tuple[float, float]:
    """Azimut (desde el norte, horario) y elevación de `direction` vista desde el punto `site_unit`."""
    up = np.array(site_unit, dtype=float)
    up /= np.linalg.norm(up)
    east = np.cross([0.0, 0.0, 1.0], up)  # eje de rotación × cénit = este local
    east /= np.linalg.norm(east)
    north = np.cross(up, east)
    d = np.array(direction, dtype=float)
    d /= np.linalg.norm(d)
    az = math.degrees(math.atan2(d @ east, d @ north)) % 360.0
    el = math.degrees(math.asin(max(-1.0, min(1.0, d @ up))))
    return az, el


def _az_diff(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


SITIOS = [
    pytest.param({"site_id": "mons-mouton-im2", "start": "2025-03-06T17:29:00Z"}, id="im2-polo-sur"),
    pytest.param({"site_id": "connecting-ridge", "start": "2026-11-14T00:00:00Z"}, id="connecting-ridge"),
    pytest.param({"x": 23.473, "y": 0.6741, "start": "2026-11-20T12:00:00Z"}, id="apolo11-ecuador"),
    pytest.param({"x": -40.0, "y": 60.0, "start": "2026-12-01T06:00:00Z"}, id="hemisferio-norte"),
]


@pytest.mark.parametrize("where", SITIOS)
def test_azimut_elevacion_coinciden_con_unit_directions(client, where):
    d = _evaluate(client, **where, end=where["start"][:10] + "T23:59:59Z", step_min=360)
    now = d["at_start"]
    ud = now["vectors_3d"]["unit_directions"]
    for body, key in (("sun", "site_to_sun"), ("earth", "site_to_earth")):
        az, el = _az_el(ud["site"], ud[key])
        assert _az_diff(now[body]["azimuth_deg"], az) < 0.01, (body, now[body]["azimuth_deg"], az)
        assert abs(now[body]["elevation_deg"] - el) < 0.01, (body, now[body]["elevation_deg"], el)
        assert 0 <= now[body]["azimuth_deg"] < 360


def test_azimut_im2_valores_documentados(client):
    """Valores del contrato (sección 3.2) y del guion de la demo: IM-2 al aterrizar, 2025-03-06 17:29 UTC."""
    d = _evaluate(client, site_id="mons-mouton-im2", start="2025-03-06T17:29:00Z", end="2025-03-07T17:29:00Z",
                  step_min=360)
    sun, earth = d["at_start"]["sun"], d["at_start"]["earth"]
    assert sun["azimuth_deg"] == pytest.approx(65.68, abs=0.01)
    assert sun["elevation_deg"] == pytest.approx(2.46, abs=0.01)
    assert earth["azimuth_deg"] == pytest.approx(335.85, abs=0.01)
    assert earth["elevation_deg"] == pytest.approx(11.19, abs=0.01)


# ------------------------------------------------------------------ 2. forma de las respuestas
SERIES_LISTAS = ["t_utc", "sun_az", "sun_el", "sun_frac", "sun_clearance", "sun_interference", "sun_clear",
                 "earth_az", "earth_el", "earth_frac", "earth_clearance", "earth_visible", "earth_interference",
                 "earth_clear", "candidate"]
METRICS = ["pct_sun_energy", "pct_sun_visible", "pct_sun_full_disk", "pct_earth_visible", "pct_sun_and_earth",
           "longest_light_h", "longest_dark_h", "longest_earth_gap_h", "pct_sun_blocked_by_terrain",
           "pct_earth_blocked_by_terrain", "max_sun_elevation_deg", "min_sun_elevation_deg", "pct_time_candidate"]
NEXT = ["sun_event", "sun_event_utc", "hours_to_sun_event", "earth_event", "earth_event_utc", "hours_to_earth_event",
        "search_limit_days"]
BODY = ["azimuth_deg", "elevation_deg", "horizon_deg", "clearance_deg", "status", "visible", "visible_fraction",
        "angular_radius_deg"]
STATUS = {"bajo_horizonte", "interferencia_terreno", "marginal", "despejado"}
EVENTOS = {"sunrise", "sunset", "earthrise", "earthset"}


def _tiene(d: dict, campos: list[str], donde: str):
    faltan = [k for k in campos if k not in d]
    assert not faltan, f"Faltan campos del contrato en {donde}: {faltan}"


def test_forma_evaluate_con_serie(client):
    """Petición exacta del frontend: site_id, include_series, step_min 60."""
    d = _evaluate(client, site_id="mons-mouton-im2", start="2025-03-06T17:29:00Z", end="2025-03-08T17:29:00Z",
                  step_min=60, include_series=True)
    _tiene(d, ["meta", "input", "site", "horizon", "result", "at_start", "metrics", "events", "series"], "raíz")

    _tiene(d["meta"], ["schema", "kernels", "frame", "abcorr"], "meta")
    _tiene(d["input"], ["x_lon", "y_lat", "start_utc", "end_utc", "days", "step_min"], "input")
    assert d["input"]["step_min"] == 60
    _tiene(d["site"], ["id", "name", "lat", "lon", "category"], "site")

    hz = d["horizon"]
    _tiene(hz, ["terrain", "dem", "z_m", "h_obs_m", "az_step_deg", "max_deg", "min_deg", "profile_deg"], "horizon")
    assert isinstance(hz["terrain"], bool)
    assert len(hz["profile_deg"]) == round(360 / hz["az_step_deg"])
    assert all(isinstance(v, (int, float)) for v in hz["profile_deg"])

    res = d["result"]
    _tiene(res, ["is_candidate", "label", "first_landing_utc", "best_window", "landing_windows", "reasons"], "result")
    assert res["label"] in ("CANDIDATO", "NO CANDIDATO")
    assert isinstance(res["reasons"], list)
    for w in res["landing_windows"]:
        _tiene(w, ["start_utc", "end_utc", "duration_h"], "result.landing_windows[]")

    now = d["at_start"]
    _tiene(now, ["utc", "sun", "earth", "next", "candidate", "vectors_3d"], "at_start")
    for body in ("sun", "earth"):
        _tiene(now[body], BODY, f"at_start.{body}")
        assert now[body]["status"] in STATUS
    _tiene(now["next"], NEXT, "at_start.next")
    _tiene(now["candidate"], ["is_candidate", "label", "code", "reasons", "checks"], "at_start.candidate")

    _tiene(d["metrics"], METRICS, "metrics")
    for e in d["events"]:
        _tiene(e, ["utc", "type"], "events[]")
        assert e["type"] in EVENTOS and ISO_Z.match(e["utc"])

    sr = d["series"]
    _tiene(sr, ["start_utc", "step_min", "count", *SERIES_LISTAS], "series")
    assert sr["count"] == 49  # 2 días a 60 min, ambos extremos incluidos
    for k in SERIES_LISTAS:
        assert len(sr[k]) == sr["count"], f"series.{k} no tiene count elementos"
    assert sr["t_utc"][0] == d["input"]["start_utc"] and all(ISO_Z.match(t) for t in sr["t_utc"])
    assert all(isinstance(v, bool) for k in ("earth_visible", "sun_clear", "earth_clear", "candidate")
               for v in sr[k])
    assert all(0 <= f <= 1 for f in sr["sun_frac"])
    assert all(0 <= a < 360 for k in ("sun_az", "earth_az") for a in sr[k])


def test_forma_sites(client):
    r = client.get("/api/sites")
    assert r.status_code == 200
    sites = r.json()["sites"]
    assert sites
    for s in sites:
        _tiene(s, ["id", "name", "lat", "lon", "category", "note"], f"sites[{s.get('id')}]")
        assert -90 <= s["lat"] <= 90 and -180 <= s["lon"] <= 180
    assert len({s["id"] for s in sites}) == len(sites), "IDs repetidos en el catálogo"


def test_forma_mission(client):
    r = client.post("/api/mission", json={"site_id": "mons-mouton-im2", "landing": "2025-03-06T17:29:00Z",
                                          "departure": "2025-03-09T17:29:00Z"})
    assert r.status_code == 200, r.text
    d = r.json()
    _tiene(d, ["result", "at_landing", "during_mission"], "mission")
    _tiene(d["result"], ["label", "reasons", "checks", "alternatives", "max_feasible_duration_days"], "mission.result")
    _tiene(d["result"]["alternatives"], ["before", "after"], "mission.result.alternatives")


def test_errores_del_contrato(client):
    r = client.post("/api/evaluate", json={"site_id": "no-existe", "start": "2025-03-06", "end": "2025-03-07"})
    assert r.status_code == 404 and isinstance(r.json()["detail"], str)
    r = client.post("/api/evaluate", json={"site_id": "mons-mouton-im2", "start": "2025-03-07", "end": "2025-03-06"})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)
    r = client.post("/api/evaluate", json={"x": 0, "y": 200})
    assert r.status_code == 422 and isinstance(r.json()["detail"], list)
