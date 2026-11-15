"""Peticiones simultáneas: CSPICE no es seguro con hilos y, sin candado, varias llamadas a la vez daban errores
SPICE falsos (NOFRAMECONNECT, FRAMEDATANOTFOUND) o tumbaban el proceso. Reportado por el front con 3 en paralelo."""
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from api import app

R = {"start": "2025-03-06T17:29:00Z", "end": "2025-03-20T17:29:00Z", "step_min": 60, "include_series": True}
PETICIONES = [
    ("/api/evaluate", {"site_id": "mons-mouton-im2", **R}),
    ("/api/evaluate", {"site_id": "connecting-ridge", **R}),
    ("/api/evaluate", {"site_id": "change6", **R}),
    ("/api/evaluate", {"site_id": "apollo11", **R}),
    ("/api/mission", {"site_id": "mons-mouton-im2", "landing": "2025-03-06T17:29:00Z",
                      "departure": "2025-03-16T17:29:00Z"}),
    ("/api/mission", {"site_id": "nobile", "landing": "2025-03-06T17:29:00Z", "departure": "2025-03-12T00:00:00Z"}),
]


def _clave(d: dict) -> tuple:
    """Lo que debe ser idéntico entre una llamada secuencial y una simultánea."""
    return (d["site"]["id"], d["result"]["label"], d.get("metrics") or d.get("during_mission"),
            d.get("events"), d.get("series", {}).get("sun_el"), d["at_start" if "at_start" in d else "at_landing"]["sun"])


def test_simultaneas_dan_lo_mismo_que_secuenciales():
    with TestClient(app) as c:
        def pedir(p):
            r = c.post(p[0], json=p[1])
            assert r.status_code == 200, r.text
            return _clave(r.json())

        secuencial = [pedir(p) for p in PETICIONES]
        for _ in range(3):
            with ThreadPoolExecutor(len(PETICIONES)) as ex:
                assert list(ex.map(pedir, PETICIONES)) == secuencial
        assert c.get("/api/health").status_code == 200
