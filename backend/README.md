# Backend de cálculos (terminal → JSON)

Calcula, para cualquier sitio lunar y fecha, dónde están el Sol y la Tierra respecto al horizonte,
cuánto falta para el ocaso o Earthset, los % de luz y comunicación, y el semáforo de viabilidad.
Todo sale como JSON por la terminal o a un archivo.

> **Contrato con el frontend:** `docs/contrato-api.md` (fuente de verdad). Convenciones y slices: `backend/CLAUDE.md`
> y `docs/plan-equipos.md`. Todos los comandos de este documento se ejecutan **dentro de `backend/`**.

## 1. Estructura

```
backend/
  api.py           API FastAPI (uvicorn api:app --reload --port 8000)
  main.py          CLI
  lunar/           paquete de cálculos
  kernels/         kernels SPICE (DE421 incluidos, ~18 MB)
  data/sites.json      catálogo de sitios (fuente de verdad del catálogo)
  data/horizons.json   horizontes precalculados con LOLA (sí se versiona)
  data/dem/            DEMs de LOLA (NO se versiona: 189 MB)
  tests/
```

## 2. Instalar dependencias (en la terminal de PyCharm, con el .venv activo)

Con **uv** (si su pyproject lo creó uv):
```
uv add spiceypy numpy
uv add rasterio pyproj scipy requests pytest   # opcional: horizontes con DEM y pruebas
```
Con **pip**:
```
pip install -r requirements.txt
```
Requiere Python 3.10 o más nuevo.

## 3. Comandos

| Comando | Qué devuelve |
| --- | --- |
| `python main.py info` | Kernels cargados |
| `python main.py sites` | Catálogo de sitios |
| `python main.py sky --site ID --utc FECHA` | Sol y Tierra en un instante + próximo ocaso/Earthset + semáforo |
| `python main.py report --site ID --days 30` | Lo anterior + métricas de la ventana + eventos (`--series` agrega la serie completa) |
| `python main.py events --site ID --days 60` | Salidas y puestas del Sol y la Tierra |
| `python main.py series --site ID --days 3 --step-min 30` | Serie de azimut/elevación |
| `python main.py compare --sites A,B,C --days 30` | Comparación ordenada por % de tiempo con Sol y Tierra |
| `python main.py sweep --site ID --days 60 --step-days 1` | “¿Qué pasa si me retraso?”: CANDIDATO / NO CANDIDATO por fecha (`candidate_dates`) |
| `python main.py horizon --all --dem FINO.tif --dem GRUESO.tif` | Calcula horizontes reales con DEM de LOLA (se guardan en `data/horizons.json`) |
| `python main.py export --out-dir frontend/public/data` | Archivos para que el frontend calcule en el navegador |
| `python main.py download --kernels` / `--list-dems` / `--dem-url URL` | Descarga DE440 y DEMs de NASA |

Opciones comunes: `--lat` y `--lon` en lugar de `--site`; `--utc 2026-11-14T18:00:00Z` (por defecto, ahora);
`--out output/x.json` para guardar; `--print` para además imprimir; `--compact` para una sola línea;
`--h-obs 2` (m), `--eps-sun 0.5` y `--eps-earth 0.5` (°), `--min-light 72` (h), `--min-comm 24` (h).

## Interferencia y CANDIDATO / NO CANDIDATO

Para el Sol y la Tierra se compara su elevación con la altura del terreno en ese mismo azimut:

| Estado (`status`) | Condición | Significado |
| --- | --- | --- |
| `bajo_horizonte` | elevación ≤ horizonte ideal (esfera lisa) | No ha salido; no es culpa del terreno |
| `interferencia_terreno` | horizonte ideal < elevación ≤ terreno | Ya salió, pero una montaña lo tapa |
| `marginal` | 0 < elevación − terreno < ε | Se ve, pero demasiado pegado al terreno |
| `despejado` | elevación − terreno ≥ ε | Se ve con margen suficiente |

**CANDIDATO** solo si se cumplen las cuatro reglas (`now.candidate.checks`):
1. Sol `despejado` (margen ≥ ε_sol)
2. Tierra `despejada` (margen ≥ ε_tierra)
3. Horas de Sol por delante ≥ `--min-light`
4. Horas de Tierra visible por delante ≥ `--min-comm`

Si falla alguna: **NO CANDIDATO**, con la lista de motivos en `now.candidate.reasons`.

¿Por qué ε? El DEM tiene error (≈0.3–0.5 m en los de 5 m de PGDA), el Sol mide 0.27° de radio y la Tierra
0.95°, y la antena necesita algo de margen. Con ε = 0.5° el Sol se exige con el disco completo y un colchón.
Súbanlo para ser más conservadores.

La interferencia solo aparece con horizonte real: con la esfera lisa el terreno nunca tapa nada.

## 4. Formato del JSON (`report`)

```json
{
  "meta":    {"schema": "1.0", "kernels": "DE421", "frame": "MOON_ME", "abcorr": "LT+S", "angles": "..."},
  "site":    {"id", "name", "lat", "lon", "category", "verified", "source", "note"},
  "horizon": {"terrain": false, "dem": [], "z_m": null, "h_obs_m": 2.0, "az_step_deg": 1.0, "max_deg", "min_deg"},
  "settings":{"h_obs_m", "earth_margin_deg", "min_light_hours"},
  "now": {
    "utc": "2026-11-14T18:00:00Z",
    "sun":   {"azimuth_deg", "elevation_deg", "horizon_deg", "ideal_horizon_deg", "clearance_deg",
              "epsilon_deg", "status", "terrain_interference", "line_of_sight",
              "angular_radius_deg", "visible_fraction", "distance_km", "visible"},
    "earth": { ...mismos campos... },
    "next":  {"sun_event": "sunset|sunrise|null", "sun_event_utc", "hours_to_sun_event",
              "earth_event": "earthset|earthrise|null", "earth_event_utc", "hours_to_earth_event",
              "search_limit_days": 60},
    "candidate": {"is_candidate": true, "label": "CANDIDATO|NO CANDIDATO", "code": "go|caution|nogo",
                  "interference": {"sun": false, "earth": false},
                  "reasons": ["..."], "checks": [{"id", "ok", "value", "threshold", "detail"}]}
  },
  "window": {
    "start_utc", "end_utc", "days", "step_min",
    "metrics": {"pct_sun_energy", "pct_sun_visible", "pct_sun_full_disk", "pct_earth_visible",
                "pct_sun_and_earth", "pct_sun_blocked_by_terrain", "pct_earth_blocked_by_terrain", "longest_light_h", "longest_dark_h", "longest_earth_gap_h",
                "max_sun_elevation_deg", "min_sun_elevation_deg"},
    "events": [{"utc", "type": "sunrise|sunset|earthrise|earthset"}]
  },
  "series": {"start_utc", "step_min", "count", "sun_az", "sun_el", "sun_frac", "sun_interference",
             "earth_az", "earth_el", "earth_visible", "earth_interference"}
}
```

`null` en `next` = no hay cambio en los próximos 60 días (por ejemplo, Sol continuo en verano polar).

## 5. Cómo se calcula

- Posiciones: `spiceypy.azlcpo` (SPICE oficial de NASA), marco MOON_ME, corrección de luz y aberración (LT+S).
- Horizonte: esfera lisa hasta que corran `horizon` con DEM de LOLA; el JSON lo indica en `horizon.terrain`.
- Eventos: muestreo cada `--step-min` y bisección a ~1 s.
- Pruebas: `python -m pytest tests -q` (polo con Sol rasante, lado oculto sin Tierra, ecuador con ~50% de luz).

## 6. API (el usuario ingresa coordenadas y fechas)

Instalar y arrancar:
```
uv add fastapi uvicorn          (o: pip install fastapi uvicorn)
uvicorn api:app --reload --port 8000
```
Abran **http://localhost:8000/docs**: es un formulario interactivo para probar sin escribir código.

### Entrada — `POST /api/evaluate`

```json
{
  "x": -136.6667,            // longitud (°, oeste negativo)
  "y": -89.4667,             // latitud (°, sur negativo)
  "start": "2026-11-14",     // inicio UTC (también acepta 2026-11-14T18:00:00Z)
  "end": "2026-12-14",       // fin UTC (máximo 366 días)
  "eps_sun_deg": 0.5,        // opcionales:
  "eps_earth_deg": 0.5,
  "min_light_hours": 72,
  "min_comm_hours": 24,
  "h_obs_m": 2,
  "include_series": false    // true = series para gráficas (más pesado)
}
```
En lugar de `x`/`y` pueden mandar `"site_id": "connecting-ridge"`.
Para probar desde el navegador: `http://localhost:8000/api/evaluate?x=-136.6667&y=-89.4667&start=2026-11-14&end=2026-12-14`

### Salida (resumen)

```json
{
  "input":   {"x_lon", "y_lat", "start_utc", "end_utc", "days", "step_min"},
  "horizon": {"terrain": false, ...},
  "settings":{"eps_sun_deg", "eps_earth_deg", "min_light_hours", "min_comm_hours", "h_obs_m"},
  "result": {
    "is_candidate": true,
    "label": "CANDIDATO",
    "first_landing_utc": "2026-11-18T05:40:00Z",
    "best_window": {"start_utc", "end_utc", "duration_h"},
    "landing_windows": [{"start_utc", "end_utc", "duration_h"}],
    "reasons": []                       // motivos si es NO CANDIDATO
  },
  "at_start": { ...igual que `now` del CLI: sun, earth, next, candidate... },
  "metrics":  {"pct_time_candidate", "pct_sun_visible", "pct_earth_visible", "pct_sun_and_earth",
               "pct_sun_blocked_by_terrain", "pct_earth_blocked_by_terrain", "longest_dark_h", ...},
  "events":   [{"utc", "type"}],
  "series":   {"t_utc", "sun_el", "sun_az", "sun_clearance", "sun_interference", "earth_el", ...,
               "candidate"}            // solo con include_series
}
```

Errores: `422` con `{"detail": "mensaje"}` (fechas al revés, coordenadas fuera de rango, fecha fuera de la cobertura de las efemérides).
Otros endpoints: `GET /api/health`, `GET /api/sites`.

Lo mismo desde la terminal: `python main.py evaluate --x -136.6667 --y -89.4667 --start 2026-11-14 --end 2026-12-14`

### Desde el frontend (React + TypeScript)

```ts
const res = await fetch("http://localhost:8000/api/evaluate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ x: lon, y: lat, start, end, eps_sun_deg: 0.5, eps_earth_deg: 0.5 }),
});
if (!res.ok) throw new Error((await res.json()).detail);
const data = await res.json();
console.log(data.result.label, data.result.landing_windows);
```

En desarrollo el frontend llama a `/api/...` y Vite lo reenvía a `localhost:8000` (proxy en `frontend/vite.config.ts`),
así que el puerto del front no importa. El CORS de `api.py` solo hace falta si se llama sin proxy.

Si hay DEMs de LOLA en `data/dem/`, cualquier coordenada nueva usa relieve real automáticamente
(se calcula al vuelo, ~1–3 s la primera vez por punto).

## 7. Misión: fecha de aterrizaje + fecha de salida de la Luna (endpoint principal)

El usuario indica **dónde** (x, y), **cuándo aterriza** y **cuándo sale de la Luna** (fecha y hora). La duración se
calcula sola (`input.duration_days`). La API dice si es CANDIDATO.

`POST /api/mission`
```json
{
  "x": 29.1957, "y": -84.7906,
  "landing": "2025-03-06T17:29:00Z",
  "departure": "2025-03-16T05:00:00Z",   // salida de la Luna (obligatoria)
  "eps_sun_deg": 0.5,          // opcionales
  "eps_earth_deg": 0.5,
  "battery_hours": 12,         // horas que aguanta sin Sol
  "max_comm_gap_hours": 24,    // horas máximas sin ver la Tierra
  "h_obs_m": 2,
  "search_days": 15            // ± días para buscar fechas alternativas
}
```
Navegador: `http://127.0.0.1:8000/api/mission?x=29.1957&y=-84.7906&landing=2025-03-06T17:29:00Z&departure=2025-03-16T05:00:00Z`

**Reglas de CANDIDATO** (`result.checks`):
1. Al aterrizar, Sol despejado (≥ ε_sol sobre el terreno)
2. Al aterrizar, Tierra despejada (≥ ε_tierra) → comunicación durante el descenso
3. Durante la misión, la noche más larga ≤ `battery_hours`
4. Durante la misión, el hueco más largo sin Tierra ≤ `max_comm_gap_hours`

**Salida**
```json
"result": {
  "label": "CANDIDATO | NO CANDIDATO",
  "reasons": ["..."],
  "checks": [{"id", "ok", "value", "threshold"}],
  "alternatives": {"before": {"landing_utc", "departure_utc", "shift_days"}, "after": {...}},  // misma duración
  "max_feasible_duration_days": 11.11    // cuánto se puede operar si aterrizas en esa fecha
},
"at_landing":     { sun, earth, next, candidate },      // condiciones en el momento del aterrizaje
"during_mission": {"pct_sun", "pct_earth", "pct_sun_and_earth", "pct_sun_blocked_by_terrain",
                   "pct_earth_blocked_by_terrain", "longest_dark_h", "longest_comm_gap_h",
                   "first_sun_loss_utc", "first_comm_loss_utc", "events": [...]}
```
Si no hay alternativas y `max_feasible_duration_days` es menor que la duración pedida, la misión es más larga de lo
que el sitio permite: acorten la misión, suban `battery_hours` o acepten huecos de comunicación más largos.

Terminal: `python main.py mission --x 29.1957 --y -84.7906 --landing 2025-03-06T17:29:00Z --departure 2025-03-16T05:00:00Z`

`/api/evaluate` (rango de fechas) sigue disponible para buscar ventanas sin fecha fija.

## 8. Datos de validación y pruebas

- `data/real_missions.json`: 7 misiones reales (Apollo 11, IM-1, SLIM, Blue Ghost M1, IM-2, Chandrayaan-3, Chang'e-6)
  con coordenadas, hora de aterrizaje, lo observado y la fuente.
- `python main.py validate` → `output/validation_report.md` (tabla legible) y JSON con cada comprobación.
- `data/sites.json`: 15 sitios, todos con coordenada verificada y fuente (incluye Apollo 11–17 en marco MOON_ME DE421, NSSDC).

Pruebas (`python -m pytest tests -q`, 42 en total):

| Archivo | Qué prueba |
| --- | --- |
| `test_calculos.py` | Fracción de disco, Sol rasante en el polo, lado oculto sin Tierra, ~50% de luz en el ecuador, interferencia con una “pared” de terreno |
| `test_real_missions.py` | Modelo vs. 7 misiones reales (Blue Ghost: 346 h de luz reportadas vs. 348 h del modelo; SLIM: ocaso el 31 ene 2024) |
| `test_casos_borde.py` | Polo exacto, longitud 200 = −160, Tierra en el cenit en (0,0), ε más alto nunca da más candidatos, eventos alternan, día lunar de 29.5 d, alternativa sugerida sí es candidata, formatos de fecha, entradas inválidas → 422 |
| `test_api.py`, `test_mission.py` | Endpoints `/api/evaluate` y `/api/mission` |
