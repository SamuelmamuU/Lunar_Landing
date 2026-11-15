# Lunar Landing Site Navigator - Contexto del backend

NASA Space Apps 2026 (14-15 nov). Stack: Python 3.10+, SPICE (`spiceypy`), FastAPI.
Guía de uso completa (CLI, endpoints, reglas de CANDIDATO): `backend/README.md`.

## Fuente de verdad compartida con el frontend

- **Contrato:** `docs/contrato-api.md`. Si hay que cambiar un nombre de campo, un endpoint o una convención,
  **primero se cambia ahí y se avisa al equipo de frontend**. El front traduce la respuesta en un solo archivo
  (`frontend/src/services/lunarApi.ts`): un campo renombrado sin avisar rompe la app.
- **Plan y slices:** `docs/plan-equipos.md` (slices B1–B7 son de este equipo).
- **Ejemplos reales:** `docs/ejemplos/*.json`. Si cambia la forma de una respuesta, regenerarlos.

## Convenciones (las mismas que el frontend)

- Ángulos en grados. Latitud −90..90 (sur negativo). Longitud −180..180 (este positivo).
- Azimut 0..360 desde el norte local en sentido horario (0 = N, 90 = E).
- Elevación sobre el plano horizontal local del observador; puede ser negativa.
- Horizonte: `profile_deg[i]` = terreno en el azimut `i * az_step_deg`; índice 0 = norte.
- Tiempos ISO 8601 UTC con `Z`.
- JSON en `snake_case`, unidades en el nombre del campo (`_deg`, `_h`, `_km`, `_utc`, `pct_`).
- Mensajes de error en español, en `detail`, con 404 (sitio inexistente) o 422 (entrada inválida).

## Qué consume el frontend

| Endpoint | Para qué | Campos que usa |
|---|---|---|
| `GET /api/sites` | Catálogo (este es el único catálogo real) | `id`, `name`, `lat`, `lon`, `category`, `note` y, cuando existan, `category_id`, `agency`, `mission`, `landed_utc` |
| `POST /api/evaluate` con `include_series: true`, `step_min: 60` | Todo lo que se dibuja: panorama, métricas, línea de tiempo, comparador | `input`, `horizon.{terrain, az_step_deg, profile_deg}`, `series.{t_utc, sun_az, sun_el, sun_frac, sun_clearance, earth_az, earth_el, earth_clearance, earth_visible}`, `metrics`, `events`, `at_start.next`, `result` |
| `POST /api/mission` | Extra: fechas alternativas | `result.alternatives`, `result.checks` |

No renombrar ni quitar esos campos. Agregar campos nuevos no rompe nada.

## Estructura

```
backend/
  api.py            FastAPI: solo validación de entrada y traducción a HTTP. Sin cálculos.
  main.py           CLI: mismas funciones que la API.
  lunar/
    geometry.py     Posición de Sol y Tierra (SPICE azlcpo) y clasificación respecto al terreno
    horizon.py      Máscaras de horizonte (esfera lisa o DEM de LOLA) y su caché
    analysis.py     Serie de tiempo, eventos, métricas, reglas de candidato
    evaluate.py     Rango de fechas  -> /api/evaluate
    mission.py      Fecha fija + duración -> /api/mission
    report.py       Armado de los JSON de salida
    sites.py        Catálogo
    kernels.py      Carga de kernels SPICE
  data/sites.json       Catálogo (se versiona)
  data/horizons.json    Horizontes precalculados (se versiona)
  data/dem/             DEMs de LOLA (NO se versiona)
  kernels/              Kernels SPICE (se versionan)
  tests/
```

Los cálculos van en `lunar/`; `api.py` y `main.py` solo llaman a `lunar/`. Así la API y el CLI nunca dan
resultados distintos.

## Terreno (LOLA)

- DEM: `LDEM_80S_80MPP_ADJ.TIF` (polo sur, 80°S–90°S, 80 m/px, 189 MB). Va en `backend/data/dem/` y **nunca a git**.
- `python main.py horizon --all --dem data/dem/LDEM_80S_80MPP_ADJ.TIF` precalcula los horizontes del catálogo en
  `data/horizons.json`. **Ese archivo sí se commitea**: da relieve real a todo el equipo sin el `.TIF`.
- El horizonte precalculado se busca por `site.id`. Si la petición trae `x`/`y`, el sitio pasa a ser
  `custom_...` y no lo encuentra: se calcula al vuelo (si está el `.TIF`) o queda esfera lisa.
- Fuera de la cobertura del DEM (norte de 80°S) el horizonte es esfera lisa y `horizon.terrain` es `false`.

## Comandos

```
uvicorn api:app --reload --port 8000     # API, documentación interactiva en /docs
python -m pytest tests -q                # 82 pruebas, ~90 s
python main.py validate                  # modelo vs 7 misiones reales
```

## Git

- Una rama por slice: `API/slice-N`. PR hacia `develop`, nunca directo a `main`.
- Conventional Commits en español: `feat(api): ...`, `fix(horizon): ...`, `test: ...`, `docs: ...`.
- Cada commit debe pasar `python -m pytest tests -q`.
- No subir `.venv/`, `output/`, `data/dem/` ni carpetas del IDE.
