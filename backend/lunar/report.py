"""Arma los JSON de salida. Todas las fechas en UTC ISO-8601 con 'Z'."""
from . import kernels
from .analysis import DAY, EARTH, HOUR, LIT, Calc, candidate
from .config import (ABCORR, DEFAULT_EPS_EARTH_DEG, DEFAULT_EPS_SUN_DEG, DEFAULT_H_OBS_M, DEFAULT_MIN_COMM_HOURS,
                     DEFAULT_MIN_LIGHT_HOURS, FRAME)
from .geometry import Observer, et_to_utc, orbital_vectors_3d, utc_to_et
from .horizon import mask_for
from .sites import Site

SCHEMA_VERSION = "1.0"


def _round(d: dict, nd: int = 4) -> dict:
    return {k: (round(v, nd) if isinstance(v, float) else v) for k, v in d.items()}


def meta() -> dict:
    return {"schema": SCHEMA_VERSION, "kernels": kernels.load(), "frame": FRAME, "abcorr": ABCORR,
            "angles": "grados; azimut desde el norte en sentido horario; elevación sobre el horizonte local"}


class Settings:
    """Supuestos de la evaluación. ε = margen angular mínimo (grados) entre el astro y la silueta del terreno."""

    def __init__(self, h_obs_m=DEFAULT_H_OBS_M, eps_sun_deg=DEFAULT_EPS_SUN_DEG, eps_earth_deg=DEFAULT_EPS_EARTH_DEG,
                 min_light_hours=DEFAULT_MIN_LIGHT_HOURS, min_comm_hours=DEFAULT_MIN_COMM_HOURS):
        self.h_obs_m = h_obs_m
        self.eps_sun_deg = eps_sun_deg
        self.eps_earth_deg = eps_earth_deg
        self.min_light_hours = min_light_hours
        self.min_comm_hours = min_comm_hours

    def to_dict(self):
        return {"h_obs_m": self.h_obs_m, "eps_sun_deg": self.eps_sun_deg, "eps_earth_deg": self.eps_earth_deg,
                "min_light_hours": self.min_light_hours, "min_comm_hours": self.min_comm_hours}


def make_calc(site: Site, s: Settings) -> tuple[Calc, object]:
    kernels.load()
    mask = mask_for(site, s.h_obs_m)
    return Calc(Observer.make(site, mask), s.eps_sun_deg, s.eps_earth_deg), mask


def sky_now(calc: Calc, et: float, s: Settings) -> dict:
    now = calc.sky(et)
    t_sun = calc.next_change(et, LIT)
    t_earth = calc.next_change(et, EARTH)
    lit, up = now["sun"]["visible"], now["earth"]["visible"]
    h_sun = None if t_sun is None else (t_sun - et) / HOUR
    h_earth = None if t_earth is None else (t_earth - et) / HOUR
    return {
        "utc": et_to_utc(et),
        "sun": _round(now["sun"]),
        "earth": _round(now["earth"]),
        "next": {
            "sun_event": ("sunset" if lit else "sunrise") if t_sun else None,
            "sun_event_utc": et_to_utc(t_sun) if t_sun else None,
            "hours_to_sun_event": None if h_sun is None else round(h_sun, 3),
            "earth_event": ("earthset" if up else "earthrise") if t_earth else None,
            "earth_event_utc": et_to_utc(t_earth) if t_earth else None,
            "hours_to_earth_event": None if h_earth is None else round(h_earth, 3),
            "search_limit_days": 60,
        },
        "candidate": candidate(now, h_sun, h_earth, s.min_light_hours, s.min_comm_hours),
        "vectors_3d": orbital_vectors_3d(calc.obs, et),
    }


def report(site: Site, utc: str, days: float, step_min: float, s: Settings,
           with_series: bool = False, with_events: bool = True) -> dict:
    calc, mask = make_calc(site, s)
    et = utc_to_et(utc)
    et1 = et + days * DAY
    sr = calc.series(et, et1, step_min)
    out = {
        "meta": meta(),
        "site": site.to_dict(),
        "horizon": mask.summary(),
        "settings": s.to_dict(),
        "now": sky_now(calc, et, s),
        "window": {
            "start_utc": et_to_utc(et),
            "end_utc": et_to_utc(et1),
            "days": days,
            "step_min": step_min,
            "metrics": Calc.metrics(sr),
        },
    }
    if with_events:
        out["window"]["events"] = calc.events(et, et1, step_min)
    if with_series:
        out["series"] = sr
    return out
