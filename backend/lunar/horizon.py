"""Máscaras de horizonte.

Sin DEM: esfera lisa de 1737.4 km (el horizonte queda ~0.09° bajo la horizontal para 2 m).
Con DEM de LOLA: se lanzan rayos en azimut y se guarda la elevación máxima del terreno,
corregida por curvatura:

    alpha(s) = atan((r_t*cos(theta) - r_o) / (r_t*sin(theta))),  theta = s / R
    H(az)    = max_s alpha(s)

Las máscaras calculadas se guardan en data/horizons.json para no recalcular.
"""
import json
import math
import threading

import numpy as np

from .config import DEFAULT_H_OBS_M, HORIZONS_FILE, R_MOON_KM
from .sites import Site

R_M = R_MOON_KM * 1000.0


class Mask:
    def __init__(self, deg: np.ndarray, terrain: bool, z_m: float | None, h_obs_m: float, dem: list[str]):
        self.deg = np.asarray(deg, dtype=float)
        self.n = len(self.deg)
        self.step = 360.0 / self.n
        self.terrain = terrain
        self.z_m = z_m
        self.h_obs_m = h_obs_m
        self.dem = dem
        # Horizonte "ideal" (esfera lisa vista desde h_obs): lo que habría sin terreno
        self.ideal_deg = -math.degrees(math.acos(R_M / (R_M + h_obs_m)))

    def at(self, az_deg: float) -> float:
        f = (az_deg % 360.0) / self.step
        i = int(math.floor(f)) % self.n
        j = (i + 1) % self.n
        w = f - math.floor(f)
        return float(self.deg[i] * (1 - w) + self.deg[j] * w)

    def summary(self, include_profile: bool = True) -> dict:
        d = {
            "terrain": self.terrain,
            "dem": self.dem,
            "z_m": self.z_m,
            "h_obs_m": self.h_obs_m,
            "az_step_deg": self.step,
            "max_deg": round(float(self.deg.max()), 3),
            "min_deg": round(float(self.deg.min()), 3),
        }
        if include_profile:
            d["profile_deg"] = [round(float(v), 3) for v in self.deg]
        return d


def sphere_mask(h_obs_m: float = DEFAULT_H_OBS_M, n: int = 360) -> Mask:
    dip = -math.degrees(math.acos(R_M / (R_M + h_obs_m)))
    return Mask(np.full(n, dip), terrain=False, z_m=None, h_obs_m=h_obs_m, dem=[])


def _stored() -> dict:
    if HORIZONS_FILE.exists():
        return json.loads(HORIZONS_FILE.read_text(encoding="utf-8"))
    return {}


_dem_cache: "DemStack | None | bool" = False   # False = aún no buscado
_dem_lock = threading.Lock()   # la API precarga en un hilo; una petición simultánea espera esa misma carga
_mask_cache: dict = {}


def auto_dems() -> "DemStack | None":
    """DEMs en data/dem/ (GeoTIFF o IMG), del más fino al más grueso. Se cargan una sola vez (~4 s el de 80 m/px)."""
    with _dem_lock:
        return _load_dems()


def _load_dems() -> "DemStack | None":
    global _dem_cache
    if _dem_cache is False:
        from .config import DEM_DIR

        # Un solo patrón por extensión: en Windows glob no distingue mayúsculas y "*.tif" + "*.TIF" duplicaba el DEM
        files = sorted(f for f in DEM_DIR.glob("*") if f.is_file() and f.suffix.lower() in (".tif", ".img"))
        if not files:
            _dem_cache = None
        else:
            try:
                stack = DemStack([str(f) for f in files])
                stack.dems.sort(key=lambda d: d.px_m)
                _dem_cache = stack
            except ImportError:
                _dem_cache = None  # falta rasterio/pyproj/scipy
    return _dem_cache


def mask_for(site: Site, h_obs_m: float = DEFAULT_H_OBS_M, compute: bool = True, az_step: float = 1.0) -> Mask:
    """Horizonte del sitio: guardado en horizons.json > calculado con DEMs de data/dem/ > esfera lisa."""
    rec = _stored().get(site.id)
    if rec and abs(rec.get("h_obs_m", h_obs_m) - h_obs_m) < 1e-6:
        return Mask(np.array(rec["horizon_deg"]), True, rec.get("z_m"), h_obs_m, rec.get("dem", []))
    if compute:
        key = (round(site.lat, 4), round(site.lon, 4), h_obs_m, az_step)
        if key in _mask_cache:
            return _mask_cache[key]
        dems = auto_dems()
        if dems:
            m = compute_mask(site, dems, h_obs_m, az_step, n_d=600)
            _mask_cache[key] = m
            return m
    return sphere_mask(h_obs_m)


# ------------------------------------------------------------------ cálculo con DEM
class _Dem:
    def __init__(self, path: str, max_px: int):
        import rasterio
        from pyproj import CRS, Transformer

        with rasterio.open(path) as ds:
            f = max(1, math.ceil(max(ds.width, ds.height) / max_px))
            shape = (ds.height // f, ds.width // f)
            arr = ds.read(1, out_shape=shape, masked=True).astype("float64")
            scale = (ds.scales or [1.0])[0] or 1.0
            offset = (ds.offsets or [0.0])[0] or 0.0
            self.z = np.where(arr.mask, np.nan, arr.data * scale + offset)
            self.transform = ds.transform * ds.transform.scale(ds.width / shape[1], ds.height / shape[0])
            crs = ds.crs
        self.inv = ~self.transform
        self.tr = Transformer.from_crs(CRS.from_proj4(f"+proj=longlat +R={R_M} +no_defs"), crs, always_xy=True)
        self.name = path.replace("\\", "/").split("/")[-1]
        self.px_m = abs(self.transform.a)

    def sample(self, lat, lon):
        from scipy.ndimage import map_coordinates

        x, y = self.tr.transform(lon, lat)
        col, row = self.inv * (np.asarray(x), np.asarray(y))
        return map_coordinates(self.z, [np.ravel(row) - 0.5, np.ravel(col) - 0.5],
                               order=1, mode="constant", cval=np.nan).reshape(np.shape(lat))


class DemStack:
    """DEMs ordenados del más fino al más grueso."""

    def __init__(self, paths: list[str], max_px: int = 8000):
        self.dems = [_Dem(p, max_px) for p in paths]

    def sample(self, lat, lon):
        out = np.full(np.shape(lat), np.nan)
        for d in self.dems:
            miss = np.isnan(out)
            if not miss.any():
                break
            out[miss] = d.sample(lat[miss], lon[miss])
        return out

    def describe(self) -> list[str]:
        return [f"{d.name} (~{d.px_m:.0f} m/px)" for d in self.dems]


def _destination(lat0, lon0, az, dist):
    p1, l1 = math.radians(lat0), math.radians(lon0)
    D = dist[None, :] / R_M
    A = az[:, None]
    sp2 = np.sin(p1) * np.cos(D) + np.cos(p1) * np.sin(D) * np.cos(A)
    p2 = np.arcsin(np.clip(sp2, -1, 1))
    l2 = l1 + np.arctan2(np.sin(A) * np.sin(D) * np.cos(p1), np.cos(D) - np.sin(p1) * sp2)
    return np.degrees(p2), (np.degrees(l2) + 180) % 360 - 180


def compute_mask(site: Site, dems: DemStack, h_obs_m=DEFAULT_H_OBS_M, az_step=0.25,
                 d_min=20.0, d_max=200e3, n_d=900) -> Mask:
    az = np.radians(np.arange(0, 360, az_step))
    dist = np.geomspace(d_min, d_max, n_d)
    theta = dist / R_M
    z0 = float(dems.sample(np.array([site.lat]), np.array([site.lon]))[0])
    if math.isnan(z0):
        return sphere_mask(h_obs_m, len(az))
    lat, lon = _destination(site.lat, site.lon, az, dist)
    zt = dems.sample(lat, lon)
    r_o = R_M + z0 + h_obs_m
    r_t = R_M + zt
    alpha = np.degrees(np.arctan2(r_t * np.cos(theta) - r_o, r_t * np.sin(theta)))
    sphere = np.degrees(np.arctan2(R_M * np.cos(theta) - r_o, R_M * np.sin(theta))).max()
    H = np.nanmax(np.where(np.isnan(alpha), sphere, alpha), axis=1)
    return Mask(H, True, z0, h_obs_m, dems.describe())


def save_mask(site: Site, mask: Mask) -> None:
    data = _stored()
    data[site.id] = {
        "lat": site.lat, "lon": site.lon, "h_obs_m": mask.h_obs_m, "z_m": mask.z_m,
        "dem": mask.dem, "az_step_deg": mask.step,
        "horizon_deg": [round(float(v), 3) for v in mask.deg],
    }
    HORIZONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    HORIZONS_FILE.write_text(json.dumps(data), encoding="utf-8")
