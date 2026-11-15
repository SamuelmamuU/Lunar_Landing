"""Slice B3: todo sitio del catálogo dentro del DEM del polo sur (al sur de 80°S) tiene su horizonte precalculado
en data/horizons.json, así responde con relieve real en cualquier máquina, aunque no tenga el .TIF.

Si agregas un sitio al sur de 80°S, corre:
    python main.py horizon --all --dem data/dem/LDEM_80S_80MPP_ADJ.TIF
y commitea data/horizons.json.
"""
import json

import pytest

from lunar.config import DEFAULT_H_OBS_M, HORIZONS_FILE
from lunar.horizon import mask_for
from lunar.sites import load_sites

LIMITE_DEM_LAT = -80.0
POLARES = [s for s in load_sites() if s.lat <= LIMITE_DEM_LAT]


def test_hay_sitios_polares():
    assert len(POLARES) >= 9


@pytest.mark.parametrize("site", POLARES, ids=lambda s: s.id)
def test_sitio_polar_tiene_horizonte_precalculado(site):
    stored = json.loads(HORIZONS_FILE.read_text(encoding="utf-8"))
    assert site.id in stored, f"Falta {site.id} en data/horizons.json: corre `python main.py horizon --all --dem ...`"
    rec = stored[site.id]
    assert rec["h_obs_m"] == DEFAULT_H_OBS_M
    assert len(rec["horizon_deg"]) == round(360 / rec["az_step_deg"])
    assert (rec["lat"], rec["lon"]) == (site.lat, site.lon), "Cambiaron las coordenadas: recalcula el horizonte"
    # compute=False: no usa el .TIF aunque exista, solo lo guardado
    assert mask_for(site, compute=False).terrain is True
