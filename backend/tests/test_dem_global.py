"""Conversión del DEM global de LOLA (slice B6) con un archivo sintético: no necesita descargar los 507 MB.

El IMG de LOLA viene en longitudes 0..360°E y con OFFSET = radio de referencia. La conversión debe dejarlo en
-180..180, con altura = DN × SCALING_FACTOR (sin sumar el radio), legible por horizon._Dem.
"""
import numpy as np
import pytest

pytest.importorskip("rasterio")

from lunar.download import convert_global_dem  # noqa: E402
from lunar.horizon import _Dem  # noqa: E402

PPD = 1  # 1 píxel por grado: 180 × 360

LABEL = f"""PDS_VERSION_ID            = PDS3
^IMAGE                    = "SINTETICO.IMG"
OBJECT                    = IMAGE
    LINES                 = {180 * PPD}
    LINE_SAMPLES          = {360 * PPD}
    SAMPLE_TYPE           = LSB_INTEGER
    SAMPLE_BITS           = 16
    UNIT                  = METER
    SCALING_FACTOR        = 0.5
    OFFSET                = 1737400.
END_OBJECT                = IMAGE
OBJECT                    = IMAGE_MAP_PROJECTION
 MAP_PROJECTION_TYPE          = "SIMPLE CYLINDRICAL"
 MAP_RESOLUTION               = {PPD} <pix/deg>
 A_AXIS_RADIUS                = 1737.4 <km>
 POSITIVE_LONGITUDE_DIRECTION = "EAST"
 MAXIMUM_LATITUDE             = 90 <deg>
 MINIMUM_LATITUDE             = -90 <deg>
 WESTERNMOST_LONGITUDE        = 0 <deg>
 EASTERNMOST_LONGITUDE        = 360 <deg>
END_OBJECT                    = IMAGE_MAP_PROJECTION
END
"""


def _dn(lat_row: int, lon_col: int) -> int:
    """DN que codifica la celda (columna 0..359 = longitud este; fila módulo 50). Cabe en int16 (máx. 17999)."""
    return lon_col * 50 + lat_row % 50


@pytest.fixture(scope="module")
def dem(tmp_path_factory):
    d = tmp_path_factory.mktemp("dem")
    rows, cols = np.mgrid[0:180 * PPD, 0:360 * PPD]
    (d / "S.IMG").write_bytes(_dn(rows, cols).astype("<i2").tobytes())
    (d / "S.LBL").write_text(LABEL, encoding="latin-1")
    out = convert_global_dem(d / "S.IMG", d / "S.LBL", d / "global.tif")
    return _Dem(str(out), max_px=8000)


def _altura(dem, lat, lon) -> float:
    return float(dem.sample(np.array([lat]), np.array([lon]))[0])


@pytest.mark.parametrize("lat,lon,row,col", [
    (0.5, 10.5, 89, 10),       # este
    (0.5, -10.5, 89, 349),     # oeste: en el IMG es 349.5°E
    (-45.5, 100.5, 135, 100),
    (60.5, -120.5, 29, 239),
    (-89.5, 0.5, 179, 0),
])
def test_longitudes_y_altura_sin_offset(dem, lat, lon, row, col):
    assert _altura(dem, lat, lon) == pytest.approx(_dn(row, col) * 0.5)


@pytest.mark.parametrize("lon", [179.6, 179.99, -179.99, -179.6])
def test_cruce_del_antimeridiano_tiene_dato(dem, lon):
    """Las celdas 179.5°E (col 179) y 180.5°E = -179.5° (col 180) son vecinas: no debe quedar hueco."""
    h = _altura(dem, 0.5, lon)
    assert not np.isnan(h)
    assert min(_dn(89, 179), _dn(89, 180)) * 0.5 <= h <= max(_dn(89, 179), _dn(89, 180)) * 0.5


def test_altura_relativa_no_radio(dem):
    """Si se aplicara el OFFSET, la altura sería ~1737 km."""
    assert abs(_altura(dem, 0.5, 10.5)) < 100_000


def test_etiqueta_inesperada_se_rechaza(tmp_path):
    (tmp_path / "S.IMG").write_bytes(b"\0\0" * 180 * 360)
    (tmp_path / "S.LBL").write_text(LABEL.replace("LSB_INTEGER", "MSB_INTEGER"), encoding="latin-1")
    with pytest.raises(ValueError):
        convert_global_dem(tmp_path / "S.IMG", tmp_path / "S.LBL", tmp_path / "x.tif")
