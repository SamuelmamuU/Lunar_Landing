"""API del Lunar Landing Site Navigator.

Arrancar:   uvicorn api:app --reload --port 8000
Probar:     http://localhost:8000/docs   (formulario interactivo de Swagger)

Entrada principal (POST /api/evaluate):
  x = longitud (°, oeste negativo), y = latitud (°, sur negativo),
  start = fecha de inicio, end = fecha de fin (UTC)
Salida: CANDIDATO / NO CANDIDATO con ε, interferencia del terreno, ventanas de aterrizaje y métricas.
"""
import sys
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

# Asegurar que el directorio backend esté en sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import spiceypy as sp
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, ValidationError, model_validator

from lunar import kernels
from lunar.evaluate import evaluate
from lunar.horizon import auto_dems
from lunar.mission import MissionRules, mission
from lunar.report import Settings, meta
from lunar.sites import Site, load_sites

@asynccontextmanager
async def lifespan(_app):
    kernels.load()  # cargar SPICE una sola vez al arrancar
    # Precargar el DEM (~4 s) en segundo plano: la primera coordenada personalizada ya no paga esa espera
    threading.Thread(target=auto_dems, name="precarga-dem", daemon=True).start()
    yield


app = FastAPI(title="Lunar Landing Site Navigator API", version="1.0", lifespan=lifespan,
              description="Sol, Tierra e interferencia del terreno para un punto lunar en un rango de fechas.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)


def _today(offset_days: int = 0) -> str:
    d = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=offset_days)
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


class EvaluateIn(BaseModel):
    x: Optional[float] = Field(None, ge=-180, le=360, description="Longitud en grados (oeste negativo)", examples=[-136.6667])
    y: Optional[float] = Field(None, ge=-90, le=90, description="Latitud en grados (sur negativo)", examples=[-89.4667])
    site_id: Optional[str] = Field(None, description="Alternativa a x/y: ID de un sitio del catálogo",
                                   examples=["connecting-ridge"])
    start: str = Field(default_factory=_today, description="Inicio UTC, ej. 2026-11-14 o 2026-11-14T18:00:00Z",
                       examples=["2026-11-14"])
    end: str = Field(default_factory=lambda: _today(30), description="Fin UTC", examples=["2026-12-14"])
    eps_sun_deg: float = Field(0.5, ge=0, le=10, description="ε del Sol: margen mínimo sobre el terreno (°)")
    eps_earth_deg: float = Field(0.5, ge=0, le=10, description="ε de la Tierra: margen mínimo sobre el terreno (°)")
    min_light_hours: float = Field(72, ge=0, le=2000, description="Horas de Sol mínimas por delante")
    min_comm_hours: float = Field(24, ge=0, le=2000, description="Horas de Tierra visible mínimas por delante")
    h_obs_m: float = Field(2, ge=0, le=100, description="Altura del panel/antena sobre el terreno (m)")
    step_min: Optional[float] = Field(None, ge=1, le=360, description="Paso de muestreo; vacío = automático")
    include_series: bool = Field(False, description="Incluir la serie completa (para gráficas)")
    include_events: bool = True

    @model_validator(mode="after")
    def _where(self):
        if self.site_id is None and (self.x is None or self.y is None):
            raise ValueError("Envía x y y (coordenadas) o un site_id")
        return self


def _site(body) -> Site:
    # Si viene site_id gana: se usa el sitio del catálogo (y su horizonte precalculado) y se ignoran x/y
    if body.site_id is not None:
        for s in load_sites():
            if s.id == body.site_id:
                return s
        raise HTTPException(404, f"Sitio '{body.site_id}' no existe. Usa GET /api/sites para ver los IDs.")
    lat = max(-89.995, min(89.995, body.y))
    lon = ((body.x + 180) % 360) - 180
    return Site(id=f"custom_{lat:.4f}_{lon:.4f}", name="Punto del usuario", lat=lat, lon=lon)


def _run(body: EvaluateIn) -> dict:
    s = Settings(h_obs_m=body.h_obs_m, eps_sun_deg=body.eps_sun_deg, eps_earth_deg=body.eps_earth_deg,
                 min_light_hours=body.min_light_hours, min_comm_hours=body.min_comm_hours)
    try:
        return evaluate(_site(body), body.start, body.end, s, body.step_min, body.include_series, body.include_events)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except sp.stypes.SpiceyError as e:
        raise HTTPException(422, f"Fecha fuera de la cobertura de las efemérides: {e.short}")


# ------------------------------------------------------------------ errores de validación en español
_MSG_ES = {
    "missing": "falta el campo obligatorio",
    "float_parsing": "debe ser un número", "float_type": "debe ser un número",
    "int_parsing": "debe ser un número entero", "int_type": "debe ser un número entero",
    "string_type": "debe ser texto",
    "bool_parsing": "debe ser true o false", "bool_type": "debe ser true o false",
    "finite_number": "debe ser un número finito",
    "json_invalid": "el cuerpo de la petición no es JSON válido",
    "model_attributes_type": "el cuerpo debe ser un objeto JSON", "dict_type": "el cuerpo debe ser un objeto JSON",
}
_LIMITES_ES = {"greater_than_equal": ("ge", "mayor o igual a"), "greater_than": ("gt", "mayor que"),
               "less_than_equal": ("le", "menor o igual a"), "less_than": ("lt", "menor que")}


def _campo(loc) -> str:
    """('body', 'departure') -> 'departure'; ('query', 'x') -> 'x'; ('body',) -> ''."""
    return ".".join(str(x) for x in loc if x not in ("body", "query", "path"))


def _msg_es(err: dict) -> str:
    """Mensaje de Pydantic traducido al español; si el tipo no está en la tabla, se deja el original."""
    t, ctx, campo = err.get("type", ""), err.get("ctx") or {}, _campo(err.get("loc", ()))
    if t == "value_error":   # nuestros model_validator: el texto ya está en español
        return str(ctx.get("error", err["msg"])).removeprefix("Value error, ")
    if t in _LIMITES_ES:
        key, txt = _LIMITES_ES[t]
        lim = ctx.get(key)
        base = f"debe ser {txt} {lim:g}" if isinstance(lim, (int, float)) else f"debe ser {txt} {lim}"
    else:
        base = _MSG_ES.get(t)
        if base is None:
            return err["msg"]
    return f"{campo}: {base}" if campo else base[0].upper() + base[1:]


def _errors(e: ValidationError) -> list[dict]:
    """Errores de validación legibles para los GET: [{campo, mensaje}]."""
    return [{"campo": _campo(err["loc"]), "mensaje": _msg_es(err)} for err in e.errors()]


@app.exception_handler(RequestValidationError)
async def _validation_es(_request: Request, exc: RequestValidationError):
    """Misma forma que FastAPI ({detail: [{loc, msg, type}]}) con `msg` en español."""
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": list(err.get("loc", ())), "msg": _msg_es(err), "type": err.get("type", "")} for err in exc.errors()]})


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/api/health")
def health():
    return {"status": "ok", **meta()}


@app.get("/api/sites")
def sites():
    return {"sites": [s.to_dict() for s in load_sites()]}


@app.post("/api/evaluate")
def evaluate_post(body: EvaluateIn):
    """Evalúa un punto (x, y) entre start y end. Devuelve CANDIDATO / NO CANDIDATO y las ventanas."""
    return _run(body)


@app.get("/api/evaluate")
def evaluate_get(
    x: float = Query(..., description="Longitud (°)"), y: float = Query(..., description="Latitud (°)"),
    start: str = Query(default_factory=_today), end: str = Query(default_factory=lambda: _today(30)),
    eps_sun_deg: float = 0.5, eps_earth_deg: float = 0.5,
    min_light_hours: float = 72, min_comm_hours: float = 24, h_obs_m: float = 2,
):
    """Lo mismo por GET, para probar desde el navegador: /api/evaluate?x=-136.67&y=-89.47&start=2026-11-14&end=2026-12-14"""
    try:
        body = EvaluateIn(x=x, y=y, start=start, end=end, eps_sun_deg=eps_sun_deg, eps_earth_deg=eps_earth_deg,
                          min_light_hours=min_light_hours, min_comm_hours=min_comm_hours, h_obs_m=h_obs_m)
    except ValidationError as e:
        raise HTTPException(422, _errors(e))
    return _run(body)


# ------------------------------------------------------------------ misión: aterrizaje + salida de la Luna
class MissionIn(BaseModel):
    x: Optional[float] = Field(None, ge=-180, le=360, description="Longitud (°, oeste negativo)", examples=[29.1957])
    y: Optional[float] = Field(None, ge=-90, le=90, description="Latitud (°, sur negativo)", examples=[-84.7906])
    site_id: Optional[str] = Field(None, description="Alternativa a x/y", examples=["mons-mouton-im2"])
    landing: str = Field(..., description="Fecha y hora de aterrizaje UTC, ej. 2025-03-06T17:29:00Z",
                         examples=["2025-03-06T17:29:00Z"])
    departure: str = Field(..., description="Fecha y hora UTC en que la misión sale de la Luna, "
                           "ej. 2025-03-16T05:00:00Z. La duración se calcula sola", examples=["2025-03-16T05:00:00Z"])
    eps_sun_deg: float = Field(0.5, ge=0, le=10, description="ε del Sol (°)")
    eps_earth_deg: float = Field(0.5, ge=0, le=10, description="ε de la Tierra (°)")
    battery_hours: float = Field(12, ge=0, le=5000, description="Horas que aguanta sin Sol (batería)")
    max_comm_gap_hours: float = Field(24, ge=0, le=5000, description="Horas máximas tolerables sin Tierra")
    h_obs_m: float = Field(2, ge=0, le=100, description="Altura del panel/antena (m)")
    search_days: float = Field(15, ge=0, le=60, description="Días antes/después para buscar alternativas")
    include_series: bool = False

    @model_validator(mode="after")
    def _where(self):
        if self.site_id is None and (self.x is None or self.y is None):
            raise ValueError("Envía x y y (coordenadas) o un site_id")
        return self


def _run_mission(body: MissionIn) -> dict:
    rules = MissionRules(body.eps_sun_deg, body.eps_earth_deg, body.battery_hours, body.max_comm_gap_hours,
                         body.h_obs_m)
    try:
        return mission(_site(body), body.landing, body.departure, rules, body.search_days,
                       include_series=body.include_series)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except sp.stypes.SpiceyError as e:
        raise HTTPException(422, f"Fecha fuera de la cobertura de las efemérides: {e.short}")


@app.post("/api/mission")
def mission_post(body: MissionIn):
    """Aterrizar en `landing` y salir de la Luna en `departure`: ¿CANDIDATO? Si no, sugiere fechas."""
    return _run_mission(body)


@app.get("/api/mission")
def mission_get(
    x: float = Query(..., description="Longitud (°)"), y: float = Query(..., description="Latitud (°)"),
    landing: str = Query(..., description="Fecha y hora de aterrizaje UTC, ej. 2025-03-06T17:29:00Z"),
    departure: str = Query(..., description="Fecha y hora de salida de la Luna UTC, ej. 2025-03-16T05:00:00Z"),
    eps_sun_deg: float = 0.5, eps_earth_deg: float = 0.5,
    battery_hours: float = 12, max_comm_gap_hours: float = 24, h_obs_m: float = 2, search_days: float = 15,
):
    """Para probar en el navegador:
    /api/mission?x=29.1957&y=-84.7906&landing=2025-03-06T17:29:00Z&departure=2025-03-16T05:00:00Z"""
    try:
        body = MissionIn(x=x, y=y, landing=landing, departure=departure, eps_sun_deg=eps_sun_deg,
                         eps_earth_deg=eps_earth_deg, battery_hours=battery_hours,
                         max_comm_gap_hours=max_comm_gap_hours, h_obs_m=h_obs_m, search_days=search_days)
    except ValidationError as e:
        raise HTTPException(422, _errors(e))
    return _run_mission(body)
