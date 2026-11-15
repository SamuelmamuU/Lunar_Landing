"""Pruebas del catálogo (slice B2): campos nuevos y sitios de contraste."""
import json
import re

from fastapi.testclient import TestClient

from api import app
from lunar.config import DATA_DIR

CATEGORIAS = {"artemis", "clps", "international", "apollo", "reference"}
ISO_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
NUEVOS = {"shackleton-floor", "mons-malapert", "haworth", "nobile", "change4"}
# id del catálogo -> id en real_missions.json
EN_REAL_MISSIONS = {"mons-mouton-im2": "im2", "malapert-a-im1": "im1", "chandrayaan3": "chandrayaan3",
                    "change6": "change6", "slim": "slim", "blue-ghost-1": "blue-ghost-1", "apollo11": "apollo11"}


def _sites() -> list[dict]:
    with TestClient(app) as c:
        r = c.get("/api/sites")
    assert r.status_code == 200
    return r.json()["sites"]


def test_todos_tienen_category_id_valido():
    for s in _sites():
        assert s.get("category_id") in CATEGORIAS, s["id"]


def test_sitios_de_contraste_presentes():
    ids = {s["id"] for s in _sites()}
    assert NUEVOS <= ids


def test_ids_unicos_y_coordenadas_validas():
    sites = _sites()
    assert len({s["id"] for s in sites}) == len(sites)
    for s in sites:
        assert -90 <= s["lat"] <= 90 and -180 <= s["lon"] <= 180, s["id"]


def test_campos_opcionales_sin_nulos():
    """Si no hay dato, el campo no aparece (el front lee `undefined`, no `null`)."""
    for s in _sites():
        for k in ("agency", "mission", "landed_utc"):
            assert s.get(k, "") is not None, (s["id"], k)
        if "landed_utc" in s:
            assert ISO_Z.match(s["landed_utc"]), s["id"]


def test_misiones_aterrizadas_traen_agencia_mision_y_fecha():
    for s in _sites():
        if s["category_id"] in ("apollo", "clps") or s["id"] in ("change6", "change4", "slim", "chandrayaan3"):
            assert s.get("agency") and s.get("mission") and s.get("landed_utc"), s["id"]


def test_landed_utc_coincide_con_real_missions():
    real = {m["id"]: m for m in json.loads((DATA_DIR / "real_missions.json").read_text(encoding="utf-8"))}
    por_id = {s["id"]: s for s in _sites()}
    for sid, rid in EN_REAL_MISSIONS.items():
        assert por_id[sid]["landed_utc"] == real[rid]["landing_utc"], sid


def test_catalogo_acepta_los_sitios_nuevos_en_evaluate():
    with TestClient(app) as c:
        for sid in sorted(NUEVOS):
            r = c.post("/api/evaluate", json={"site_id": sid, "start": "2026-11-14", "end": "2026-11-16",
                                              "step_min": 360})
            assert r.status_code == 200, (sid, r.text)
            assert r.json()["site"]["id"] == sid
