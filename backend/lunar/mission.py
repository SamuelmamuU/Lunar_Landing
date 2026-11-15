"""Evaluación de una misión: aterrizar en (x, y) en una fecha dada y operar N días.

Reglas para CANDIDATO (todas deben cumplirse):
  1. Al aterrizar el Sol está despejado:    elevación − terreno ≥ ε_sol
  2. Al aterrizar la Tierra está despejada: elevación − terreno ≥ ε_tierra   (comunicación en el descenso)
  3. Energía: durante la misión, el periodo más largo sin Sol ≤ battery_hours
  4. Comunicación: durante la misión, el periodo más largo sin Tierra ≤ max_comm_gap_hours

Si no es candidato, se buscan fechas de aterrizaje alternativas (± search_days) con la misma duración.
"""
import numpy as np

from . import kernels
from .analysis import DAY, HOUR
from .evaluate import parse_utc
from .geometry import et_to_utc, utc_to_et
from .report import make_calc, meta, sky_now
from .sites import Site


class MissionRules:
    def __init__(self, eps_sun_deg=0.5, eps_earth_deg=0.5, battery_hours=12.0, max_comm_gap_hours=24.0,
                 h_obs_m=2.0):
        self.eps_sun_deg = eps_sun_deg
        self.eps_earth_deg = eps_earth_deg
        self.battery_hours = battery_hours
        self.max_comm_gap_hours = max_comm_gap_hours
        self.h_obs_m = h_obs_m

    def to_dict(self):
        return dict(vars(self))


def _longest_false(flags: np.ndarray) -> int:
    """Longitud (en muestras) del tramo más largo de False."""
    if flags.all():
        return 0
    padded = np.concatenate(([True], flags, [True])).astype(np.int8)
    d = np.diff(padded)
    starts, ends = np.where(d == -1)[0], np.where(d == 1)[0]
    return int((ends - starts).max())


def _first_false(flags: np.ndarray) -> int | None:
    idx = np.where(~flags)[0]
    return int(idx[0]) if len(idx) else None


def mission(site: Site, landing_utc: str, departure_utc: str, rules: MissionRules,
            search_days: float = 15, step_min: float | None = None, include_series: bool = False) -> dict:
    """Aterrizar en `landing_utc` y salir de la Luna en `departure_utc`. La duración se calcula sola."""
    from .report import Settings

    kernels.load()
    landing_utc = parse_utc(landing_utc)
    et_land = utc_to_et(landing_utc)
    duration_days = (utc_to_et(parse_utc(departure_utc)) - et_land) / DAY
    if duration_days <= 0:
        raise ValueError("La salida de la Luna debe ser posterior al aterrizaje")
    if duration_days > 365:
        raise ValueError("La misión no puede durar más de 365 días (salida − aterrizaje)")
    settings = Settings(h_obs_m=rules.h_obs_m, eps_sun_deg=rules.eps_sun_deg, eps_earth_deg=rules.eps_earth_deg,
                        min_light_hours=0, min_comm_hours=0)
    calc, mask = make_calc(site, settings)
    if step_min is None:
        # Paso automático: fino para misiones cortas, más grueso para las largas (respuesta rápida)
        span = duration_days + 2 * search_days
        step_min = 10 if span <= 75 else 20 if span <= 200 else 30

    # Una sola serie cubre la misión y la búsqueda de alternativas
    step_s = step_min * 60.0
    et0 = et_land - search_days * DAY
    et1 = et_land + (search_days + duration_days) * DAY
    sr = calc.series(et0, et1, step_min)
    lit = np.array(sr["sun_frac"]) > 0
    earth = np.array(sr["earth_visible"])
    sun_clear = np.array(sr["sun_clear"])
    earth_clear = np.array(sr["earth_clear"])
    sun_blk = np.array(sr["sun_interference"])
    earth_blk = np.array(sr["earth_interference"])
    n_dur = int(np.floor(duration_days * DAY / step_s + 1e-9))   # la ventana no pasa de la salida
    i_land = int(round((et_land - et0) / step_s))
    step_h = step_min / 60.0

    def check(i: int) -> dict:
        w = slice(i, i + n_dur + 1)
        dark_h = _longest_false(lit[w]) * step_h
        gap_h = _longest_false(earth[w]) * step_h
        checks = [
            {"id": "sol_al_aterrizar", "ok": bool(sun_clear[i]),
             "value": round(float(sr["sun_clearance"][i]), 4), "threshold": f">= {rules.eps_sun_deg}° (ε_sol)"},
            {"id": "tierra_al_aterrizar", "ok": bool(earth_clear[i]),
             "value": round(float(sr["earth_clearance"][i]), 4), "threshold": f">= {rules.eps_earth_deg}° (ε_tierra)"},
            {"id": "energia", "ok": dark_h <= rules.battery_hours,
             "value": round(dark_h, 2), "threshold": f"noche más larga <= {rules.battery_hours:g} h (batería)"},
            {"id": "comunicacion", "ok": gap_h <= rules.max_comm_gap_hours,
             "value": round(gap_h, 2), "threshold": f"hueco sin Tierra <= {rules.max_comm_gap_hours:g} h"},
        ]
        return {"ok": all(c["ok"] for c in checks), "checks": checks}

    main = check(i_land)

    def max_duration_h(i: int) -> float | None:
        """Horas que se puede operar desde i sin violar batería ni comunicación (None si falla al aterrizar)."""
        if not (sun_clear[i] and earth_clear[i]):
            return None
        dark = gap = 0
        for k in range(i, len(lit)):
            dark = 0 if lit[k] else dark + 1
            gap = 0 if earth[k] else gap + 1
            if dark * step_h > rules.battery_hours or gap * step_h > rules.max_comm_gap_hours:
                # La ventana que termina en k-1 todavía cumple (la noche o el hueco caben en la tolerancia)
                return round((k - 1 - i) * step_h, 2)
        return round((len(lit) - 1 - i) * step_h, 2)
    w = slice(i_land, i_land + n_dur + 1)
    first_dark = _first_false(lit[w])
    first_nocomm = _first_false(earth[w])
    t_at = lambda k: et_to_utc(et_land + k * step_s)  # noqa: E731

    reasons = []
    txt = {
        "sol_al_aterrizar": "Al aterrizar el Sol no está despejado (bajo el horizonte, tapado por el terreno o a menos de ε)",
        "tierra_al_aterrizar": "Al aterrizar la Tierra no está despejada: no habría comunicación en el descenso",
        "energia": "Durante la misión hay una noche más larga que la autonomía de la batería",
        "comunicacion": "Durante la misión hay un hueco sin Tierra más largo que el tolerado",
    }
    for c in main["checks"]:
        if not c["ok"]:
            reasons.append(f"{txt[c['id']]} ({c['value']} vs {c['threshold']})")

    # Alternativas: fechas de aterrizaje cercanas que sí cumplen (cada hora), con la misma duración
    # Si no hay ninguna, revisar "max_feasible_duration_days": quizá la misión es más larga de lo que el sitio permite
    alternatives = {"before": None, "after": None, "search_days": search_days}

    def alternative(i: int) -> dict:
        et_alt = et0 + i * step_s
        return {"landing_utc": et_to_utc(et_alt), "departure_utc": et_to_utc(et_alt + duration_days * DAY),
                "shift_days": round((i - i_land) * step_s / DAY, 2)}

    if not main["ok"]:
        stride = max(1, int(round(60 / step_min)))
        last = len(lit) - n_dur - 1
        for i in range(i_land - stride, -1, -stride):
            if check(i)["ok"]:
                alternatives["before"] = alternative(i)
                break
        for i in range(i_land + stride, last + 1, stride):
            if check(i)["ok"]:
                alternatives["after"] = alternative(i)
                break

    out = {
        "meta": meta(),
        "input": {"x_lon": site.lon, "y_lat": site.lat, "landing_utc": landing_utc,
                  "duration_days": round(duration_days, 6), "end_utc": et_to_utc(et_land + duration_days * DAY),
                  "step_min": step_min},
        "site": site.to_dict(),
        "horizon": mask.summary(),
        "rules": rules.to_dict(),
        "result": {
            "is_candidate": main["ok"],
            "label": "CANDIDATO" if main["ok"] else "NO CANDIDATO",
            "reasons": reasons,
            "checks": main["checks"],
            "alternatives": alternatives,
            "max_feasible_duration_days": None if (mh := max_duration_h(i_land)) is None else round(mh / 24, 2),
        },
        "at_landing": sky_now(calc, et_land, settings),
        "during_mission": {
            "pct_sun": round(float(lit[w].mean() * 100), 2),
            "pct_earth": round(float(earth[w].mean() * 100), 2),
            "pct_sun_and_earth": round(float((lit[w] & earth[w]).mean() * 100), 2),
            "pct_sun_blocked_by_terrain": round(float(sun_blk[w].mean() * 100), 2),
            "pct_earth_blocked_by_terrain": round(float(earth_blk[w].mean() * 100), 2),
            "longest_dark_h": round(_longest_false(lit[w]) * step_h, 2),
            "longest_comm_gap_h": round(_longest_false(earth[w]) * step_h, 2),
            "first_sun_loss_utc": None if first_dark is None else t_at(first_dark),
            "first_comm_loss_utc": None if first_nocomm is None else t_at(first_nocomm),
            "events": calc.events(et_land, et_land + duration_days * DAY, step_min),
        },
    }
    if include_series:
        out["series"] = {k: (v[w] if isinstance(v, list) else v) for k, v in sr.items()}
        out["series"]["t_utc"] = [t_at(k) for k in range(n_dur + 1)]
        out["series"]["count"] = n_dur + 1
        out["series"]["start_utc"] = landing_utc
    return out
