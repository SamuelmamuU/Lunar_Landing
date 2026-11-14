"""Interfaz de línea de comandos para el pipeline offline (`python -m pipeline`)."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from app.core.config import get_settings
from app.core.logging import configure_logging
from pipeline.build_sites import build_sites
from pipeline.download_dem import download_dem
from pipeline.download_kernels import download_kernels
from pipeline.precompute_horizons import precompute_horizons
from pipeline.verify_data import verify_all

app = typer.Typer(
    name="pipeline",
    help="Pipeline offline de descarga, verificación y preprocesamiento de datos lunares.",
    no_args_is_help=True,
)


@app.callback()
def _init_logging() -> None:
    configure_logging(json_logs=False)


@app.command()
def kernels(
    kernels_dir: Annotated[Path | None, typer.Option("--kernels-dir")] = None,
    manifest_path: Annotated[Path | None, typer.Option("--manifest-path")] = None,
    sources_path: Annotated[Path | None, typer.Option("--sources-path")] = None,
) -> None:
    """Descarga los 6 kernels SPICE de NAIF y genera `meta.tm`."""
    settings = get_settings()
    k_dir = kernels_dir or settings.meta_kernel.parent
    m_path = manifest_path or settings.manifest_path
    try:
        entries = download_kernels(k_dir, m_path, sources_path=sources_path)
    except Exception as exc:
        typer.echo(f"Error descargando kernels SPICE: {exc}", err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(f"Kernels descargados/verificados ({len(entries)} archivos) en {k_dir}.")


@app.command()
def dem(
    mode: Annotated[str, typer.Option("--mode")] = "window",
    sites: Annotated[Path | None, typer.Option("--sites")] = None,
    radius_km: Annotated[float, typer.Option("--radius-km")] = 150.0,
    dem_path: Annotated[Path | None, typer.Option("--dem-path")] = None,
    manifest_path: Annotated[Path | None, typer.Option("--manifest-path")] = None,
    sources_path: Annotated[Path | None, typer.Option("--sources-path")] = None,
    per_site: Annotated[bool, typer.Option("--per-site")] = False,
) -> None:
    """Descarga o recorta el DEM LOLA (`full` o `window`)."""
    settings = get_settings()
    out_dem = dem_path or settings.dem_path
    m_path = manifest_path or settings.manifest_path
    s_path = sites or settings.sites_path
    per_site_dir = (out_dem.parent / "windows") if per_site else None
    try:
        entry = download_dem(
            dem_path=out_dem,
            manifest_path=m_path,
            mode=mode,
            sites_path=s_path,
            radius_km=radius_km,
            sources_path=sources_path,
            per_site_dir=per_site_dir,
        )
    except Exception as exc:
        typer.echo(f"Error descargando DEM ({mode}): {exc}", err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(
        f"DEM listo en {out_dem} (modo={entry['mode']}, {entry['bytes']} bytes, "
        f"sha256={entry['sha256'][:12]})."
    )


@app.command()
def sites(
    sites_path: Annotated[Path | None, typer.Option("--sites-path")] = None,
    dem_path: Annotated[Path | None, typer.Option("--dem-path")] = None,
) -> None:
    """Completa coordenadas x_m/y_m e `in_dem` y valida `sites.json`."""
    settings = get_settings()
    s_path = sites_path or settings.sites_path
    d_path = dem_path or settings.dem_path
    try:
        catalog = build_sites(s_path, dem_path=d_path if d_path.exists() else None)
    except Exception as exc:
        typer.echo(f"Error validando sitios en {s_path}: {exc}", err=True)
        raise typer.Exit(code=1) from exc
    in_dem_count = sum(1 for item in catalog.sites if item.in_dem)
    typer.echo(
        f"Catálogo de sitios validado ({len(catalog.sites)} sitios, {in_dem_count} dentro del DEM)."
    )


@app.command()
def verify(
    meta_kernel: Annotated[Path | None, typer.Option("--meta-kernel")] = None,
    dem_path: Annotated[Path | None, typer.Option("--dem-path")] = None,
    manifest_path: Annotated[Path | None, typer.Option("--manifest-path")] = None,
) -> None:
    """Verifica kernels SPICE, DEM LOLA y esquema de `manifest.json`."""
    settings = get_settings()
    mk = meta_kernel or settings.meta_kernel
    dp = dem_path or settings.dem_path
    mp = manifest_path or settings.manifest_path
    try:
        report = verify_all(mk, dp, mp)
    except Exception as exc:
        typer.echo(f"Error de verificación: {exc}")
        raise typer.Exit(code=1) from exc
    typer.echo(
        f"Verificación OK: {report['spice']['kernels_count']} kernels, "
        f"Tierra-Luna={report['spice']['smoke_earth_moon_km']} km, "
        f"DEM={report['dem']['width']}x{report['dem']['height']} px."
    )


@app.command(name="precompute-horizons")
def precompute_horizons_cmd(
    sites_path: Annotated[Path | None, typer.Option("--sites-path")] = None,
    dem_path: Annotated[Path | None, typer.Option("--dem-path")] = None,
    cache_dir: Annotated[Path | None, typer.Option("--cache-dir")] = None,
) -> None:
    """Precalcula máscaras de horizonte para sitios cubiertos por el DEM."""
    settings = get_settings()
    s_path = sites_path or settings.sites_path
    d_path = dem_path or settings.dem_path
    c_dir = cache_dir or settings.horizon_cache_dir
    try:
        count = precompute_horizons(s_path, d_path, c_dir)
    except Exception as exc:
        typer.echo(f"Error en precálculo de horizontes: {exc}", err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(f"Precálculo completado ({count} máscaras generadas).")


@app.command(name="all")
def run_all(
    dem_mode: Annotated[str, typer.Option("--dem-mode")] = "window",
    radius_km: Annotated[float, typer.Option("--radius-km")] = 150.0,
    sites_path: Annotated[Path | None, typer.Option("--sites")] = None,
) -> None:
    """Ejecuta el pipeline completo: sitios -> kernels -> DEM -> verificación."""
    settings = get_settings()
    s_path = sites_path or settings.sites_path
    k_dir = settings.meta_kernel.parent
    d_path = settings.dem_path
    m_path = settings.manifest_path

    try:
        build_sites(s_path, dem_path=None)
        download_kernels(k_dir, m_path)
        download_dem(
            dem_path=d_path,
            manifest_path=m_path,
            mode=dem_mode,
            sites_path=s_path,
            radius_km=radius_km,
        )
        build_sites(s_path, dem_path=d_path)
        report = verify_all(settings.meta_kernel, d_path, m_path)
    except Exception as exc:
        typer.echo(f"Error ejecutando pipeline completo: {exc}")
        raise typer.Exit(code=1) from exc

    typer.echo(
        f"Pipeline completo OK (DEM {report['dem']['width']}x{report['dem']['height']}, "
        f"{report['spice']['kernels_count']} kernels)."
    )
