"""Posición del Sol y la Tierra vistos desde un sitio lunar (SPICE azlcpo) e interferencia del terreno."""
import math
from dataclasses import dataclass

import numpy as np
import spiceypy as sp

from .config import ABCORR, FRAME, R_EARTH_KM, R_MOON_KM, R_SUN_KM
from .horizon import Mask
from .sites import Site


def utc_to_et(utc: str) -> float:
    return sp.str2et(utc.replace("Z", ""))


def et_to_utc(et: float) -> str:
    return sp.et2utc(et, "ISOC", 0) + "Z"


def disk_fraction(margin_deg: float, radius_deg: float) -> float:
    """Fracción visible de un disco cuyo centro está `margin` grados sobre el horizonte."""
    if margin_deg >= radius_deg:
        return 1.0
    if margin_deg <= -radius_deg:
        return 0.0
    x = margin_deg / radius_deg
    return 1.0 - (math.acos(x) - x * math.sqrt(1 - x * x)) / math.pi


# Estados de la línea de vista de un astro
BAJO_HORIZONTE = "bajo_horizonte"          # no ha salido: está bajo el horizonte ideal (sin terreno)
INTERFERENCIA = "interferencia_terreno"    # ya salió, pero el terreno lo tapa
MARGINAL = "marginal"                      # se ve, pero a menos de ε del terreno
DESPEJADO = "despejado"                    # se ve con al menos ε de margen


def classify(el: float, horizon: float, ideal: float, eps: float) -> str:
    if el <= ideal:
        return BAJO_HORIZONTE
    if el <= horizon:
        return INTERFERENCIA
    if el - horizon < eps:
        return MARGINAL
    return DESPEJADO


@dataclass
class Observer:
    site: Site
    mask: Mask
    pos: np.ndarray  # km, MOON_ME

    @classmethod
    def make(cls, site: Site, mask: Mask) -> "Observer":
        r = R_MOON_KM + ((mask.z_m or 0.0) + mask.h_obs_m) / 1000.0
        pos = np.array(sp.latrec(r, math.radians(site.lon), math.radians(site.lat)))
        return cls(site, mask, pos)


def body_state(obs: Observer, body: str, et: float, eps: float) -> dict:
    st, _ = sp.azlcpo("ELLIPSOID", body, et, ABCORR, False, True, obs.pos, "MOON", FRAME)
    dist, az, el = float(st[0]), math.degrees(st[1]) % 360.0, math.degrees(st[2])
    radius = math.degrees(math.asin((R_SUN_KM if body == "SUN" else R_EARTH_KM) / dist))
    horizon = obs.mask.at(az)
    clearance = el - horizon
    status = classify(el, horizon, obs.mask.ideal_deg, eps)
    return {
        "azimuth_deg": az,
        "elevation_deg": el,
        "horizon_deg": horizon,              # altura del terreno en ese azimut
        "ideal_horizon_deg": obs.mask.ideal_deg,
        "clearance_deg": clearance,          # elevación - terreno (negativo = tapado)
        "epsilon_deg": eps,
        "status": status,
        "terrain_interference": status == INTERFERENCIA,
        "line_of_sight": clearance > 0,
        "angular_radius_deg": radius,
        "visible_fraction": disk_fraction(clearance, radius),
        "distance_km": dist,
    }


def sky(obs: Observer, et: float, eps_sun: float = 0.5, eps_earth: float = 0.5) -> dict:
    sun = body_state(obs, "SUN", et, eps_sun)
    earth = body_state(obs, "EARTH", et, eps_earth)
    sun["visible"] = sun["visible_fraction"] > 0
    earth["visible"] = earth["line_of_sight"]
    return {"et": et, "sun": sun, "earth": earth}
