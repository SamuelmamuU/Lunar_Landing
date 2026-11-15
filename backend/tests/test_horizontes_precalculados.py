"""Slices B3 y B6: todo sitio del catálogo tiene su horizonte precalculado en data/horizons.json, así responde con
relieve real en cualquier máquina, aunque no tenga los DEM (.tif).

Si agregas un sitio o cambias sus coordenadas, corre (con ambos DEM en data/dem/):
    python main.py horizon --all --dem data/dem/LDEM_80S_80MPP_ADJ.TIF --dem data/dem/LDEM_64_global.tif --max-px 24000
y commitea data/horizons.json.
"""
import json

import pytest

from lunar.config import DEFAULT_H_OBS_M, HORIZONS_FILE
from lunar.horizon import mask_for
from lunar.sites import load_sites

SITIOS = load_sites()
STORED = json.loads(HORIZONS_FILE.read_text(encoding="utf-8"))


def test_todo_el_catalogo_tiene_horizonte():
    faltan = [s.id for s in SITIOS if s.id not in STORED]
    assert not faltan, f"Sin horizonte en data/horizons.json: {faltan}"


@pytest.mark.parametrize("site", SITIOS, ids=lambda s: s.id)
def test_horizonte_precalculado_coherente(site):
    rec = STORED[site.id]
    assert rec["h_obs_m"] == DEFAULT_H_OBS_M
    assert len(rec["horizon_deg"]) == round(360 / rec["az_step_deg"])
    assert (rec["lat"], rec["lon"]) == (site.lat, site.lon), "Cambiaron las coordenadas: recalcula el horizonte"
    # El DEM fino del polo va primero; fuera del polo el global
    assert rec["dem"][0].startswith("LDEM_80S_80MPP_ADJ") and any(d.startswith("LDEM_64") for d in rec["dem"])
    # compute=False: no usa los .tif aunque existan, solo lo guardado
    assert mask_for(site, compute=False).terrain is True
