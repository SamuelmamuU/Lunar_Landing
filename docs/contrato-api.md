# Contrato de datos backend ↔ frontend (v1)

**Estado:** propuesta para revisión de ambos equipos (2026-11-14). Una vez aceptado, cualquier cambio se hace
primero aquí y se avisa al otro equipo.

**Principio:** el contrato es **la API que el backend ya tiene** (probada con 82 pruebas y 7 misiones reales).
No se inventan endpoints nuevos. El backend habla `snake_case`; el frontend lo traduce a su modelo interno
(`camelCase`) en un solo archivo: `frontend/src/services/lunarApi.ts`.

Ejemplos reales (generados por la API, no escritos a mano) en `docs/ejemplos/`:
`evaluate-im2-1dia.json`, `mission-im2-10dias.json`, `sites.json`.

---

## 1. Convenciones (obligatorias para ambos)

| Tema | Convención |
|---|---|
| Ángulos | Grados |
| Latitud | −90..90, sur negativo (`y`) |
| Longitud | −180..180, este positivo (`x`). El backend acepta 0..360 y la normaliza |
| Azimut | 0..360 desde el norte local, sentido horario (0 = N, 90 = E, 180 = S, 270 = O) |
| Elevación | Sobre el plano horizontal local del observador. Puede ser negativa |
| Horizonte | `profile_deg[i]` = elevación del terreno en el azimut `i * az_step_deg`. Índice 0 = norte, crece hacia el este. Incluye relieve **y** curvatura de la Luna |
| Tiempo | ISO 8601 UTC con `Z` (`2026-11-14T18:00:00Z`). El backend también acepta `2026-11-14` |
| Marco | `MOON_ME`, corrección `LT+S`, kernels DE421 (SPICE) |
| Observador | 2 m sobre el terreno (`h_obs_m`) |

## 2. Definición de "visible" (igual en back y front)

Para cada cuerpo, `clearance = elevación del centro − elevación del terreno en ese azimut`.

| Concepto | Regla | Campo |
|---|---|---|
| **Sol visible** (hay luz) | Asoma cualquier parte del disco: `visible_fraction > 0` | `sun_frac[i] > 0` |
| **Tierra visible** (hay comunicación) | El centro del disco está sobre el terreno: `clearance > 0` | `earth_visible[i]` |
| **Despejado** (con margen de seguridad) | `clearance ≥ ε` (ε = 0.5° por defecto) | `sun_clear[i]`, `earth_clear[i]` |
| Tapado por el terreno | Estaría sobre el horizonte liso, pero una montaña lo tapa | `sun_interference[i]`, `earth_interference[i]` |

Radios angulares: Sol ≈ 0.27°, Tierra ≈ 0.95–0.98°. El `status` de un instante es uno de:
`bajo_horizonte`, `interferencia_terreno`, `marginal`, `despejado`.

**CANDIDATO** en un instante = Sol despejado + Tierra despejada + ≥ 72 h de Sol por delante + ≥ 24 h de Tierra por
delante (umbrales configurables).

## 3. Endpoints

Base en desarrollo: `http://localhost:8000`. El frontend usa rutas relativas `/api/...` (proxy de Vite).

### 3.1 `GET /api/sites` — catálogo (fuente de verdad: `backend/data/sites.json`)

```json
{ "sites": [ { "id": "mons-mouton-im2", "name": "IM-2 Athena (Mons Mouton)", "lat": -84.7906, "lon": 29.1957,
               "category": "CLPS", "verified": true, "source": "https://...", "note": "..." } ] }
```

Campos opcionales (agregados en el slice B2; si un sitio no tiene el dato, el campo no aparece):
`category_id` (`artemis | clps | international | apollo | reference`), `agency`, `mission`, `landed_utc`.

### 3.2 `POST /api/evaluate` — **endpoint principal del frontend**

Un sitio + un rango de fechas → horizonte, serie de tiempo, métricas, eventos y veredicto. 30 días con paso de
60 min tardan ~0.3 s.

Petición:

```json
{
  "site_id": "mons-mouton-im2",
  "start": "2025-03-06T17:29:00Z",
  "end": "2025-04-05T17:29:00Z",
  "step_min": 60,
  "include_series": true
}
```

- Sitio del catálogo: mandar **solo `site_id`**. Sitio personalizado: mandar **solo `x` (lon) y `y` (lat)**.
  **No mandar ambos:** si vienen `x`/`y`, el backend ignora `site_id` y no usa el horizonte precalculado
  (se pierde el relieve real).
- Opcionales: `eps_sun_deg`, `eps_earth_deg` (0.5), `min_light_hours` (72), `min_comm_hours` (24), `h_obs_m` (2).
- Límites: rango máximo 366 días; `step_min` entre 1 y 360; sin `step_min` el backend elige el paso
  (mínimo 10 min, máximo ~6000 muestras). El frontend usa siempre 60 min.

Respuesta (resumen; completo en `docs/ejemplos/evaluate-im2-1dia.json`):

```json
{
  "meta":    { "schema": "1.0", "kernels": "DE421", "frame": "MOON_ME", "abcorr": "LT+S" },
  "input":   { "x_lon": 29.1957, "y_lat": -84.7906, "start_utc": "...", "end_utc": "...", "days": 30.0, "step_min": 60 },
  "site":    { "id": "mons-mouton-im2", "name": "...", "lat": -84.7906, "lon": 29.1957, "category": "CLPS" },
  "horizon": { "terrain": true, "dem": ["LDEM_80S_80MPP_ADJ.TIF (~80 m/px)"], "z_m": 5321.5, "h_obs_m": 2.0,
               "az_step_deg": 0.25, "max_deg": 4.061, "min_deg": -1.47, "profile_deg": [ "...1440 valores..." ] },
  "result":  { "is_candidate": true, "label": "CANDIDATO", "first_landing_utc": "...",
               "best_window": { "start_utc": "...", "end_utc": "...", "duration_h": 296.0 },
               "landing_windows": [ { "start_utc": "...", "end_utc": "...", "duration_h": 296.0 } ],
               "reasons": [] },
  "at_start": {
    "utc": "2025-03-06T17:29:00Z",
    "sun":   { "azimuth_deg": 65.6789, "elevation_deg": 2.4647, "horizon_deg": 0.8367, "clearance_deg": 1.628,
               "status": "despejado", "visible": true, "visible_fraction": 1.0, "angular_radius_deg": 0.2686 },
    "earth": { "azimuth_deg": 335.8463, "elevation_deg": 11.1924, "horizon_deg": -1.1161, "clearance_deg": 12.3085,
               "status": "despejado", "visible": true, "visible_fraction": 1.0, "angular_radius_deg": 0.9751 },
    "next":  { "sun_event": "sunset", "sun_event_utc": "2025-03-19T22:57:26Z", "hours_to_sun_event": 317.474,
               "earth_event": "earthset", "earth_event_utc": "2025-03-19T04:06:39Z", "hours_to_earth_event": 298.627,
               "search_limit_days": 60 },
    "candidate": { "is_candidate": true, "label": "CANDIDATO", "code": "go", "reasons": [], "checks": [ "..." ] },
    "vectors_3d": { "...": "opcional, para la vista 3D (extra)" }
  },
  "metrics": { "pct_sun_energy": 51.53, "pct_sun_visible": 52.84, "pct_sun_full_disk": 50.21,
               "pct_earth_visible": 82.66, "pct_sun_and_earth": 52.84,
               "longest_light_h": 381.0, "longest_dark_h": 312.0, "longest_earth_gap_h": 125.0,
               "pct_sun_blocked_by_terrain": 8.18, "pct_earth_blocked_by_terrain": 0.0,
               "max_sun_elevation_deg": 6.746, "min_sun_elevation_deg": -3.761, "pct_time_candidate": 41.05 },
  "events":  [ { "utc": "2025-03-19T04:06:39Z", "type": "earthset" } ],
  "series":  { "start_utc": "...", "step_min": 60, "count": 721, "t_utc": ["..."],
               "sun_az": [], "sun_el": [], "sun_frac": [], "sun_clearance": [], "sun_interference": [], "sun_clear": [],
               "earth_az": [], "earth_el": [], "earth_clearance": [], "earth_visible": [], "earth_interference": [],
               "earth_clear": [], "candidate": [] }
}
```

Notas:
- `series` es **columnar**: todas las listas tienen `count` elementos y el índice `i` corresponde a `t_utc[i]`.
- Elevación del terreno en el azimut del cuerpo = `*_el[i] − *_clearance[i]`.
- `next.*` es `null` si no hay cambio en los próximos 60 días (p. ej. Sol continuo, o lado oculto sin Tierra).
- `events[].type`: `sunrise | sunset | earthrise | earthset`, con precisión de ~1 s.
- `horizon.terrain: false` = no hay relieve para ese punto (esfera lisa). **El front debe avisarlo.**
- Pendiente (slice B2): agregar `earth_frac` a la serie. Mientras no exista, el front usa 1 / 0 según `earth_visible`.

### 3.3 `POST /api/mission` — "aterrizo en esta fecha y opero N días" (extra F7)

```json
{ "site_id": "mons-mouton-im2", "landing": "2025-03-06T17:29:00Z", "duration_days": 10,
  "battery_hours": 12, "max_comm_gap_hours": 24 }
```

Devuelve `result` (`label`, `reasons`, `checks`, `alternatives.before/after` con fechas cercanas que sí cumplen,
`max_feasible_duration_days`), `at_landing` (igual que `at_start`) y `during_mission` (porcentajes, noche más larga,
hueco de comunicación más largo). Ejemplo completo: `docs/ejemplos/mission-im2-10dias.json`.
Sirve para "se retrasó el lanzamiento: ¿qué fecha cercana sí funciona?".

### 3.4 `GET /api/health`

`{ "status": "ok", "schema": "1.0", "kernels": "DE421", ... }`. Para saber si el backend está arriba.

## 4. Errores

| Status | Cuándo | Cuerpo |
|---|---|---|
| 404 | `site_id` no existe | `{ "detail": "Sitio 'x' no existe. ..." }` |
| 422 | Regla de negocio (fechas al revés, rango > 366 días, fecha sin efemérides) | `{ "detail": "mensaje en español" }` |
| 422 | Validación de campos (Pydantic) | `{ "detail": [ { "loc": ["body","x"], "msg": "..." } ] }` |

El front muestra `detail` si es texto; si es lista, une los `msg`.

## 5. Fuentes de datos (`source`)

- Posiciones: **SPICE** (`spiceypy.azlcpo`), kernels DE421 → `meta.kernels`.
- Terreno: **LOLA** `LDEM_80S_80MPP_ADJ.TIF` (polo sur, 80°S a 90°S, 80 m/px), rayos hasta 200 km →
  `horizon.dem` y `horizon.terrain`.
- En el front: `source: 'spice'` con backend real, `source: 'mock'` con datos sintéticos (aviso visible).

Cobertura del terreno:

| Caso | Horizonte |
|---|---|
| Sitio del catálogo con horizonte precalculado en `data/horizons.json` (hoy 9, todos los del catálogo al sur de 80°S: connecting-ridge, south-pole-rim, mons-mouton-im2, mons-mouton-summit, malapert-a-im1, shackleton-floor, mons-malapert, haworth, nobile) | Relieve real, en cualquier máquina |
| Coordenadas personalizadas al sur de 80°S **y** con el `.TIF` en `backend/data/dem/` | Relieve real, calculado al vuelo (1–3 s la primera vez) |
| Cualquier otro caso (norte de 80°S, o sin el `.TIF`) | Esfera lisa (`terrain: false`) |

## 6. Modelo interno del frontend (referencia)

`frontend/src/shared/types/lunar.ts`. El adaptador de `lunarApi.ts` convierte así:

| Backend | Frontend (`EphemerisResponse`) |
|---|---|
| `horizon.profile_deg`, `az_step_deg`, `terrain` | `horizon.elevations`, `horizon.stepDeg`, `terrain` |
| `series.t_utc[i]`, `sun_az/el/frac/clearance[i]`, `earth_*[i]` | `samples[i].time`, `.sun`, `.earth` (`BodyPosition`) |
| `metrics` | `metrics` (`ScenarioMetrics`) |
| `events` | `events` (`SkyEvent[]`) |
| `at_start.next` | `next` (`NextEvents`) |
| `result` | `verdict` (`Verdict`) |
| `meta.kernels` | `source: 'spice'` |

El mock del front (`VITE_USE_MOCK=true`) devuelve exactamente el mismo modelo, con `source: 'mock'`.
