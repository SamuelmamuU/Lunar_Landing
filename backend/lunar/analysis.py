"""Series de tiempo, eventos, métricas y semáforo."""
from typing import Callable

import numpy as np

from .geometry import Observer, et_to_utc, sky

HOUR = 3600.0
DAY = 86400.0

Pred = Callable[[dict], bool]
LIT: Pred = lambda s: s["sun"]["visible"]
EARTH: Pred = lambda s: s["earth"]["visible"]


class Calc:
    """Agrupa observador y supuestos para no repetir parámetros."""

    def __init__(self, obs: Observer, eps_sun: float = 0.5, eps_earth: float = 0.5):
        self.obs = obs
        self.eps_sun = eps_sun
        self.eps_earth = eps_earth

    def sky(self, et: float) -> dict:
        return sky(self.obs, et, self.eps_sun, self.eps_earth)

    # ---------------------------------------------------------- series
    def series(self, et0: float, et1: float, step_min: float = 10) -> dict:
        ets = np.arange(et0, et1 + 1e-6, step_min * 60.0)
        cols = {k: [] for k in ("sun_az", "sun_el", "sun_frac", "sun_clearance", "sun_interference", "sun_clear",
                                "earth_az", "earth_el", "earth_clearance", "earth_visible", "earth_interference",
                                "earth_clear")}
        for et in ets:
            s = self.sky(et)
            cols["sun_az"].append(round(s["sun"]["azimuth_deg"], 3))
            cols["sun_el"].append(round(s["sun"]["elevation_deg"], 4))
            cols["sun_frac"].append(round(s["sun"]["visible_fraction"], 4))
            cols["earth_az"].append(round(s["earth"]["azimuth_deg"], 3))
            cols["earth_el"].append(round(s["earth"]["elevation_deg"], 4))
            cols["earth_visible"].append(bool(s["earth"]["visible"]))
            cols["sun_interference"].append(bool(s["sun"]["terrain_interference"]))
            cols["earth_interference"].append(bool(s["earth"]["terrain_interference"]))
            cols["sun_clearance"].append(round(s["sun"]["clearance_deg"], 4))
            cols["earth_clearance"].append(round(s["earth"]["clearance_deg"], 4))
            cols["sun_clear"].append(s["sun"]["status"] == "despejado")
            cols["earth_clear"].append(s["earth"]["status"] == "despejado")
        return {"start_utc": et_to_utc(et0), "step_min": step_min, "count": len(ets), **cols}

    # ---------------------------------------------------------- eventos
    def _refine(self, a: float, b: float, pred: Pred) -> float:
        va = pred(self.sky(a))
        for _ in range(12):  # 20 min / 2^12 ≈ 0.3 s
            m = 0.5 * (a + b)
            if pred(self.sky(m)) == va:
                a = m
            else:
                b = m
        return 0.5 * (a + b)

    def events(self, et0: float, et1: float, step_min: float = 10) -> list[dict]:
        out = []
        dt = step_min * 60.0
        prev = self.sky(et0)
        et = et0 + dt
        while et <= et1:
            cur = self.sky(et)
            for pred, up, down in ((LIT, "sunrise", "sunset"), (EARTH, "earthrise", "earthset")):
                if pred(prev) != pred(cur):
                    t = self._refine(et - dt, et, pred)
                    out.append({"utc": et_to_utc(t), "type": up if pred(cur) else down})
            prev = cur
            et += dt
        return sorted(out, key=lambda e: e["utc"])

    def next_change(self, et: float, pred: Pred, max_days: float = 60, step_min: float = 20) -> float | None:
        v0 = pred(self.sky(et))
        dt = step_min * 60.0
        a = et
        while a < et + max_days * DAY:
            b = a + dt
            if pred(self.sky(b)) != v0:
                return self._refine(a, b, pred)
            a = b
        return None

    # ---------------------------------------------------------- métricas
    @staticmethod
    def metrics(series: dict) -> dict:
        frac = np.array(series["sun_frac"])
        lit = frac > 0
        earth = np.array(series["earth_visible"])
        both = lit & earth
        h = series["step_min"] / 60.0

        def longest(flags: np.ndarray, want: bool) -> float:
            best = run = 0
            for f in flags:
                run = run + 1 if bool(f) == want else 0
                best = max(best, run)
            return round(best * h, 2)

        return {
            "pct_sun_energy": round(float(frac.mean() * 100), 2),
            "pct_sun_visible": round(float(lit.mean() * 100), 2),
            "pct_sun_full_disk": round(float((frac >= 0.999).mean() * 100), 2),
            "pct_earth_visible": round(float(earth.mean() * 100), 2),
            "pct_sun_and_earth": round(float(both.mean() * 100), 2),
            "longest_light_h": longest(lit, True),
            "longest_dark_h": longest(lit, False),
            "longest_earth_gap_h": longest(earth, False),
            "pct_sun_blocked_by_terrain": round(float(np.mean(series["sun_interference"]) * 100), 2),
            "pct_earth_blocked_by_terrain": round(float(np.mean(series["earth_interference"]) * 100), 2),
            "max_sun_elevation_deg": round(float(np.max(series["sun_el"])), 3),
            "min_sun_elevation_deg": round(float(np.min(series["sun_el"])), 3),
        }


STATUS_TXT = {
    "bajo_horizonte": "está bajo el horizonte (no ha salido)",
    "interferencia_terreno": "lo tapa el terreno (interferencia)",
    "marginal": "se ve, pero a menos de ε del terreno",
    "despejado": "se ve con margen suficiente",
}


def candidate(sky_now: dict, h_sun: float | None, h_earth: float | None,
              min_light_h: float, min_comm_h: float) -> dict:
    """CANDIDATO solo si Sol y Tierra están despejados (margen >= ε) y duran lo suficiente.

    h_sun / h_earth: horas hasta el próximo cambio (None = no cambia en 60 días).
    """
    sun, earth = sky_now["sun"], sky_now["earth"]
    checks = [
        {"id": "sol_despejado", "ok": sun["status"] == "despejado",
         "value": round(sun["clearance_deg"], 4), "threshold": f">= {sun['epsilon_deg']}° (ε_sol)",
         "detail": "Sol: " + STATUS_TXT[sun["status"]]},
        {"id": "tierra_despejada", "ok": earth["status"] == "despejado",
         "value": round(earth["clearance_deg"], 4), "threshold": f">= {earth['epsilon_deg']}° (ε_tierra)",
         "detail": "Tierra: " + STATUS_TXT[earth["status"]]},
    ]
    light_ok = sun["visible"] and (h_sun is None or h_sun >= min_light_h)
    comm_ok = earth["visible"] and (h_earth is None or h_earth >= min_comm_h)
    checks.append({"id": "luz_restante", "ok": light_ok,
                   "value": "no visible" if not sun["visible"] else (">60 d" if h_sun is None else round(h_sun, 2)),
                   "threshold": f">= {min_light_h:g} h", "detail": "Horas de Sol antes del ocaso"})
    checks.append({"id": "comunicacion_restante", "ok": comm_ok,
                   "value": "no visible" if not earth["visible"] else (">60 d" if h_earth is None else round(h_earth, 2)),
                   "threshold": f">= {min_comm_h:g} h", "detail": "Horas de Tierra visible antes del Earthset"})
    ok = all(c["ok"] for c in checks)
    if ok:
        code = "go"
    elif sun["line_of_sight"] or earth["line_of_sight"]:
        code = "caution"
    else:
        code = "nogo"
    return {
        "is_candidate": ok,
        "label": "CANDIDATO" if ok else "NO CANDIDATO",
        "code": code,
        "interference": {"sun": sun["terrain_interference"], "earth": earth["terrain_interference"]},
        "reasons": [c["detail"] if c["id"].endswith(("despejado", "despejada")) else
                    f"{c['detail']}: {c['value']} (se pide {c['threshold']})"
                    for c in checks if not c["ok"]],
        "checks": checks,
    }
