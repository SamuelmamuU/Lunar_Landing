"""Evaluación de un punto (x = longitud, y = latitud) entre una fecha de inicio y una de fin.

Regla de CANDIDATO en cada instante t (con ε):
  1. Sol despejado:    elevación_sol  - terreno >= ε_sol
  2. Tierra despejada: elevación_tierra - terreno >= ε_tierra
  3. Desde t quedan >= min_light_hours de Sol visible
  4. Desde t quedan >= min_comm_hours de Tierra visible

Ventana de aterrizaje = tramo continuo donde se cumplen las 4 reglas.
El punto es CANDIDATO en el rango si existe al menos una ventana de aterrizaje.
"""
from datetime import datetime, timezone

import numpy as np

from . import kernels
from .analysis import DAY, HOUR, Calc
from .geometry import et_to_utc, utc_to_et
from .report import Settings, make_calc, meta, sky_now
from .sites import Site

MAX_RANGE_DAYS = 366
MAX_SAMPLES = 6000


def parse_utc(text: str) -> str:
    """Acepta '2026-11-14', '2026-11-14T18:00', '2026-11-14T18:00:00Z'. Devuelve ISO UTC con Z."""
    t = text.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(t)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def auto_step_min(days: float) -> float:
    """Paso de muestreo para no pasar de ~MAX_SAMPLES (mínimo 10 min)."""
    return float(max(10, int(np.ceil(days * 1440 / MAX_SAMPLES / 10.0)) * 10))


def _hours_remaining(flags: np.ndarray, step_h: float) -> np.ndarray:
    """Para cada muestra: horas que el estado sigue siendo verdadero desde ahí (0 si es falso)."""
    out = np.zeros(len(flags))
    run = 0.0
    for i in range(len(flags) - 1, -1, -1):
        run = run + step_h if flags[i] else 0.0
        out[i] = run
    return out


def _runs(flags: np.ndarray, t_utc: list[str], step_h: float) -> list[dict]:
    windows, start = [], None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        if (not f or i == len(flags) - 1) and start is not None:
            end = i if f else i - 1
            windows.append({"start_utc": t_utc[start], "end_utc": t_utc[end],
                            "duration_h": round((end - start + 1) * step_h, 2)})
            start = None
    return windows


def evaluate(site: Site, start_utc: str, end_utc: str, s: Settings,
             step_min: float | None = None, include_series: bool = False, include_events: bool = True) -> dict:
    kernels.load()
    start_utc, end_utc = parse_utc(start_utc), parse_utc(end_utc)
    et0, et1 = utc_to_et(start_utc), utc_to_et(end_utc)
    days = (et1 - et0) / DAY
    if days <= 0:
        raise ValueError("La fecha de fin debe ser posterior a la de inicio")
    if days > MAX_RANGE_DAYS:
        raise ValueError(f"El rango máximo es {MAX_RANGE_DAYS} días")
    step = step_min or auto_step_min(days)
    step_h = step / 60.0

    calc, mask = make_calc(site, s)
    # Se calcula un poco más allá del fin para saber cuánta luz/comunicación queda en las últimas horas
    look_h = max(s.min_light_hours, s.min_comm_hours)
    sr = calc.series(et0, et1 + look_h * HOUR, step)
    n_range = int(round((et1 - et0) / (step * 60))) + 1

    lit = np.array(sr["sun_frac"]) > 0
    earth = np.array(sr["earth_visible"])
    sun_left = _hours_remaining(lit, step_h)
    earth_left = _hours_remaining(earth, step_h)
    # La cola extra no se conoce completa: si llega al final, se da por cumplido
    tail_end = len(lit) - 1
    sun_ok = (sun_left >= s.min_light_hours) | (lit & (np.arange(len(lit)) + sun_left / step_h > tail_end))
    earth_ok = (earth_left >= s.min_comm_hours) | (earth & (np.arange(len(earth)) + earth_left / step_h > tail_end))
    cand = (np.array(sr["sun_clear"]) & np.array(sr["earth_clear"]) & sun_ok & earth_ok)[:n_range]

    t_utc = [et_to_utc(et0 + i * step * 60) for i in range(n_range)]
    windows = _runs(cand, t_utc, step_h)
    rng = {k: v[:n_range] if isinstance(v, list) else v for k, v in sr.items()}
    rng["count"] = n_range
    m = Calc.metrics(rng)
    m["pct_time_candidate"] = round(float(cand.mean() * 100), 2)

    is_cand = bool(windows)
    best = max(windows, key=lambda w: w["duration_h"]) if windows else None
    if is_cand:
        reasons = []
    else:
        reasons = []
        if not np.any(np.array(rng["sun_clear"])):
            reasons.append("El Sol nunca está despejado (≥ ε) en el rango")
        if not np.any(np.array(rng["earth_clear"])):
            reasons.append("La Tierra nunca está despejada (≥ ε) en el rango")
        if not reasons:
            reasons.append("Sol y Tierra no coinciden despejados con suficiente luz y comunicación por delante")
        if m["pct_sun_blocked_by_terrain"] > 0:
            reasons.append(f"El terreno tapa el Sol el {m['pct_sun_blocked_by_terrain']}% del tiempo")
        if m["pct_earth_blocked_by_terrain"] > 0:
            reasons.append(f"El terreno tapa la Tierra el {m['pct_earth_blocked_by_terrain']}% del tiempo")

    out = {
        "meta": meta(),
        "input": {"x_lon": site.lon, "y_lat": site.lat, "start_utc": start_utc, "end_utc": end_utc,
                  "days": round(days, 3), "step_min": step},
        "site": site.to_dict(),
        "horizon": mask.summary(),
        "settings": s.to_dict(),
        "result": {
            "is_candidate": is_cand,
            "label": "CANDIDATO" if is_cand else "NO CANDIDATO",
            "first_landing_utc": windows[0]["start_utc"] if windows else None,
            "best_window": best,
            "landing_windows": windows,
            "reasons": reasons,
        },
        "at_start": sky_now(calc, et0, s),
        "metrics": m,
    }
    if include_events:
        out["events"] = calc.events(et0, et1, step)
    if include_series:
        rng["t_utc"] = t_utc
        rng["candidate"] = [bool(x) for x in cand]
        out["series"] = rng
    return out
