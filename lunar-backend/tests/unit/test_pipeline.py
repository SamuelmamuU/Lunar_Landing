"""Pruebas unitarias del pipeline de descarga y verificación de datos (UT-DATA-*)."""

import hashlib
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import pytest
import rasterio
import respx
import structlog
from rasterio.transform import from_origin
from typer.testing import CliRunner

from app.core.constants import MOON_SP_STERE_PROJ
from pipeline.cli import app as cli_app
from pipeline.download_dem import (
    download_dem,
    extract_dem_window,
    validate_or_assign_dem_crs,
)
from pipeline.download_kernels import (
    download_file_atomic,
    download_kernels,
    generate_meta_tm,
    load_sources_config,
    select_latest_fk_moon,
)
from pipeline.verify_data import verify_dem_file
from tests.conftest import PIX, make_dem

FK_DIRECTORY_HTML = """
<html><body>
<a href="moon_080317.tf">moon_080317.tf</a>
<a href="moon_de440_220930.tf">moon_de440_220930.tf</a>
<a href="moon_de440_250416.tf">moon_de440_250416.tf</a>
<a href="moon_assoc_me.tf">moon_assoc_me.tf</a>
</body></html>
"""


class _BrokenMidStream(httpx.SyncByteStream):
    """Stream que envía la mitad de los bytes y luego corta la conexión."""

    def __init__(self, first_chunk: bytes) -> None:
        self._first_chunk = first_chunk

    def __iter__(self):  # type: ignore[no-untyped-def]
        yield self._first_chunk
        raise httpx.ReadError("Conexión interrumpida a mitad de descarga")


def _mock_all_naif_routes(router: respx.MockRouter) -> dict[str, bytes]:
    cfg = load_sources_config()
    naif_base = str(cfg["naif_base"]).rstrip("/")
    router.get(f"{naif_base}/fk/satellites/").mock(
        return_value=httpx.Response(200, text=FK_DIRECTORY_HTML)
    )

    payloads = {
        "naif0012.tls": b"KPL/LSK\nFAKE LEAPSECONDS\n",
        "de440s.bsp": b"DAF/SPK " + b"\x00" * 128,
        "pck00011.tpc": b"KPL/PCK\nFAKE TEXT PCK\n",
        "moon_pa_de440_200625.bpc": b"DAF/PCK " + b"\x01" * 128,
        "moon_de440_250416.tf": b"KPL/FK\nFAKE MOON DE440 FK\n",
        "moon_assoc_me.tf": b"KPL/FK\nFAKE MOON_ASSOC_ME\n",
    }

    url_map = {
        f"{naif_base}/lsk/naif0012.tls": payloads["naif0012.tls"],
        f"{naif_base}/spk/planets/de440s.bsp": payloads["de440s.bsp"],
        f"{naif_base}/pck/pck00011.tpc": payloads["pck00011.tpc"],
        f"{naif_base}/pck/moon_pa_de440_200625.bpc": payloads["moon_pa_de440_200625.bpc"],
        f"{naif_base}/fk/satellites/moon_de440_250416.tf": payloads["moon_de440_250416.tf"],
        f"{naif_base}/fk/satellites/moon_assoc_me.tf": payloads["moon_assoc_me.tf"],
    }

    for url, content in url_map.items():
        headers = {"Content-Length": str(len(content))}
        router.head(url).mock(return_value=httpx.Response(200, headers=headers))
        router.get(url).mock(return_value=httpx.Response(200, headers=headers, content=content))

    return payloads


def test_UT_DATA_01_download_kernels_to_correct_path(tmp_path: Path) -> None:
    """UT-DATA-01: respx sirve 6 URLs -> 6 archivos en tmp/kernels sin remanentes .part."""
    kernels_dir = tmp_path / "kernels"
    manifest_path = tmp_path / "manifest.json"

    with respx.mock(assert_all_called=True) as router:
        payloads = _mock_all_naif_routes(router)
        with httpx.Client() as client:
            entries = download_kernels(
                kernels_dir=kernels_dir,
                manifest_path=manifest_path,
                client=client,
                retry_wait_base=0.0,
            )

    assert len(entries) == 6
    downloaded_files = sorted(p.name for p in kernels_dir.iterdir() if p.name != "meta.tm")
    assert downloaded_files == sorted(payloads.keys())
    assert not list(kernels_dir.glob("*.part"))
    for name, expected_bytes in payloads.items():
        assert (kernels_dir / name).read_bytes() == expected_bytes


def test_UT_DATA_02_generate_meta_tm(tmp_path: Path) -> None:
    """UT-DATA-02: meta.tm contiene KPL/MK, PATH_VALUES absoluto y los 6 kernels en orden."""
    kernels_dir = tmp_path / "kernels"
    kernels_dir.mkdir(parents=True, exist_ok=True)
    ordered = [
        "naif0012.tls",
        "pck00011.tpc",
        "de440s.bsp",
        "moon_pa_de440_200625.bpc",
        "moon_de440_250416.tf",
        "moon_assoc_me.tf",
    ]
    meta_path = generate_meta_tm(kernels_dir, ordered)
    text = meta_path.read_text(encoding="utf-8")

    assert "KPL/MK" in text
    assert "PATH_VALUES" in text
    assert "PATH_SYMBOLS" in text
    # Verifica que aparezca la ruta absoluta normalizada en PATH_VALUES
    abs_posix = kernels_dir.resolve().as_posix()
    compact_text = re.sub(r"\+'\s*\n\s*'", "", text)
    assert abs_posix in compact_text

    positions = [text.index(f"$K/{name}") for name in ordered]
    assert positions == sorted(positions)


def test_UT_DATA_03_select_latest_fk_moon() -> None:
    """UT-DATA-03: elige el FK moon_de440_XXXXXX.tf de fecha más reciente."""
    naif_base = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels"
    with respx.mock(assert_all_called=True) as router:
        router.get(f"{naif_base}/fk/satellites/").mock(
            return_value=httpx.Response(200, text=FK_DIRECTORY_HTML)
        )
        with httpx.Client() as client:
            selected = select_latest_fk_moon(
                client=client,
                base_url=naif_base,
                dir_path="fk/satellites",
                pattern=r"^moon_de440_\d{6}\.tf$",
                fallback="fk/satellites/a_old_versions/moon_de440_220930.tf",
            )

    assert selected == "fk/satellites/moon_de440_250416.tf"


def test_UT_DATA_04_fk_moon_fallback_on_http_error() -> None:
    """UT-DATA-04: si el listado HTTP responde 500, usa fallback y registra advertencia."""
    naif_base = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels"
    fallback = "fk/satellites/a_old_versions/moon_de440_220930.tf"

    with respx.mock(assert_all_called=True) as router:
        router.get(f"{naif_base}/fk/satellites/").mock(return_value=httpx.Response(500))
        with structlog.testing.capture_logs() as logs, httpx.Client() as client:
            selected = select_latest_fk_moon(
                client=client,
                base_url=naif_base,
                dir_path="fk/satellites",
                pattern=r"^moon_de440_\d{6}\.tf$",
                fallback=fallback,
            )

    assert selected == fallback
    assert any(entry.get("log_level") == "warning" for entry in logs)


def test_UT_DATA_05_idempotency_skip_existing(tmp_path: Path) -> None:
    """UT-DATA-05: si el archivo ya existe con tamaño igual a Content-Length, no ejecuta GET."""
    url = "https://example.org/kernels/naif0012.tls"
    content = b"EXISTING LEAPSECONDS KERNEL CONTENT"
    dest = tmp_path / "naif0012.tls"
    dest.write_bytes(content)

    with respx.mock(assert_all_called=False) as router:
        head_route = router.head(url).mock(
            return_value=httpx.Response(200, headers={"Content-Length": str(len(content))})
        )
        get_route = router.get(url).mock(return_value=httpx.Response(200, content=content))
        with httpx.Client() as client:
            entry = download_file_atomic(client, url, dest, version="naif0012", retry_wait_base=0.0)

    assert head_route.call_count == 1
    assert get_route.call_count == 0
    assert entry["bytes"] == len(content)
    assert entry["sha256"] == hashlib.sha256(content).hexdigest()


def test_UT_DATA_06_atomic_write_and_retries(tmp_path: Path) -> None:
    """UT-DATA-06: corte a mitad del primer GET -> reintenta, completa sha256 y no deja .part."""
    url = "https://example.org/kernels/de440s.bsp"
    payload = b"0123456789ABCDEF" * 64
    dest = tmp_path / "de440s.bsp"
    attempts = {"count": 0}

    def get_side_effect(request: httpx.Request) -> httpx.Response:
        attempts["count"] += 1
        if attempts["count"] == 1:
            return httpx.Response(
                200,
                headers={"Content-Length": str(len(payload))},
                stream=_BrokenMidStream(payload[:128]),
            )
        return httpx.Response(
            200,
            headers={"Content-Length": str(len(payload))},
            content=payload,
        )

    with respx.mock(assert_all_called=True) as router:
        router.head(url).mock(
            return_value=httpx.Response(200, headers={"Content-Length": str(len(payload))})
        )
        router.get(url).mock(side_effect=get_side_effect)
        with httpx.Client() as client:
            entry = download_file_atomic(client, url, dest, version="de440s", retry_wait_base=0.0)

    assert attempts["count"] == 2
    assert dest.read_bytes() == payload
    assert entry["sha256"] == hashlib.sha256(payload).hexdigest()
    assert not (tmp_path / "de440s.bsp.part").exists()


def test_UT_DATA_07_manifest_schema(tmp_path: Path) -> None:
    """UT-DATA-07: manifest contiene file, url, sha256 (64 hex), bytes > 0, downloaded_utc Z."""
    import json

    kernels_dir = tmp_path / "kernels"
    manifest_path = tmp_path / "manifest.json"
    with respx.mock(assert_all_called=True) as router:
        _mock_all_naif_routes(router)
        with httpx.Client() as client:
            download_kernels(
                kernels_dir=kernels_dir,
                manifest_path=manifest_path,
                client=client,
                retry_wait_base=0.0,
            )

    manifest: dict[str, Any] = json.loads(manifest_path.read_text(encoding="utf-8"))
    files = manifest["files"]
    assert len(files) == 6
    for item in files:
        assert set(item.keys()) >= {"file", "url", "sha256", "bytes", "downloaded_utc", "version"}
        assert re.fullmatch(r"[0-9a-f]{64}", item["sha256"])
        assert item["bytes"] > 0
        assert item["downloaded_utc"].endswith("Z")
        datetime.fromisoformat(item["downloaded_utc"].replace("Z", "+00:00"))
        assert item["url"].startswith("https://")


def test_UT_DATA_08_dem_window_mode(tmp_path: Path) -> None:
    """UT-DATA-08: modo window extrae ~500x500 px desde DEM local conservando CRS y alturas."""
    n = 1000
    yy, xx = np.mgrid[0:n, 0:n]
    heights = (xx * 0.5 + yy * 0.25 - 100.0).astype(np.float32)
    src_dem = make_dem(tmp_path / "source_lola.tif", heights, x_center=0.0, y_center=0.0, pix=PIX)

    sites_file = tmp_path / "sites.json"
    sites_file.write_text(
        """{
  "version": "2026-11-14",
  "sites": [
    {
      "id": "ref-south-pole",
      "name": "Polo Sur",
      "category": "polar_reference",
      "tags": ["reference", "south_pole"],
      "lat_deg": -90.0,
      "lon_deg": 0.0,
      "x_m": 0.0,
      "y_m": 0.0,
      "in_dem": true,
      "region_size_km": 10.0,
      "description": "Sitio sintético en el polo.",
      "source_url": "https://pgda.gsfc.nasa.gov/products/78",
      "verified": true
    }
  ]
}""",
        encoding="utf-8",
    )

    out_dem = tmp_path / "window_dem.tif"
    extract_dem_window(src_dem, out_dem, x_center=0.0, y_center=0.0, radius_km=5.0)

    with rasterio.open(src_dem) as src, rasterio.open(out_dem) as dst:
        assert dst.width == 500
        assert dst.height == 500
        assert dst.crs == src.crs
        expected_slice = src.read(1)[250:750, 250:750]
        actual_slice = dst.read(1)
        np.testing.assert_array_equal(actual_slice, expected_slice)

    # También valida download_dem en mode="window" usando source_override local
    out_from_pipeline = tmp_path / "pipeline_window.tif"
    manifest_path = tmp_path / "manifest.json"
    dem_entry = download_dem(
        dem_path=out_from_pipeline,
        manifest_path=manifest_path,
        mode="window",
        sites_path=sites_file,
        radius_km=5.0,
        source_override=src_dem,
    )
    assert dem_entry["mode"] == "window"
    with rasterio.open(out_from_pipeline) as dst2:
        assert dst2.width == 500
        assert dst2.height == 500


def test_UT_DATA_09_verify_fails_with_corrupt_dem(tmp_path: Path) -> None:
    """UT-DATA-09: verify falla con código != 0 y menciona DEM cuando el GeoTIFF está corrupto."""
    corrupt_dem = tmp_path / "corrupt.tif"
    corrupt_dem.write_bytes(b"NOT A VALID GEOTIFF FILE AT ALL")

    with pytest.raises(RuntimeError, match=r"(?i)DEM"):
        verify_dem_file(corrupt_dem)

    runner = CliRunner()
    result = runner.invoke(
        cli_app,
        [
            "verify",
            "--meta-kernel",
            str(tmp_path / "missing_meta.tm"),
            "--dem-path",
            str(corrupt_dem),
            "--manifest-path",
            str(tmp_path / "manifest.json"),
        ],
    )
    assert result.exit_code != 0
    assert "dem" in result.output.lower()


def test_UT_DATA_10_validate_and_assign_default_dem_crs(tmp_path: Path) -> None:
    """UT-DATA-10: un DEM sin CRS recibe la proyección por defecto y registra advertencia."""
    dem_no_crs = tmp_path / "no_crs.tif"
    arr = np.zeros((50, 50), dtype=np.float32)
    with rasterio.open(
        dem_no_crs,
        "w",
        driver="GTiff",
        height=50,
        width=50,
        count=1,
        dtype="float32",
        crs=None,
        transform=from_origin(-500.0, 500.0, PIX, PIX),
    ) as ds:
        ds.write(arr, 1)

    with structlog.testing.capture_logs() as logs:
        had_crs = validate_or_assign_dem_crs(dem_no_crs)

    assert had_crs is False
    assert any(entry.get("log_level") == "warning" for entry in logs)
    with rasterio.open(dem_no_crs) as ds_after:
        assert ds_after.crs is not None
        crs_dict = ds_after.crs.to_dict()
        assert crs_dict["proj"] == "stere"
        assert crs_dict["lat_0"] == -90
        assert crs_dict["lon_0"] == 0
        assert crs_dict["R"] == 1_737_400
        assert crs_dict["units"] == "m"
        assert "+R=1737400" in MOON_SP_STERE_PROJ


def test_pipeline_verify_spice_manifest_and_all(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Verifica `verify_spice_kernels`, `verify_manifest` y `verify_all`."""
    import spiceypy

    from pipeline.verify_data import verify_all, verify_manifest, verify_spice_kernels

    kernels_dir = tmp_path / "kernels"
    manifest_path = tmp_path / "manifest.json"
    with respx.mock(assert_all_called=True) as router:
        _mock_all_naif_routes(router)
        with httpx.Client() as client:
            download_kernels(
                kernels_dir=kernels_dir,
                manifest_path=manifest_path,
                client=client,
                retry_wait_base=0.0,
            )

    # Crear DEM sintético full >= +-300 km (no, 200x200 para mode=window en manifest)
    src_dem = make_dem(
        tmp_path / "src.tif",
        np.full((400, 400), 120.0, dtype=np.float32),
        x_center=0.0,
        y_center=0.0,
        pix=PIX,
    )
    dem_out = tmp_path / "dem.tif"
    download_dem(
        dem_path=dem_out,
        manifest_path=manifest_path,
        mode="window",
        radius_km=2.0,
        source_override=src_dem,
    )

    # Monkeypatch de spiceypy para simular efeméride Tierra-Luna válida y kclear limpio
    monkeypatch.setattr(spiceypy, "kclear", lambda: None)
    monkeypatch.setattr(spiceypy, "furnsh", lambda path: None)
    monkeypatch.setattr(spiceypy, "str2et", lambda utc: 820_497_669.185)
    monkeypatch.setattr(
        spiceypy,
        "spkpos",
        lambda targ, et, ref, abcorr, obs: (np.array([384_400.0, 0.0, 0.0]), 1.28),
    )

    report = verify_all(kernels_dir / "meta.tm", dem_out, manifest_path)
    assert report["spice"]["kernels_count"] == 6
    assert report["spice"]["smoke_earth_moon_km"] == 384_400.0
    assert report["dem"]["width"] == 200
    assert verify_manifest(manifest_path)["version"] == "1.0"

    # Prueba fuera de rango físico en spkpos
    monkeypatch.setattr(
        spiceypy,
        "spkpos",
        lambda targ, et, ref, abcorr, obs: (np.array([100.0, 0.0, 0.0]), 0.0),
    )
    with pytest.raises(RuntimeError, match="fuera de rango"):
        verify_spice_kernels(kernels_dir / "meta.tm")

    # Manifest inválido
    bad_manifest = tmp_path / "bad_manifest.json"
    bad_manifest.write_text('{"files": [{"file": "x"}]}', encoding="utf-8")
    with pytest.raises(RuntimeError, match="sin claves"):
        verify_manifest(bad_manifest)


def test_pipeline_dem_errors_full_and_per_site(tmp_path: Path) -> None:
    """Cubre modo `full`, `per_site_dir` y errores de validación del DEM."""
    from pipeline.download_dem import validate_dem_file

    # DEM con alturas imposibles -> fallo
    bad_heights = make_dem(
        tmp_path / "bad_h.tif",
        np.full((40, 40), 50_000.0, dtype=np.float32),
        x_center=0.0,
        y_center=0.0,
        pix=PIX,
    )
    with pytest.raises(RuntimeError, match="fuera de rango físico"):
        validate_dem_file(bad_heights)

    # DEM con tamaño de píxel distinto de 20 m -> fallo
    bad_pix = make_dem(
        tmp_path / "bad_pix.tif",
        np.zeros((20, 20), dtype=np.float32),
        x_center=0.0,
        y_center=0.0,
        pix=50.0,
    )
    with pytest.raises(RuntimeError, match="Tamaño de píxel inesperado"):
        validate_dem_file(bad_pix)

    # DEM con cobertura insuficiente cuando min_extent_km es alto -> fallo
    small_dem = make_dem(
        tmp_path / "small.tif",
        np.zeros((40, 40), dtype=np.float32),
        x_center=0.0,
        y_center=0.0,
        pix=PIX,
    )
    with pytest.raises(RuntimeError, match="Cobertura insuficiente"):
        validate_dem_file(small_dem, min_extent_km=300.0)

    # Modo full y per_site_dir con source_override
    src_dem = make_dem(
        tmp_path / "src_full.tif",
        np.full((300, 300), 25.0, dtype=np.float32),
        x_center=0.0,
        y_center=0.0,
        pix=PIX,
    )
    sites_file = tmp_path / "sites.json"
    sites_file.write_text(
        """{
  "version": "2026-11-14",
  "sites": [
    {
      "id": "s1",
      "name": "S1",
      "category": "polar_reference",
      "tags": ["south_pole"],
      "lat_deg": -90.0,
      "lon_deg": 0.0,
      "x_m": 0.0,
      "y_m": 0.0,
      "in_dem": true,
      "region_size_km": 2.0,
      "description": "S1",
      "source_url": "https://pgda.gsfc.nasa.gov/products/78",
      "verified": true
    },
    {
      "id": "s2",
      "name": "S2",
      "category": "polar_reference",
      "tags": ["south_pole"],
      "lat_deg": -89.9,
      "lon_deg": 0.0,
      "x_m": 0.0,
      "y_m": 1000.0,
      "in_dem": true,
      "region_size_km": 2.0,
      "description": "S2",
      "source_url": "https://pgda.gsfc.nasa.gov/products/78",
      "verified": true
    }
  ]
}""",
        encoding="utf-8",
    )
    per_site_dir = tmp_path / "per_site"
    manifest_path = tmp_path / "manifest.json"
    entry = download_dem(
        dem_path=tmp_path / "out_win.tif",
        manifest_path=manifest_path,
        mode="window",
        sites_path=sites_file,
        radius_km=2.0,
        source_override=src_dem,
        per_site_dir=per_site_dir,
    )
    assert entry["mode"] == "window"
    assert (per_site_dir / "s1.tif").exists()
    assert (per_site_dir / "s2.tif").exists()


def test_pipeline_precompute_and_cli_commands(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cubre `precompute_horizons` y los subcomandos CLI de `pipeline/cli.py`."""
    import pipeline.cli as cli_mod
    from pipeline.precompute_horizons import precompute_horizons

    sites_file = tmp_path / "sites.json"
    sites_file.write_text(
        """{
  "version": "2026-11-14",
  "sites": [
    {
      "id": "ref-south-pole",
      "name": "Polo Sur",
      "category": "polar_reference",
      "tags": ["reference"],
      "lat_deg": -90.0,
      "lon_deg": 0.0,
      "x_m": 0.0,
      "y_m": 0.0,
      "in_dem": true,
      "region_size_km": 5.0,
      "description": "Polo sur",
      "source_url": "https://pgda.gsfc.nasa.gov/products/78",
      "verified": true
    }
  ]
}""",
        encoding="utf-8",
    )
    dem_file = make_dem(tmp_path / "dem.tif", np.zeros((50, 50), dtype=np.float32), 0.0, 0.0)
    cache_dir = tmp_path / "cache"

    # En Fase 1 precompute_horizons devuelve 0 sin fallar cuando Fase 3 no existe aún
    assert precompute_horizons(sites_file, dem_file, cache_dir) == 0

    with pytest.raises(RuntimeError, match="Catálogo"):
        precompute_horizons(tmp_path / "missing_sites.json", dem_file, cache_dir)

    with pytest.raises(RuntimeError, match="DEM"):
        precompute_horizons(sites_file, tmp_path / "missing_dem.tif", cache_dir)

    # CLI subcommands con dependencias stub
    monkeypatch.setattr(
        cli_mod,
        "download_kernels",
        lambda k_dir, m_path, sources_path=None: [{"file": "naif0012.tls"}],
    )
    monkeypatch.setattr(
        cli_mod,
        "download_dem",
        lambda **kwargs: {
            "mode": kwargs.get("mode", "window"),
            "bytes": 1234,
            "sha256": "a" * 64,
        },
    )
    monkeypatch.setattr(
        cli_mod,
        "verify_all",
        lambda mk, dp, mp: {
            "spice": {"kernels_count": 6, "smoke_earth_moon_km": 384400.0},
            "dem": {"width": 100, "height": 100},
        },
    )
    monkeypatch.setattr(cli_mod, "precompute_horizons", lambda s, d, c: 3)

    runner = CliRunner()
    res_sites = runner.invoke(cli_mod.app, ["sites", "--sites-path", str(sites_file)])
    assert res_sites.exit_code == 0

    res_kernels = runner.invoke(
        cli_mod.app,
        [
            "kernels",
            "--kernels-dir",
            str(tmp_path / "k"),
            "--manifest-path",
            str(tmp_path / "m.json"),
        ],
    )
    assert res_kernels.exit_code == 0

    res_dem = runner.invoke(
        cli_mod.app,
        ["dem", "--mode", "window", "--sites", str(sites_file), "--dem-path", str(dem_file)],
    )
    assert res_dem.exit_code == 0

    res_verify = runner.invoke(
        cli_mod.app,
        ["verify", "--meta-kernel", str(tmp_path / "meta.tm"), "--dem-path", str(dem_file)],
    )
    assert res_verify.exit_code == 0

    res_pre = runner.invoke(
        cli_mod.app,
        ["precompute-horizons", "--sites-path", str(sites_file), "--dem-path", str(dem_file)],
    )
    assert res_pre.exit_code == 0

    res_all = runner.invoke(
        cli_mod.app,
        ["all", "--dem-mode", "window", "--radius-km", "5", "--sites", str(sites_file)],
    )
    assert res_all.exit_code == 0
