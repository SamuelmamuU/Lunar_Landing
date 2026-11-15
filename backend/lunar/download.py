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
