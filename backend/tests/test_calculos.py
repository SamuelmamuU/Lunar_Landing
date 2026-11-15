"""Pruebas rápidas: python -m pytest tests -q"""
import math

from lunar.analysis import Calc
from lunar.geometry import disk_fraction, utc_to_et
from lunar.report import Settings, make_calc
from lunar.sites import get_site


def test_disk_fraction():
    assert math.isclose(disk_fraction(0, 0.27), 0.5, abs_tol=1e-9)
    assert disk_fraction(1, 0.27) == 1
    assert disk_fraction(-1, 0.27) == 0


def test_polo_sol_rasante():
    """En el polo el Sol nunca sube más de ~1.6° (1.54° de inclinación + paralaje)."""
    calc, _ = make_calc(get_site("south-pole-rim"), Settings())
    et0 = utc_to_et("2026-01-01T00:00:00Z")
    sr = calc.series(et0, et0 + 366 * 86400, step_min=360)
    assert max(sr["sun_el"]) < 1.8 and min(sr["sun_el"]) > -1.8


def test_lado_oculto_sin_tierra():
    calc, _ = make_calc(get_site("change6"), Settings())
    et0 = utc_to_et("2026-01-01T00:00:00Z")
    m = Calc.metrics(calc.series(et0, et0 + 60 * 86400, step_min=120))
    assert m["pct_earth_visible"] == 0


def test_ecuador_dia_lunar():
    """En el ecuador hay luz ~la mitad del mes sinódico."""
    calc, _ = make_calc(get_site("apollo11"), Settings())
    et0 = utc_to_et("2026-03-01T00:00:00Z")
    m = Calc.metrics(calc.series(et0, et0 + 29.53 * 86400, step_min=30))
    assert 45 < m["pct_sun_visible"] < 55


# ---------------------------------------------------------------- interferencia y ε
import numpy as np

from lunar.analysis import candidate
from lunar.geometry import Observer, classify
from lunar.horizon import Mask


def test_classify_estados():
    ideal = -0.09
    assert classify(-1.0, 2.0, ideal, 0.5) == "bajo_horizonte"          # no ha salido
    assert classify(1.0, 2.0, ideal, 0.5) == "interferencia_terreno"    # salió, pero hay una montaña
    assert classify(2.3, 2.0, ideal, 0.5) == "marginal"                 # se ve a 0.3° < ε
    assert classify(3.0, 2.0, ideal, 0.5) == "despejado"


def test_montana_tapa_el_sol_en_el_polo():
    """Una 'pared' de 3° alrededor del polo: el Sol (≤1.6°) queda siempre tapado por el terreno."""
    site = get_site("south-pole-rim")
    mask = Mask(np.full(360, 3.0), terrain=True, z_m=0.0, h_obs_m=2.0, dem=["prueba"])
    calc = Calc(Observer.make(site, mask), eps_sun=0.5, eps_earth=0.5)
    s = calc.sky(utc_to_et("2026-11-14T18:00:00Z"))
    assert s["sun"]["elevation_deg"] > 0 and s["sun"]["terrain_interference"]
    c = candidate(s, None, None, 72, 24)
    assert c["label"] == "NO CANDIDATO" and c["interference"]["sun"]
