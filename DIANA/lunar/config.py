from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KERNELS_DIR = ROOT / "kernels"
DATA_DIR = ROOT / "data"
DEM_DIR = DATA_DIR / "dem"
HORIZONS_FILE = DATA_DIR / "horizons.json"
SITES_FILE = DATA_DIR / "sites.json"
OUTPUT_DIR = ROOT / "output"
FRONTEND_DATA_DIR = ROOT / "frontend" / "public" / "data"

R_MOON_KM = 1737.4          # esfera de referencia de LOLA
R_SUN_KM = 696_000.0
R_EARTH_KM = 6378.137
SYNODIC_DAYS = 29.530589

DEFAULT_H_OBS_M = 2.0        # altura del panel/antena sobre el terreno
DEFAULT_EPS_SUN_DEG = 0.5     # ε del Sol: > radio del disco (0.27°) => disco completo + colchón
DEFAULT_EPS_EARTH_DEG = 0.5   # ε de la Tierra: colchón para antena y error del DEM
DEFAULT_MIN_COMM_HOURS = 24.0
DEFAULT_MIN_LIGHT_HOURS = 72.0
FRAME = "MOON_ME"
ABCORR = "LT+S"
