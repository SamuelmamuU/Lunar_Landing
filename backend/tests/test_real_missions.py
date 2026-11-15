"""Validación contra misiones reales: python -m pytest tests -q

Cada misión de data/real_missions.json se compara con lo que realmente pasó
(Sol y Tierra al aterrizar, horas de luz, fecha del ocaso).
"""
import pytest

from lunar.validation import check_mission, load_missions

MISSIONS = load_missions()


@pytest.mark.parametrize("m", MISSIONS, ids=[m["id"] for m in MISSIONS])
def test_mision_real(m):
    r = check_mission(m)
    fallas = [c for c in r["checks"] if not c["ok"]]
    assert not fallas, f"{m['name']}: {fallas}"


def test_todas_aterrizaron_con_sol():
    """Todas las misiones reales aterrizaron de día: el modelo debe ver el Sol en todas."""
    for m in MISSIONS:
        assert check_mission(m)["model"]["sun_status"] == "despejado", m["id"]


def test_blue_ghost_horas_de_luz():
    """Firefly reportó 346 h de luz; el modelo debe estar a menos de 12 h."""
    m = next(x for x in MISSIONS if x["id"] == "blue-ghost-1")
    assert abs(check_mission(m)["model"]["hours_to_sunset"] - 346) < 12
