"""Validación contra misiones reales (data/real_missions.json)."""
import json
from datetime import datetime

from .config import DATA_DIR
from .geometry import utc_to_et
from .report import Settings, make_calc, sky_now
from .sites import Site

MISSIONS_FILE = DATA_DIR / "real_missions.json"


def load_missions() -> list[dict]:
    return json.loads(MISSIONS_FILE.read_text(encoding="utf-8"))


def _h_between(a: str, b: str) -> float:
    f = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))  # noqa: E731
    return (f(b) - f(a)).total_seconds() / 3600


def check_mission(m: dict) -> dict:
    """Calcula las condiciones al aterrizar y las compara con lo observado."""
    calc, mask = make_calc(Site(m["id"], m["name"], m["lat"], m["lon"]), Settings())
    now = sky_now(calc, utc_to_et(m["landing_utc"]), Settings())
    e = m["expect"]
    h_sun = now["next"]["hours_to_sun_event"]
    sunset_utc = now["next"]["sun_event_utc"] if now["next"]["sun_event"] == "sunset" else None
    checks = []

    def add(name, ok, model, expected):
        checks.append({"check": name, "ok": bool(ok), "model": model, "expected": expected})

    add("sol_visible", now["sun"]["visible"] == e["sun_visible"], now["sun"]["visible"], e["sun_visible"])
    add("tierra_visible", now["earth"]["visible"] == e["earth_visible"], now["earth"]["visible"], e["earth_visible"])
    if "earth_status" in e:
        add("estado_tierra", now["earth"]["status"] == e["earth_status"], now["earth"]["status"], e["earth_status"])
    if "sun_el_min" in e:
        el = now["sun"]["elevation_deg"]
        add("elevacion_sol", e["sun_el_min"] <= el <= e["sun_el_max"], round(el, 2),
            f"{e['sun_el_min']}–{e['sun_el_max']}°")
    if "hours_to_sunset" in e:
        add("horas_hasta_ocaso", h_sun is not None and abs(h_sun - e["hours_to_sunset"]) <= e["hours_tolerance"],
            h_sun, f"{e['hours_to_sunset']} ± {e['hours_tolerance']} h")
    if "sunset_utc_approx" in e:
        diff = None if not sunset_utc else abs(_h_between(e["sunset_utc_approx"], sunset_utc))
        add("fecha_ocaso", diff is not None and diff <= e["sunset_tolerance_h"], sunset_utc,
            f"{e['sunset_utc_approx']} ± {e['sunset_tolerance_h']} h")
    if "sunset_after_h" in e:
        add("ocaso_despues_de", h_sun is not None and h_sun >= e["sunset_after_h"], h_sun, f">= {e['sunset_after_h']} h")
    if "sunset_after_utc" in e:
        add("ocaso_despues_de_fecha", sunset_utc is not None and sunset_utc >= e["sunset_after_utc"],
            sunset_utc, f">= {e['sunset_after_utc']}")
    if "sunset_before_h" in e:
        add("ocaso_antes_de", h_sun is not None and h_sun <= e["sunset_before_h"], h_sun, f"<= {e['sunset_before_h']} h")

    return {
        "id": m["id"], "name": m["name"], "lat": m["lat"], "lon": m["lon"], "landing_utc": m["landing_utc"],
        "terrain": mask.terrain, "passed": all(c["ok"] for c in checks), "checks": checks,
        "model": {"sun_elevation_deg": now["sun"]["elevation_deg"], "sun_status": now["sun"]["status"],
                  "earth_elevation_deg": now["earth"]["elevation_deg"], "earth_status": now["earth"]["status"],
                  "hours_to_sunset": h_sun, "sunset_utc": sunset_utc},
        "observed": m.get("observed", {}), "known_gap": m.get("known_gap"), "sources": m.get("sources", []),
    }


def validate_all() -> dict:
    rows = [check_mission(m) for m in load_missions()]
    return {"total": len(rows), "passed": sum(r["passed"] for r in rows), "missions": rows}


def to_markdown(rep: dict) -> str:
    lines = [f"# Validación contra misiones reales — {rep['passed']}/{rep['total']} pasan", "",
             "| Misión | Aterrizaje (UTC) | Sol al aterrizar | Tierra al aterrizar | Horas hasta ocaso (modelo) | Observado | Resultado |",
             "| --- | --- | --- | --- | --- | --- | --- |"]
    for r in rep["missions"]:
        m = r["model"]
        lines.append(f"| {r['name']} | {r['landing_utc']} | {m['sun_elevation_deg']:.2f}° ({m['sun_status']}) | "
                     f"{m['earth_elevation_deg']:.2f}° ({m['earth_status']}) | {m['hours_to_sunset']} | "
                     f"{r['observed'].get('note', '')} | {'PASA' if r['passed'] else 'FALLA'} |")
    gaps = [r for r in rep["missions"] if r["known_gap"]]
    if gaps:
        lines += ["", "## Diferencias conocidas", ""] + [f"- **{r['name']}**: {r['known_gap']}" for r in gaps]
    return "\n".join(lines) + "\n"
