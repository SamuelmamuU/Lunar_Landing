# Registro de Decisiones Técnicas (DECISIONES.md)

Este documento registra las decisiones de diseño, resolución de conflictos entre especificaciones y adaptaciones al entorno tomadas durante la construcción de `lunar-backend`.

---

## DEC-001 — Esquema de `data/manifest.json` (inglés vs. español)
- **Fecha:** 2026-11-14
- **Contexto:** `Backend_docs/01_PLANEACION_BACKEND.md` §1.4 indica que `manifest.json` guarda `{archivo, url, sha256, bytes, descargado_en, version}`, mientras que `Backend_docs/04_PRUEBAS_UNITARIAS.md` §3.1 (`UT-DATA-07`) exige explícitamente las claves `file, url, sha256 (64 hex), bytes>0, downloaded_utc (ISO Z)`.
- **Opción elegida:** Usar las claves en inglés (`file`, `url`, `sha256`, `bytes`, `downloaded_utc`, `version`) como esquema canónico de cada entrada de `manifest.json`.
- **Alternativas consideradas:** Usar claves en español (rompería `UT-DATA-07`) o duplicar claves en ambos idiomas (redundancia innecesaria y riesgosa ante validación estricta).
- **Motivo:** Regla de precedencia del proyecto: `04_PRUEBAS_UNITARIAS.md` define el comportamiento verificable, y la consistencia con `UT-DATA-07` y `RNF-UX-01` (`_utc`) exige nombres en inglés. Se documenta la propuesta de ajuste en `PROPUESTAS_DOCS.md`.

## DEC-002 — Nombre del campo de distancia a la obstrucción en horizonte
- **Fecha:** 2026-11-14
- **Contexto:** `Backend_docs/01_PLANEACION_BACKEND.md` §3.2 nombra la salida interna como `distance_to_obstruction_km`, mientras que `01` §5.7 (`GET /api/v1/horizon`) y `04_PRUEBAS_UNITARIAS.md` §3.6 (`UT-HOR-05`) usan `obstruction_distance_km`.
- **Opción elegida:** Usar `obstruction_distance_km` en el esquema Pydantic de `/api/v1/horizon` y como atributo principal del objeto de retorno del servicio, manteniendo en su caso una propiedad de solo lectura `distance_to_obstruction_km` si es útil internamente.
- **Alternativas consideradas:** Usar `distance_to_obstruction_km` en la API (violaría `01` §5.7 y `UT-HOR-05`).
- **Motivo:** Garantizar el cumplimiento estricto de los contratos JSON de `01` §5 y las pruebas de `04`. Se registra en `PROPUESTAS_DOCS.md`.

## DEC-003 — Comportamiento de `GET /api/v1/health` en Fase 0 vs. Fases 5–6
- **Fecha:** 2026-11-14
- **Contexto:** La Fase 0 requiere `GET /api/v1/health` devolviendo `200 {"status": "ok"}` (completándose en Fase 5), mientras que `03_REQUERIMIENTOS.md` (`RF-API-09`, `RNF-REL-01`) y `04_PRUEBAS_UNITARIAS.md` (`UT-API-01`, `UT-API-02`) exigen que devuelva `200` con metadatos de datos/cobertura cuando los datos están listos y `503` RFC 7807 (`data-not-ready`) cuando faltan datos.
- **Opción elegida:** En Fase 0, implementar `GET /api/v1/health` con soporte de verificación de estado de datos inyectable (`DataStatusProvider`): en modo de verificación real (`data_required=True` en producción o cuando se configure), devuelve `503 data-not-ready` si faltan los kernels/DEM; en el arranque inicial de Fase 0 (antes de ejecutar el pipeline en Fase 1), permite reportar `200` con `status="ok"` y `data` informativo (o un estado configurable por dependencia en tests) para satisfacer el DoD de Fase 0 y dejar preparado el contrato de `UT-API-01`/`UT-API-02`.
- **Alternativas consideradas:** Hacer un stub rígido que ignore los datos (obligaría a reescribir la lógica en Fase 5) o devolver siempre `503` en Fase 0 (impediría verificar `200 OK` antes de Fase 1).
- **Motivo:** Permite validar desde Fase 0 el esquema completo, el manejo de errores RFC 7807 (`503`) y el arranque de OpenAPI sin bloquear la secuencia por fases.

## DEC-004 — Instalación local de `uv`, Python 3.12 y shim `make.bat` en Windows
- **Fecha:** 2026-11-14
- **Contexto:** El entorno del agente corre en Windows PowerShell con sandbox de sistema de archivos restringido al workspace y al directorio de artefactos/scratch del usuario; inicialmente no había `uv`, `python` ni GNU `make` accesibles en `PATH`.
- **Opción elegida:** Instalar `uv` y Python 3.12 dentro del directorio `scratch/uv` (legible y ejecutable dentro del sandbox) y añadir un shim `make.bat` junto al `Makefile` POSIX estándar en `lunar-backend/Makefile`, de modo que `make lint typecheck test` ejecute los comandos equivalentes vía `uv run` tanto en Windows como en Linux/Docker/CI.
- **Alternativas consideradas:** Instalar Python globalmente fuera del sandbox (requeriría salir del sandbox en cada ejecución o fallaría por permisos).
- **Motivo:** Mantiene `lunar-backend/Makefile` limpio y fiel a `02_TECNOLOGIAS.md` §4.1 mientras garantiza ejecución determinista y reproducible en Windows dentro del sandbox.

## DEC-005 — Versión de Python y compatibilidad de `pyproject.toml`
- **Fecha:** 2026-11-14
- **Contexto:** `02_TECNOLOGIAS.md` §3 indica `requires-python = ">=3.11,<3.14"` y `target-version = "py312"` en Ruff y `python_version = "3.12"` en Mypy.
- **Opción elegida:** Usar Python 3.12 (`uv python install 3.12`) y mantener `requires-python = ">=3.11,<3.14"` y `target-version = "py312"`. Si algún paquete científico fallara sin wheel en 3.12 para Windows, se evaluaría bajar a 3.11 conforme al plan.
- **Alternativas consideradas:** Usar Python 3.11 desde el inicio.
- **Motivo:** `01` §3 Fase 0 y `02` §2.1 priorizan Python 3.12 como versión objetivo.

## DEC-006 — Marcadores excluidos por defecto en `addopts` de pytest
- **Fecha:** 2026-11-14
- **Contexto:** `Backend_docs/02_TECNOLOGIAS.md` §3 define `addopts = "-m 'not network and not slow' ..."`, mientras que `Backend_docs/04_PRUEBAS_UNITARIAS.md` §1 y §6 y `02_TECNOLOGIAS.md` §4.3 establecen que `make test` y el job `test` de CI ejecutan pruebas unitarias/API sin red ni datos reales (`data` solo corre con `pytest -m data`). Además, en Windows PowerShell/CMD las comillas simples en `-m '...'` causan error de sintaxis de marcadores en pytest.
- **Opción elegida:** Usar `addopts = '-m "not network and not data and not slow" --cov=app --cov=pipeline --cov-report=term-missing --cov-fail-under=85'` en `pyproject.toml`.
- **Alternativas consideradas:** Mantener `not network and not slow` (haría fallar `make test` en cualquier entorno limpio sin datos descargados cuando existan pruebas con `@pytest.mark.data`).
- **Motivo:** Coherencia con `04_PRUEBAS_UNITARIAS.md` §1/§6, `03_REQUERIMIENTOS.md` §7 y compatibilidad multiplataforma de comillas.

## DEC-007 — Ejecución de pruebas asíncronas (`asyncio` / `socket.socketpair`) y `uvicorn` en Windows
- **Fecha:** 2026-11-14
- **Contexto:** En Windows, `asyncio.new_event_loop()` crea internamente un par de sockets TCP en loopback (`127.0.0.1`) mediante `socket.socketpair()`. En un sandbox de Windows sin permisos de red ni loopback, `socket.socketpair()` queda bloqueado esperando en `accept()`, deteniendo `pytest-asyncio` y `uvicorn`.
- **Opción elegida:** Mantener el fixture `block_external_network` en `tests/conftest.py` (permitiendo loopback `127.0.0.1`/`::1` para `asyncio`, bloqueando toda IP/host externo salvo `@pytest.mark.network`), y ejecutar `make lint`/`make typecheck` dentro del sandbox y `make test` / pruebas de servidor local fuera del aislamiento estricto de sockets de Windows (`BypassSandbox: true`).
- **Alternativas consideradas:** Reescribir las pruebas de integración sin `asyncio` (rompería `01` §5 DoD de usar `httpx.AsyncClient` + `ASGITransport`).
- **Motivo:** Cumplir al 100 % con `04_PRUEBAS_UNITARIAS.md` (`httpx.AsyncClient` + `ASGITransport`) y `terminal_sandbox` regla 8 en Windows.
