"""Catálogo de sitios."""
import json
from dataclasses import asdict, dataclass, field

from .config import SITES_FILE


@dataclass
class Site:
    id: str
    name: str
    lat: float
    lon: float
    category: str = "Personalizado"
    verified: bool = True
    source: str = ""
    note: str = ""
    extra: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("extra")
        return d


def load_sites() -> list[Site]:
    raw = json.loads(SITES_FILE.read_text(encoding="utf-8"))
    known = {"id", "name", "lat", "lon", "category", "verified", "source", "note"}
    return [Site(**{k: v for k, v in s.items() if k in known}) for s in raw]


def get_site(site_id: str | None = None, lat: float | None = None, lon: float | None = None) -> Site:
    if site_id:
        for s in load_sites():
            if s.id == site_id:
                return s
        ids = ", ".join(s.id for s in load_sites())
        raise SystemExit(f"Sitio '{site_id}' no existe. Opciones: {ids}")
    if lat is None or lon is None:
        raise SystemExit("Indica --site ID o bien --lat y --lon")
    if not (-90 <= lat <= 90 and -180 <= lon <= 360):
        raise SystemExit("Latitud o longitud fuera de rango")
    lat = max(-89.995, min(89.995, lat))  # evita la singularidad del norte local en el polo
    return Site(id=f"custom_{lat:.4f}_{lon:.4f}", name="Coordenada personalizada", lat=lat, lon=lon)
