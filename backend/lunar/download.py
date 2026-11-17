"""Descarga kernels SPICE (DE440) y DEMs de LOLA desde NASA."""
import re
from pathlib import Path
from urllib.parse import urljoin

from .config import DEM_DIR, KERNELS_DIR

NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
KERNELS = [
    ("lsk/", r"naif0012\.tls$"),
    ("spk/planets/", r"de440s\.bsp$"),
    ("pck/", r"moon_pa_de440_200625\.bpc$"),
    ("pck/", r"pck00011\.tpc$"),
    ("fk/satellites/", r"moon_de440_\d+\.tf$"),
]
DEM_INDEXES = {
    "PGDA 5 m/px 87-90°S (terreno cercano)": "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/",
    "PGDA producto 90: 80-90°S a 20/40/80 m (terreno lejano)": "https://pgda.gsfc.nasa.gov/products/90",
}


def _links(url: str, pattern: str) -> list[str]:
    import requests

    r = requests.get(url, timeout=60)
    r.raise_for_status()
    hrefs = re.findall(r'href="([^"?#]+)"', r.text)
    return sorted({urljoin(url, h) for h in hrefs if re.search(pattern, h.split("/")[-1], re.I)})


def download(url: str, dest: Path) -> Path:
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return dest
    # Se escribe en .part y se renombra al terminar: una descarga cortada no queda como archivo "completo"
    part = dest.with_name(dest.name + ".part")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        done = 0
        with open(part, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
                done += len(chunk)
                if total:
                    print(f"\r  {dest.name}: {done / 1e6:.0f}/{total / 1e6:.0f} MB", end="", flush=True)
    print()
    if total and done != total:
        raise IOError(f"{dest.name}: descarga incompleta ({done} de {total} bytes)")
    part.replace(dest)
    return dest


def get_kernels() -> list[str]:
    got = []
    for sub, pat in KERNELS:
        hits = _links(NAIF + sub, pat)
        if hits:
            got.append(str(download(hits[-1], KERNELS_DIR / hits[-1].split("/")[-1])))
    return got


def list_dems() -> dict:
    out = {}
    for label, url in DEM_INDEXES.items():
        try:
            out[label] = _links(url, r"(ldem|surf).*\.tif$")
        except Exception as e:  # noqa: BLE001
            out[label] = [f"No se pudo leer {url}: {e}. Ábrelo en el navegador."]
    return out


def get_dem(url: str) -> str:
    return str(download(url, DEM_DIR / url.split("/")[-1]))


# ------------------------------------------------------------------ DEM global (LOLA LDEM_64, ~474 m/px)
# Nodo de Geociencias de la PDS (mismo archivo que imbrium.mit.edu, que va a ~15 KB/s)
GLOBAL_DEM_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/"
GLOBAL_DEM_NAME = "ldem_64"
GLOBAL_DEM_TIF = "LDEM_64_global.tif"
R_REF_M = 1737400.0


def _pds_label(text: str) -> dict:
    """Pares CLAVE = valor de una etiqueta PDS3 (se queda con la primera aparición de cada clave)."""
    out: dict = {}
    for m in re.finditer(r"^\s*([A-Z_]+)\s*=\s*(.+?)\s*$", text, re.M):
        out.setdefault(m.group(1), m.group(2).strip().strip('"').strip("'"))
    return out


def get_global_dem() -> str:
    """Descarga LDEM_64 (PDS, 0..360°E, enteros con OFFSET de radio) y lo convierte en data/dem/LDEM_64_global.tif."""
    raw = DEM_DIR / "raw"   # fuera del patrón de auto_dems(): el .IMG crudo no debe leerse directamente
    lbl = download(GLOBAL_DEM_URL + GLOBAL_DEM_NAME + ".lbl", raw / (GLOBAL_DEM_NAME + ".lbl"))
    img = download(GLOBAL_DEM_URL + GLOBAL_DEM_NAME + ".img", raw / (GLOBAL_DEM_NAME + ".img"))
    return str(convert_global_dem(img, lbl, DEM_DIR / GLOBAL_DEM_TIF))


def convert_global_dem(img: Path, lbl: Path, out: Path) -> Path:
    """IMG de LOLA (cilíndrico simple, 0..360°E) -> GeoTIFF compatible con horizon.py.

    - Longitudes -180..180 (como el resto del backend) con 1° repetido a cada lado para que los rayos que cruzan
      el antimeridiano no se queden sin dato.
    - Altura en metros sobre la esfera de 1737.4 km (DN × SCALING_FACTOR), igual que el DEM polar. El OFFSET de la
      etiqueta es el radio de referencia y NO se aplica: si GDAL lo leyera, cada punto quedaría 1737 km más alto.
    """
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin

    lab = _pds_label(lbl.read_text(encoding="latin-1"))

    def num(key: str) -> float:
        return float(lab[key].split()[0])

    expected = {"SAMPLE_TYPE": "LSB_INTEGER", "SAMPLE_BITS": "16", "MAP_PROJECTION_TYPE": "SIMPLE CYLINDRICAL",
                "POSITIVE_LONGITUDE_DIRECTION": "EAST"}
    bad = {k: lab.get(k) for k, v in expected.items() if lab.get(k) != v}
    if bad:
        raise ValueError(f"Etiqueta {lbl.name} inesperada: {bad}")
    if (num("WESTERNMOST_LONGITUDE"), num("EASTERNMOST_LONGITUDE"), num("MINIMUM_LATITUDE"),
            num("MAXIMUM_LATITUDE"), num("A_AXIS_RADIUS") * 1000, num("OFFSET")) != (0, 360, -90, 90, R_REF_M, R_REF_M):
        raise ValueError(f"Cobertura, radio u OFFSET inesperados en {lbl.name}")
    ppd, lines, samples, scale = num("MAP_RESOLUTION"), int(num("LINES")), int(num("LINE_SAMPLES")), num("SCALING_FACTOR")
    if (lines, samples) != (round(180 * ppd), round(360 * ppd)):
        raise ValueError("LINES/LINE_SAMPLES no coinciden con MAP_RESOLUTION global")

    dn = np.fromfile(img, dtype="<i2")
    if dn.size != lines * samples:
        raise ValueError(f"{img.name}: {dn.size} muestras, se esperaban {lines * samples}")
    dn = np.roll(dn.reshape(lines, samples), -samples // 2, axis=1)   # columna 0 = 180°E = -180°
    wrap = int(ppd)                                                    # 1° repetido a cada lado
    dn = np.pad(dn, ((0, 0), (wrap, wrap)), mode="wrap")

    m_per_deg = R_REF_M * np.pi / 180.0
    px = m_per_deg / ppd
    transform = from_origin((-180.0 - wrap / ppd) * m_per_deg, 90.0 * m_per_deg, px, px)
    crs = f"+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R={R_REF_M:.0f} +units=m +no_defs"
    out.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(out, "w", driver="GTiff", width=dn.shape[1], height=dn.shape[0], count=1, dtype="int16",
                       crs=crs, transform=transform, tiled=True, compress="deflate", predictor=2,
                       BIGTIFF="IF_SAFER") as dst:
        dst.write(dn, 1)
        dst.scales = (scale,)
        dst.offsets = (0.0,)
    return out


SOUTH_POLE_DEM_TIF = "LDEM_80S_80MPP_ADJ.TIF"
SOUTH_POLE_DEM_FALLBACK_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF"


def ensure_south_pole_dem() -> str | None:
    """Garantiza que LDEM_80S_80MPP_ADJ.TIF exista en data/dem/; si no está, lo descarga desde NASA PGDA."""
    dest = DEM_DIR / SOUTH_POLE_DEM_TIF
    if dest.exists():
        return str(dest)
    try:
        hits = _links(
            "https://pgda.gsfc.nasa.gov/products/90",
            r"ldem_80s_80mpp_adj\.tif$",
        )
        url = hits[0] if hits else SOUTH_POLE_DEM_FALLBACK_URL
        return str(download(url, dest))
    except Exception as exc:  # noqa: BLE001
        print(f"Aviso: no se pudo descargar {SOUTH_POLE_DEM_TIF}: {exc}")
        return None
