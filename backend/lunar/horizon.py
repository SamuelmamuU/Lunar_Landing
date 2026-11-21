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
import os
import threading

import numpy as np

from .config import DEFAULT_H_OBS_M, HORIZONS_FILE, R_MOON_KM
from .sites import Site

R_M = R_MOON_KM * 1000.0
DEFAULT_MAX_PX = int(os.environ.get("DEM_MAX_PX", "8000"))


class Mask:
    def __init__(
        self,
        deg: np.ndarray,
        terrain: bool,
        z_m: float | None,
        h_obs_m: float,
        dem: list[str],
        local_dem: dict | None = None,
    ):
        self.deg = np.asarray(deg, dtype=float)
        self.n = len(self.deg)
        self.step = 360.0 / self.n
        self.terrain = terrain
        self.z_m = z_m
        self.h_obs_m = h_obs_m
        self.dem = dem
        self.local_dem = local_dem
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
            d["local_dem"] = self.local_dem
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
_local_dem_cache: dict = {}


def auto_dems() -> "DemStack | None":
    """DEMs en data/dem/ (GeoTIFF o IMG), del más fino al más grueso. Se cargan una sola vez (~4 s el de 80 m/px)."""
    with _dem_lock:
        return _load_dems()


def _load_dems() -> "DemStack | None":
    global _dem_cache
    if _dem_cache is False:
        from .config import DATA_DIR, DEM_DIR

        # Un solo patrón por extensión: en Windows glob no distingue mayúsculas y "*.tif" + "*.TIF" duplicaba el DEM
        files = sorted(f for f in DEM_DIR.glob("*") if f.is_file() and f.suffix.lower() in (".tif", ".img"))
        if not files:
            files = sorted(f for f in DATA_DIR.glob("*") if f.is_file() and f.suffix.lower() in (".tif", ".img"))
        if not files:
            _dem_cache = None
        else:
            try:
                stack = DemStack([str(f) for f in files])
                stack.dems.sort(key=lambda d: d.px_m)
                _dem_cache = stack
            except Exception as exc:  # noqa: BLE001
                print(f"Error cargando DEMs {files}: {exc}")
                _dem_cache = None
    return _dem_cache


def mask_for(site: Site, h_obs_m: float = DEFAULT_H_OBS_M, compute: bool = True, az_step: float = 1.0) -> Mask:
    """Horizonte del sitio: guardado en horizons.json > calculado con DEMs de data/dem/ > esfera lisa."""
    rec = _stored().get(site.id)
    if rec and abs(rec.get("h_obs_m", h_obs_m) - h_obs_m) < 1e-6:
        m = Mask(np.array(rec["horizon_deg"]), True, rec.get("z_m"), h_obs_m, rec.get("dem", []))
        if compute:
            m.local_dem = local_dem_for(site, m.z_m, m.deg)
        return m
    if compute:
        key = (round(site.lat, 4), round(site.lon, 4), h_obs_m, az_step)
        if key in _mask_cache:
            return _mask_cache[key]
        dems = auto_dems()
        if dems:
            m = compute_mask(site, dems, h_obs_m, az_step, n_d=600)
            if m.terrain:
                m.local_dem = local_dem_for(site, m.z_m, m.deg, dems=dems)
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
            raw = ds.read(1, out_shape=shape, masked=False)
            nodata = ds.nodata
            scale = float((ds.scales or [1.0])[0] or 1.0)
            offset = float((ds.offsets or [0.0])[0] or 0.0)
            z = raw if raw.dtype == np.float32 else raw.astype(np.float32)
            if nodata is not None and not math.isnan(float(nodata)):
                z[raw == nodata] = np.nan
            del raw
            if scale != 1.0:
                z *= np.float32(scale)
            if offset != 0.0:
                z += np.float32(offset)
            self.z = z
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

    def __init__(self, paths: list[str], max_px: int = DEFAULT_MAX_PX):
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


def _step_latlon(lat0: float, lon0: float, az_rad: np.ndarray, dist_m: np.ndarray):
    p1, l1 = math.radians(lat0), math.radians(lon0)
    D = np.asarray(dist_m, dtype=float) / R_M
    A = np.asarray(az_rad, dtype=float)
    sp2 = np.sin(p1) * np.cos(D) + np.cos(p1) * np.sin(D) * np.cos(A)
    p2 = np.arcsin(np.clip(sp2, -1, 1))
    l2 = l1 + np.arctan2(np.sin(A) * np.sin(D) * np.cos(p1), np.cos(D) - np.sin(p1) * sp2)
    return np.degrees(p2), (np.degrees(l2) + 180) % 360 - 180


def _destination(lat0, lon0, az, dist):
    return _step_latlon(lat0, lon0, az[:, None], dist[None, :])


def _fill_nan_nearest(grid: np.ndarray) -> np.ndarray:
    """Rellena celdas NaN usando la celda válida más cercana."""
    if np.isfinite(grid).all():
        return grid
    from scipy.ndimage import distance_transform_edt

    invalid = ~np.isfinite(grid)
    indices = distance_transform_edt(invalid, return_distances=False, return_indices=True)
    return grid[tuple(indices)]


def _profile_heightfield(
    center_z: float,
    profile_deg: np.ndarray,
    az_rad_grid: np.ndarray,
    dist_grid: np.ndarray,
    half_extent_m: float,
) -> np.ndarray:
    """Relieve sintético suave coherente con el perfil direccional del horizonte."""
    prof = np.asarray(profile_deg, dtype=float)
    step = 360.0 / len(prof)
    az_deg = np.degrees(az_rad_grid) % 360.0
    f = az_deg / step
    i0 = np.floor(f).astype(int) % len(prof)
    i1 = (i0 + 1) % len(prof)
    w = f - np.floor(f)
    h_deg = prof[i0] * (1.0 - w) + prof[i1] * w
    slope = np.tan(np.radians(np.clip(h_deg, -2.0, 35.0)))
    blend = 1.0 - np.exp(-((dist_grid / (half_extent_m * 0.35)) ** 2))
    return center_z + slope * dist_grid * blend


def compute_local_dem(
    site: Site,
    dems: "DemStack | None",
    z_m: float | None = None,
    profile_deg: np.ndarray | None = None,
    size: int = 64,
    extent_m: float = 16000.0,
) -> dict | None:
    """Grilla topocéntrica NxN centrada en el sitio (r: Norte->Sur, c: Oeste->Este)."""
    half = extent_m / 2.0
    east_1d = np.linspace(-half, half, size)
    north_1d = np.linspace(half, -half, size)
    east_grid, north_grid = np.meshgrid(east_1d, north_1d)
    dist_grid = np.hypot(east_grid, north_grid)
    az_rad_grid = np.arctan2(east_grid, north_grid)

    heights: np.ndarray | None = None
    center_z = z_m
    if dems is not None:
        lat_grid, lon_grid = _step_latlon(site.lat, site.lon, az_rad_grid, dist_grid)
        zt = dems.sample(lat_grid, lon_grid)
        if np.isfinite(zt).any():
            heights = _fill_nan_nearest(np.asarray(zt, dtype=float))
            if center_z is None or not math.isfinite(center_z):
                z0 = float(dems.sample(np.array([site.lat]), np.array([site.lon]))[0])
                center_z = z0 if math.isfinite(z0) else float(heights[size // 2, size // 2])

    if heights is None:
        if center_z is None or not math.isfinite(center_z) or profile_deg is None or len(profile_deg) == 0:
            return None
        heights = _profile_heightfield(float(center_z), profile_deg, az_rad_grid, dist_grid, half)

    min_z = min(float(np.min(heights)), float(center_z))
    max_z = max(float(np.max(heights)), float(center_z))
    return {
        "size": size,
        "extent_m": round(float(extent_m), 1),
        "step_m": round(float(extent_m / (size - 1)), 3),
        "center_z_m": round(float(center_z), 2),
        "min_z_m": round(min_z, 2),
        "max_z_m": round(max_z, 2),
        "heights_m": [[round(float(v), 2) for v in row] for row in heights],
    }


def local_dem_for(
    site: Site,
    z_m: float | None = None,
    profile_deg: np.ndarray | None = None,
    size: int = 64,
    extent_m: float = 16000.0,
    dems: "DemStack | None" = None,
) -> dict | None:
    key = (round(site.lat, 4), round(site.lon, 4), size, round(extent_m, 1), z_m is not None)
    if key in _local_dem_cache:
        return _local_dem_cache[key]
    stack = dems if dems is not None else auto_dems()
    patch = compute_local_dem(site, stack, z_m, profile_deg, size=size, extent_m=extent_m)
    _local_dem_cache[key] = patch
    return patch


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
    sphere = -math.degrees(math.acos(R_M / (R_M + h_obs_m)))
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
