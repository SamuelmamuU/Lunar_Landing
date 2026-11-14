# lunar-backend

Backend científico en Python/FastAPI para el **Simulador de iluminación solar y visibilidad de la Tierra en sitios de aterrizaje lunar**.

> Estado actual: **Fase 0 — Andamiaje del proyecto**. Las fases 1–7 completarán el pipeline de datos, efemérides SPICE, máscara de horizonte con Numba, visibilidad/eventos/energía, API REST completa, Docker y validación científica.

## Comandos rápidos

```bash
make setup       # Instala dependencias con uv y configura pre-commit
make lint        # Ejecuta ruff check y ruff format --check
make typecheck   # Ejecuta mypy en app/ y pipeline/
make test        # Ejecuta pruebas unitarias e integración (sin red ni datos)
make run         # Inicia uvicorn en http://127.0.0.1:8000 (OpenAPI en /docs)
```
