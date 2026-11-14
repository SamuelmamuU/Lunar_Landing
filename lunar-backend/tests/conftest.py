"""Fixtures globales y bloqueo de red para pruebas unitarias e integración."""

import socket
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import rasterio
from httpx import ASGITransport, AsyncClient
from hypothesis import settings as hypothesis_settings
from pyproj import CRS
from rasterio.transform import from_origin

from app.core.constants import MOON_SP_STERE_PROJ, R_MOON_M
from app.main import create_app

hypothesis_settings.register_profile("deterministic", derandomize=True)
hypothesis_settings.load_profile("deterministic")

R_MOON = R_MOON_M
SP_STERE = CRS.from_proj4(MOON_SP_STERE_PROJ)

# Observador de referencia sobre el meridiano 0 a 100 km del polo; se verificará con UT-COORD-03.
OBS_X, OBS_Y = 0.0, 100_000.0
PIX = 20.0

_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


def _is_loopback(address: Any) -> bool:
    if isinstance(address, tuple) and address:
        return str(address[0]) in _LOOPBACK_HOSTS
    return False


@pytest.fixture(autouse=True)
def block_external_network(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """Bloquea conexiones de red externas salvo en pruebas marcadas con `@pytest.mark.network`."""
    if request.node.get_closest_marker("network") is not None:
        return

    orig_connect = socket.socket.connect
    orig_connect_ex = socket.socket.connect_ex

    def guarded_connect(self: socket.socket, address: Any) -> None:
        if not _is_loopback(address):
            raise RuntimeError(f"Acceso de red externo bloqueado en test unitario: {address!r}")
        orig_connect(self, address)

    def guarded_connect_ex(self: socket.socket, address: Any) -> int:
        if not _is_loopback(address):
            raise RuntimeError(f"Acceso de red externo bloqueado en test unitario: {address!r}")
        return orig_connect_ex(self, address)

    monkeypatch.setattr(socket.socket, "connect", guarded_connect)
    monkeypatch.setattr(socket.socket, "connect_ex", guarded_connect_ex)


def make_dem(
    path: Path,
    heights: np.ndarray,
    x_center: float = OBS_X,
    y_center: float = OBS_Y,
    pix: float = PIX,
) -> Path:
    """Escribe un GeoTIFF float32 con la misma proyección que LOLA."""
    n_rows, n_cols = heights.shape
    west = x_center - n_cols / 2 * pix
    north = y_center + n_rows / 2 * pix
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=n_rows,
        width=n_cols,
        count=1,
        dtype="float32",
        crs=SP_STERE,
        transform=from_origin(west, north, pix, pix),
    ) as ds:
        ds.write(heights.astype("float32"), 1)
    return path


def grid(n: int, pix: float = PIX) -> tuple[np.ndarray, np.ndarray]:
    """Coordenadas relativas `(dx, dy)` en metros de cada centro de pixel; fila 0 = norte."""
    c = (np.arange(n) - n / 2 + 0.5) * pix
    dx, dy = np.meshgrid(c, -c)
    return dx, dy


@pytest.fixture
def dem_flat(tmp_path: Path) -> Path:
    """DEM plano de 30 km x 30 km a altura 0 m."""
    return make_dem(tmp_path / "flat.tif", np.zeros((1500, 1500), dtype=np.float32))


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Cliente HTTP asíncrono conectado directamente al ASGI de FastAPI."""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client
