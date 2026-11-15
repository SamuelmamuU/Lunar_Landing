"""Carga de kernels SPICE (una sola vez por proceso) y candado para usar SPICE desde varios hilos."""
import functools
import glob
import threading
from pathlib import Path

import spiceypy as sp

from .config import KERNELS_DIR

_loaded: str | None = None

# CSPICE no es seguro con hilos: dos llamadas simultáneas corrompen su estado (errores SPICE falsos como
# NOFRAMECONNECT y, a veces, el proceso se cae). FastAPI atiende los endpoints `def` en varios hilos, así que
# todo cálculo con SPICE pasa por este candado. Es reentrante: una función protegida puede llamar a otra.
LOCK = threading.RLock()


def serialized(fn):
    """Decorador: ejecuta `fn` con el candado de SPICE (las peticiones simultáneas esperan su turno)."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        with LOCK:
            return fn(*args, **kwargs)
    return wrapper


def _first(pattern: str) -> str | None:
    hits = sorted(glob.glob(str(KERNELS_DIR / pattern)))
    return hits[-1] if hits else None


@serialized
def load() -> str:
    """Carga DE440 si está completo; si no, el juego DE421 incluido. Devuelve la etiqueta."""
    global _loaded
    if _loaded:
        return _loaded
    lsk = _first("naif00*.tls")
    if not lsk:
        raise FileNotFoundError(f"Falta naif0012.tls en {KERNELS_DIR}")
    sets = {
        "DE440": [_first("de440*.bsp"), _first("moon_pa_de440_*.bpc"), _first("moon_de440_*.tf")],
        "DE421": [_first("de421.bsp"), _first("moon_pa_de421_*.bpc"), _first("moon_080317.tf")],
    }
    for label, files in sets.items():
        if all(files):
            sp.kclear()
            for k in [lsk, *files, _first("pck000*.tpc")]:
                if k:
                    sp.furnsh(k)
            _loaded = label
            return label
    raise FileNotFoundError(f"No hay un juego completo de kernels en {KERNELS_DIR}")


@serialized
def loaded_files() -> list[str]:
    n = sp.ktotal("ALL")
    return [Path(sp.kdata(i, "ALL")[0]).name for i in range(n)]
