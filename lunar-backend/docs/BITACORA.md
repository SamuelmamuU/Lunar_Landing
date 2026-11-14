# Bitácora del Proyecto (BITACORA.md)

## Fase 0 — Andamiaje del proyecto (2026-11-14)
- **Qué se hizo:** Se creó la estructura de `lunar-backend/` conforme a `01_PLANEACION_BACKEND.md` §2, la documentación inicial (`HERRAMIENTAS.md`, `DECISIONES.md`, `PROPUESTAS_DOCS.md`, `TRAZABILIDAD.md`), el entorno `uv` + Python 3.12 (`uv.lock`), `Makefile`/`make.bat`, `ruff`, `mypy --strict`, `pytest`, `.pre-commit-config.yaml`, CI (`.github/workflows/ci.yml`), `app/core/*`, `app/schemas/common.py`, `app/api/deps.py`, `app/api/v1/health.py` y `app/main.py`.
- **Actualización sin Docker (`DEC-008`):** Por solicitud del usuario se eliminaron `Dockerfile` y `docker-compose.yml`, adoptando la Opción A (despliegue nativo con `uv` + `scripts/start_prod.ps1`, `scripts/start_prod.sh`, `scripts/healthcheck.py` y `make prod` / `make healthcheck`) y actualizando `Backend_docs/01`, `02` y `03`.
- **Qué pruebas pasan:** `make lint`, `make typecheck` y `make test` (unitarias, arquitectura, API Fase 0 y scripts) en verde con cobertura ≥ 85 %, además de verificación en vivo de `uvicorn` (`/api/v1/health` y `/docs`).
- **Pendiente:** Aprobación del usuario para iniciar la **Fase 1 — Pipeline de extracción y descarga de datos**.
