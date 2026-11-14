"""Lunar Landing Site Navigator — cálculos desde la terminal, salida en JSON.

Ejemplos:
  python main.py mission  --x 29.1957 --y -84.7906 --landing 2025-03-06T17:29:00Z --duration 10
  python main.py evaluate --x -136.6667 --y -89.4667 --start 2026-11-14 --end 2026-12-14
  python main.py sites
  python main.py sky      --site connecting-ridge --utc 2026-11-14T18:00:00Z
  python main.py report   --site mons-mouton-im2 --days 30 --out output/im2.json
  python main.py report   --lat -89.2 --lon -140 --days 30 --series
  python main.py events   --site apollo11 --days 60
  python main.py series   --site connecting-ridge --days 3 --step-min 30
  python main.py compare  --sites connecting-ridge,mons-mouton-im2,apollo11 --days 30
  python main.py sweep    --site connecting-ridge --days 60 --step-days 1
  python main.py horizon  --all --dem data/dem/ldem_87s_5m.tif --dem data/dem/LDEM_80S_80MPP_ADJ.TIF
  python main.py export   --out-dir frontend/public/data
  python main.py download --kernels            (DE440 oficial; DE421 ya viene incluido)

Todas las fechas en UTC. Usa --out para guardar el JSON además de imprimirlo.
"""
import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from lunar import kernels
from lunar.analysis import DAY, Calc
from lunar.config import FRONTEND_DATA_DIR
from lunar.geometry import et_to_utc, utc_to_et
from lunar.report import Settings, make_calc, meta, report, sky_now
from lunar.sites import get_site, load_sites


def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def emit(obj: dict, args) -> None:
    text = json.dumps(obj, ensure_ascii=False, indent=None if args.compact else 2)
    if args.out:
        p = Path(args.out)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        print(f"JSON guardado en {p} ({p.stat().st_size / 1024:.1f} KB)", file=sys.stderr)
        if not args.print:
            return
    print(text)


def settings_from(args) -> Settings:
    return Settings(h_obs_m=args.h_obs, eps_sun_deg=args.eps_sun, eps_earth_deg=args.eps_earth,
                    min_light_hours=args.min_light, min_comm_hours=args.min_comm)


# ------------------------------------------------------------------ comandos
def cmd_sites(args):
    emit({"meta": meta(), "sites": [s.to_dict() for s in load_sites()]}, args)


def cmd_sky(args):
    site = get_site(args.site, args.lat, args.lon)
    s = settings_from(args)
    calc, mask = make_calc(site, s)
    emit({"meta": meta(), "site": site.to_dict(), "horizon": mask.summary(), "settings": s.to_dict(),
          "now": sky_now(calc, utc_to_et(args.utc), s)}, args)


def cmd_report(args):
    site = get_site(args.site, args.lat, args.lon)
    emit(report(site, args.utc, args.days, args.step_min, settings_from(args),
                with_series=args.series, with_events=True), args)


def cmd_evaluate(args):
    from lunar.evaluate import evaluate

    if args.site is None and (args.x is None or args.y is None):
        raise SystemExit("Indica --x (longitud) y --y (latitud), o --site ID")
    site = get_site(args.site, args.y, args.x)
    try:
        emit(evaluate(site, args.start, args.end, settings_from(args), args.step, args.series), args)
    except ValueError as e:
        raise SystemExit(str(e))


def cmd_mission(args):
    from lunar.mission import MissionRules, mission

    if args.site is None and (args.x is None or args.y is None):
        raise SystemExit("Indica --x (longitud) y --y (latitud), o --site ID")
    site = get_site(args.site, args.y, args.x)
    rules = MissionRules(args.eps_sun, args.eps_earth, args.battery, args.max_comm_gap, args.h_obs)
    try:
        emit(mission(site, args.landing, args.duration, rules, args.search_days, include_series=args.series), args)
    except ValueError as e:
        raise SystemExit(str(e))


def cmd_events(args):
    site = get_site(args.site, args.lat, args.lon)
    calc, mask = make_calc(site, settings_from(args))
    et = utc_to_et(args.utc)
    emit({"meta": meta(), "site": site.to_dict(), "horizon": mask.summary(),
          "start_utc": et_to_utc(et), "end_utc": et_to_utc(et + args.days * DAY),
          "events": calc.events(et, et + args.days * DAY, args.step_min)}, args)


def cmd_series(args):
    site = get_site(args.site, args.lat, args.lon)
    calc, mask = make_calc(site, settings_from(args))
    et = utc_to_et(args.utc)
    emit({"meta": meta(), "site": site.to_dict(), "horizon": mask.summary(),
          "series": calc.series(et, et + args.days * DAY, args.step_min)}, args)


def cmd_compare(args):
    s = settings_from(args)
    rows = []
    for sid in [x.strip() for x in args.sites.split(",") if x.strip()]:
        r = report(get_site(sid), args.utc, args.days, args.step_min, s, with_events=False)
        rows.append({"site": r["site"], "label": r["now"]["candidate"]["label"],
                     "reasons": r["now"]["candidate"]["reasons"], "terrain": r["horizon"]["terrain"],
                     "now": r["now"], "metrics": r["window"]["metrics"]})
    rows.sort(key=lambda r: (r["label"] != "CANDIDATO", -r["metrics"]["pct_sun_and_earth"]))
    emit({"meta": meta(), "settings": s.to_dict(), "utc": args.utc, "days": args.days,
          "ranking_by": "candidatos primero, luego pct_sun_and_earth", "sites": rows}, args)


def cmd_sweep(args):
    """¿Qué pasa si me retraso? Una fila por fecha de aterrizaje candidata."""
    site = get_site(args.site, args.lat, args.lon)
    s = settings_from(args)
    calc, mask = make_calc(site, s)
    et0 = utc_to_et(args.utc)
    rows = []
    n = int(args.days / args.step_days) + 1
    for i in range(n):
        et = et0 + i * args.step_days * DAY
        now = sky_now(calc, et, s)
        rows.append({
            "utc": now["utc"],
            "label": now["candidate"]["label"],
            "sun_status": now["sun"]["status"],
            "earth_status": now["earth"]["status"],
            "sun_clearance_deg": now["sun"]["clearance_deg"],
            "earth_clearance_deg": now["earth"]["clearance_deg"],
            "hours_to_sun_event": now["next"]["hours_to_sun_event"],
            "hours_to_earth_event": now["next"]["hours_to_earth_event"],
        })
    emit({"meta": meta(), "site": site.to_dict(), "horizon": mask.summary(), "settings": s.to_dict(),
          "step_days": args.step_days, "candidates": rows,
          "candidate_dates": [r["utc"] for r in rows if r["label"] == "CANDIDATO"]}, args)


def cmd_horizon(args):
    from lunar.horizon import DemStack, compute_mask, save_mask

    if not args.dem:
        raise SystemExit("Pasa al menos un --dem (del más fino al más grueso)")
    dems = DemStack(args.dem, args.max_px)
    targets = load_sites() if args.all else [get_site(args.site, args.lat, args.lon)]
    done = []
    for site in targets:
        t = time.time()
        m = compute_mask(site, dems, args.h_obs, args.az_step)
        if m.terrain:
            save_mask(site, m)
        done.append({"site": site.id, **m.summary(), "seconds": round(time.time() - t, 1)})
        print(f"  {site.id}: terreno={'sí' if m.terrain else 'no (fuera del DEM)'}", file=sys.stderr)
    emit({"meta": meta(), "computed": done}, args)


def cmd_export(args):
    from lunar.export import export_frontend

    emit({"meta": meta(), **export_frontend(Path(args.out_dir), args.start, args.end, args.step_min_export,
                                              args.h_obs)}, args)


def cmd_download(args):
    from lunar import download as dl

    out = {}
    if args.kernels:
        out["kernels"] = dl.get_kernels()
    if args.list_dems:
        out["dems_available"] = dl.list_dems()
    if args.dem_url:
        out["dems"] = [dl.get_dem(u) for u in args.dem_url]
    if not out:
        raise SystemExit("Usa --kernels, --list-dems o --dem-url URL")
    emit(out, args)


def cmd_info(args):
    label = kernels.load()
    emit({"meta": meta(), "kernels_loaded": kernels.loaded_files(), "kernel_set": label}, args)


# ------------------------------------------------------------------ CLI
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Cálculos de Sol, Tierra y horizonte en sitios lunares (JSON).")
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--out", help="Guardar el JSON en este archivo")
    common.add_argument("--print", action="store_true", help="Con --out, imprimir también en pantalla")
    common.add_argument("--compact", action="store_true", help="JSON en una sola línea")
    common.add_argument("--h-obs", type=float, default=2.0, help="Altura del observador en m (default 2)")
    common.add_argument("--eps-sun", type=float, default=0.5, help="ε del Sol: margen mínimo sobre el terreno (°)")
    common.add_argument("--eps-earth", type=float, default=0.5, help="ε de la Tierra: margen mínimo sobre el terreno (°)")
    common.add_argument("--min-light", type=float, default=72.0, help="Horas de Sol mínimas por delante")
    common.add_argument("--min-comm", type=float, default=24.0, help="Horas de Tierra visible mínimas por delante")

    where = argparse.ArgumentParser(add_help=False)
    where.add_argument("--site", help="ID del sitio (ver 'sites')")
    where.add_argument("--lat", type=float, help="Latitud en grados (sur negativo)")
    where.add_argument("--lon", type=float, help="Longitud en grados (oeste negativo)")
    where.add_argument("--utc", default=now_utc(), help="Instante, ej. 2026-11-14T18:00:00Z (default: ahora)")

    window = argparse.ArgumentParser(add_help=False)
    window.add_argument("--days", type=float, default=30, help="Duración de la ventana en días")
    window.add_argument("--step-min", type=float, default=10, help="Paso de muestreo en minutos")

    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("info", parents=[common], help="Kernels cargados").set_defaults(fn=cmd_info)
    sub.add_parser("sites", parents=[common], help="Lista de sitios").set_defaults(fn=cmd_sites)
    sub.add_parser("sky", parents=[common, where], help="Sol y Tierra en un instante").set_defaults(fn=cmd_sky)
    sub.add_parser("report", parents=[common, where, window], help="Todo: ahora + métricas + eventos") \
        .add_argument("--series", action="store_true", help="Incluir la serie completa")
    sub.choices["report"].set_defaults(fn=cmd_report)
    ev = sub.add_parser("evaluate", parents=[common], help="Punto (x, y) entre fecha de inicio y fin: CANDIDATO o no")
    ev.add_argument("--x", type=float, help="Longitud (°, oeste negativo)")
    ev.add_argument("--y", type=float, help="Latitud (°, sur negativo)")
    ev.add_argument("--site", help="Alternativa a --x/--y")
    ev.add_argument("--start", required=True, help="Inicio UTC, ej. 2026-11-14")
    ev.add_argument("--end", required=True, help="Fin UTC, ej. 2026-12-14")
    ev.add_argument("--step", type=float, default=None, help="Paso en minutos (default automático)")
    ev.add_argument("--series", action="store_true", help="Incluir la serie completa")
    ev.set_defaults(fn=cmd_evaluate)
    mi = sub.add_parser("mission", parents=[common], help="Aterrizar en una fecha y operar N días: ¿CANDIDATO?")
    mi.add_argument("--x", type=float, help="Longitud (°)")
    mi.add_argument("--y", type=float, help="Latitud (°)")
    mi.add_argument("--site", help="Alternativa a --x/--y")
    mi.add_argument("--landing", required=True, help="Fecha de aterrizaje UTC, ej. 2025-03-06T17:29:00Z")
    mi.add_argument("--duration", type=float, required=True, help="Duración en días")
    mi.add_argument("--battery", type=float, default=12, help="Horas que aguanta sin Sol")
    mi.add_argument("--max-comm-gap", type=float, default=24, help="Horas máximas sin Tierra")
    mi.add_argument("--search-days", type=float, default=15, help="Días para buscar alternativas")
    mi.add_argument("--series", action="store_true")
    mi.set_defaults(fn=cmd_mission)
    sub.add_parser("events", parents=[common, where, window], help="Salidas y puestas").set_defaults(fn=cmd_events)
    sub.add_parser("series", parents=[common, where, window], help="Serie de tiempo").set_defaults(fn=cmd_series)

    c = sub.add_parser("compare", parents=[common, window], help="Comparar sitios")
    c.add_argument("--sites", required=True, help="IDs separados por coma")
    c.add_argument("--utc", default=now_utc())
    c.set_defaults(fn=cmd_compare)

    sw = sub.add_parser("sweep", parents=[common, where], help="Barrido de fechas de aterrizaje")
    sw.add_argument("--days", type=float, default=60)
    sw.add_argument("--step-days", type=float, default=1)
    sw.set_defaults(fn=cmd_sweep)

    h = sub.add_parser("horizon", parents=[common, where], help="Calcular horizontes con DEM")
    h.add_argument("--dem", action="append", default=[])
    h.add_argument("--all", action="store_true", help="Todos los sitios del catálogo")
    h.add_argument("--max-px", type=int, default=8000)
    h.add_argument("--az-step", type=float, default=0.25)
    h.set_defaults(fn=cmd_horizon)

    d = sub.add_parser("download", parents=[common], help="Descargar kernels DE440 y DEMs de LOLA")
    d.add_argument("--kernels", action="store_true")
    d.add_argument("--list-dems", action="store_true")
    d.add_argument("--dem-url", action="append", default=[])
    d.set_defaults(fn=cmd_download)

    e = sub.add_parser("export", parents=[common], help="Datos para el frontend")
    e.add_argument("--out-dir", default=str(FRONTEND_DATA_DIR))
    e.add_argument("--start", default="2026-01-01")
    e.add_argument("--end", default="2031-01-01")
    e.add_argument("--step-min-export", type=int, default=60)
    e.set_defaults(fn=cmd_export)
    return p


if __name__ == "__main__":
    # En Windows la consola puede no ser UTF-8; así los acentos y "°" no truenan
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    a = build_parser().parse_args()
    a.fn(a)
