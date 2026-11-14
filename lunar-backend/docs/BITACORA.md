# Bitácora del Proyecto (BITACORA.md)

## Fase 0 — Andamiaje del proyecto (2026-11-14)
- **Qué se hizo:** Se creó la estructura de `lunar-backend/` conforme a `01_PLANEACION_BACKEND.md` §2, la documentación inicial (`HERRAMIENTAS.md`, `DECISIONES.md`, `PROPUESTAS_DOCS.md`, `TRAZABILIDAD.md`), el entorno `uv` + Python 3.12 (`uv.lock`), `Makefile`/`make.bat`, `ruff`, `mypy --strict`, `pytest`, `.pre-commit-config.yaml`, CI (`.github/workflows/ci.yml`), `app/core/*`, `app/schemas/common.py`, `app/api/deps.py`, `app/api/v1/health.py` y `app/main.py`.
- **Actualización sin Docker (`DEC-008`):** Por solicitud del usuario se eliminaron `Dockerfile` y `docker-compose.yml`, adoptando la Opción A (despliegue nativo con `uv` + `scripts/start_prod.ps1`, `scripts/start_prod.sh`, `scripts/healthcheck.py` y `make prod` / `make healthcheck`) y actualizando `Backend_docs/01`, `02` y `03`.
- **Qué pruebas pasan:** `make lint`, `make typecheck` y `make test` (unitarias, arquitectura, API Fase 0 y scripts) en verde con cobertura ≥ 85 %, además de verificación en vivo de `uvicorn` (`/api/v1/health` y `/docs`).
- **Pendiente:** Aprobación del usuario para iniciar la **Fase 1 — Pipeline de extracción y descarga de datos**.

## Fase 1 — Pipeline de extracción y descarga de datos (2026-11-14)
- **Qué se hizo:** Se implementaron `app/schemas/sites.py` (`SiteItem`, `SitesCatalog`) y el paquete completo `pipeline/` (`download_kernels.py`, `download_dem.py`, `build_sites.py`, `verify_data.py`, `precompute_horizons.py`, `cli.py`, `__main__.py`), junto con el catálogo verificado `data/sites/sites.json` (23 sitios oficiales, incluidas las 9 regiones Artemis III). Se descargaron los 6 kernels reales de NAIF (`moon_de440_250416.tf` elegido dinámicamente) y una ventana real de `±20 km` (`2000×2000 px`) de `LDEM_80S_20MPP_ADJ.TIF` vía `/vsicurl/` (`DEC-009`), generando `meta.tm` y `data/manifest.json`.
- **Qué pruebas pasan:** `make lint`, `make typecheck` y `make test` (33/33 pruebas en verde incluyendo `UT-DATA-01..10` y `UT-SITE-01..04`, **89.35 %** de cobertura), además de `python -m pipeline verify` con datos reales (distancia Tierra–Luna = `361 024.835 km`).
- **Pendiente:** Aprobación del usuario para iniciar la **Fase 2 — Núcleo de coordenadas y efemérides** (`precompute_horizons` se activará tras completar la Fase 3).
