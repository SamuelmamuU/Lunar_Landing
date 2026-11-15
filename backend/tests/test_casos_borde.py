"""Casos borde y propiedades que siempre deben cumplirse."""
import pytest
from fastapi.testclient import TestClient

from api import app
from fechas import salida
from lunar.analysis import Calc
from lunar.geometry import utc_to_et
from lunar.report import Settings, make_calc
from lunar.sites import Site, get_site

T = "2026-11-14T18:00:00Z"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _sky(lat, lon, h=2.0, t=T):
    calc, _ = make_calc(Site("t", "t", lat, lon), Settings(h_obs_m=h))
    return calc.sky(utc_to_et(t))


# ---------------------------------------------------------------- geometría
def test_longitud_200_igual_a_menos_160(client):
    a = client.get("/api/mission", params={"x": 200, "y": -85, "landing": "2026-11-20", "departure": "2026-11-21"}).json()
    b = client.get("/api/mission", params={"x": -160, "y": -85, "landing": "2026-11-20", "departure": "2026-11-21"}).json()
    assert a["at_landing"]["sun"]["elevation_deg"] == b["at_landing"]["sun"]["elevation_deg"]


def test_polo_exacto_no_truena():
    s = _sky(-90, 0)
    assert -2 < s["sun"]["elevation_deg"] < 2


def test_cara_visible_centro_tierra_casi_cenit():
    """En (0°, 0°) la Tierra está casi en el cenit (la libración la mueve unos grados)."""
    assert _sky(0, 0)["earth"]["elevation_deg"] > 80


def test_lado_oculto_centro_sin_tierra():
    assert _sky(0, 180)["earth"]["elevation_deg"] < -80


def test_mas_altura_ve_mas_lejos():
    """Subir el panel baja el horizonte ideal (se ve 'por encima' de la curvatura)."""
    assert _sky(-89, 0, h=50)["sun"]["ideal_horizon_deg"] < _sky(-89, 0, h=2)["sun"]["ideal_horizon_deg"]


def test_estado_coherente_con_margen():
    s = _sky(-84.7906, 29.1957)
    for b in ("sun", "earth"):
        st, c, eps = s[b]["status"], s[b]["clearance_deg"], s[b]["epsilon_deg"]
        if st == "despejado":
            assert c >= eps
        if st == "marginal":
            assert 0 < c < eps


# ---------------------------------------------------------------- ε y métricas
def test_mayor_epsilon_nunca_aumenta_candidatos():
    site = get_site("mons-mouton-im2")
    pct = []
    for eps in (0.0, 1.0, 3.0):
        calc, _ = make_calc(site, Settings(eps_sun_deg=eps, eps_earth_deg=eps))
        et = utc_to_et("2025-03-01T00:00:00Z")
        sr = calc.series(et, et + 20 * 86400, 60)
        pct.append(sum(a and b for a, b in zip(sr["sun_clear"], sr["earth_clear"])))
    assert pct[0] >= pct[1] >= pct[2]


def test_metricas_consistentes():
    calc, _ = make_calc(get_site("connecting-ridge"), Settings())
    et = utc_to_et(T)
    m = Calc.metrics(calc.series(et, et + 30 * 86400, 60))
    assert m["pct_sun_and_earth"] <= min(m["pct_sun_visible"], m["pct_earth_visible"]) + 1e-9
    assert 0 <= m["pct_sun_full_disk"] <= m["pct_sun_visible"] <= 100


def test_eventos_alternan():
    calc, _ = make_calc(get_site("apollo11"), Settings())
    et = utc_to_et("2026-01-01T00:00:00Z")
    ev = [e["type"] for e in calc.events(et, et + 90 * 86400, 30) if e["type"] in ("sunrise", "sunset")]
    assert len(ev) >= 5
    assert all(a != b for a, b in zip(ev, ev[1:]))


def test_dia_lunar_ecuador_dura_un_mes_sinodico():
    calc, _ = make_calc(get_site("apollo11"), Settings())
    et = utc_to_et("2026-01-01T00:00:00Z")
    from datetime import datetime
    rises = [e["utc"] for e in calc.events(et, et + 120 * 86400, 30) if e["type"] == "sunrise"]
    f = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))  # noqa: E731
    gaps = [(f(b) - f(a)).total_seconds() / 86400 for a, b in zip(rises, rises[1:])]
    assert all(29.2 < g < 29.9 for g in gaps)


# ---------------------------------------------------------------- misión y API
def test_mision_mas_larga_que_el_maximo_no_es_candidata(client):
    d = client.get("/api/mission", params={"x": 29.1957, "y": -84.7906,
                                           "landing": "2025-03-06T17:29:00Z", "departure": "2025-03-16T17:29:00Z"}).json()
    mx = d["result"]["max_feasible_duration_days"]
    d2 = client.get("/api/mission", params={"x": 29.1957, "y": -84.7906, "landing": "2025-03-06T17:29:00Z",
                                            "departure": salida("2025-03-06T17:29:00Z", mx + 1)}).json()
    assert d2["result"]["label"] == "NO CANDIDATO"


def test_alternativa_sugerida_si_es_candidata(client):
    d = client.get("/api/mission", params={"x": 29.1957, "y": -84.7906, "landing": "2025-03-01",
                                           "departure": "2025-03-06"}).json()
    alt = d["result"]["alternatives"]["after"]
    assert alt is not None
    d2 = client.get("/api/mission", params={"x": 29.1957, "y": -84.7906, "landing": alt["landing_utc"],
                                            "departure": salida(alt["landing_utc"], 5)}).json()
    assert d2["result"]["label"] == "CANDIDATO"


def test_bateria_grande_relaja_energia(client):
    base = {"x": 29.1957, "y": -84.7906, "landing": "2025-03-06T17:29:00Z", "departure": "2025-03-26T17:29:00Z",
            "max_comm_gap_hours": 1000}
    a = client.get("/api/mission", params={**base, "battery_hours": 12}).json()
    b = client.get("/api/mission", params={**base, "battery_hours": 1000}).json()
    assert a["result"]["label"] == "NO CANDIDATO" and b["result"]["label"] == "CANDIDATO"


@pytest.mark.parametrize("landing", ["2025-03-06", "2025-03-06T17:29", "2025-03-06T17:29:00Z", "2025-03-06T11:29:00-06:00"])
def test_formatos_de_fecha(client, landing):
    r = client.get("/api/mission", params={"x": 29.1957, "y": -84.7906, "landing": landing, "departure": salida(landing, 1)})
    assert r.status_code == 200


@pytest.mark.parametrize("params", [
    {"x": 0, "y": 95, "landing": "2026-01-01", "departure": "2026-01-02"},     # latitud imposible
    {"x": 0, "y": 0, "landing": "2026-01-01", "departure": "2026-01-01"},      # salida = aterrizaje
    {"x": 0, "y": 0, "landing": "14/11/2026", "departure": "2026-11-15"},      # formato de fecha inválido
    {"x": 0, "y": 0, "landing": "2070-01-01", "departure": "2070-01-02"},      # fuera de cobertura
    {"x": 0, "y": 0, "landing": "2026-01-01"},                             # sin salida
])
def test_entradas_invalidas(client, params):
    assert client.get("/api/mission", params=params).status_code == 422
