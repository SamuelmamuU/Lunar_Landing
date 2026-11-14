# Bitácora del Proyecto (BITACORA.md)

## Fase 0 — Andamiaje del proyecto (2026-11-14)
- **Qué se hizo:** Se creó la estructura de `lunar-backend/` conforme a `01_PLANEACION_BACKEND.md` §2, la documentación inicial (`HERRAMIENTAS.md`, `DECISIONES.md`, `PROPUESTAS_DOCS.md`, `TRAZABILIDAD.md`), el entorno `uv` + Python 3.12 (`uv.lock`), `Makefile`/`make.bat`, `ruff`, `mypy --strict`, `pytest`, `.pre-commit-config.yaml`, CI (`.github/workflows/ci.yml`), `app/core/*`, `app/schemas/common.py`, `app/api/deps.py`, `app/api/v1/health.py` y `app/main.py`.
- **Qué pruebas pasan:** `make lint` (0 errores en 62 archivos), `make typecheck` (0 errores en 46 archivos), `make test` (13/13 pruebas en verde con 96.16 % de cobertura, incluyendo `UT-ARCH-01..03`, `test_core.py` y `test_health_phase0.py`) y verificación en vivo con `uvicorn` (`GET /api/v1/health` → 200, `GET /docs` → 200).
- **Pendiente:** Aprobación del usuario para iniciar la **Fase 1 — Pipeline de extracción y descarga de datos**.
