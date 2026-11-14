# Inventario de Herramientas y Skills

Fecha de registro: 2026-11-14

Este documento inventaria las herramientas y skills disponibles en el entorno del agente constructor, especificando cómo se emplean en el proyecto `lunar-backend` o por qué no aplican.

## 1. Herramientas nativas del agente

- `read_file`: Lectura de los documentos normativos de `Backend_docs/`, código existente, logs y archivos PDF/imágenes si se requiere documentación de referencia.
- `write_file`: Creación de archivos de código, tests, configuraciones, esquemas y documentación en `lunar-backend/` y artefactos de tareas.
- `edit_file`: Edición quirúrgica de archivos existentes sin reescribir bloques completos.
- `run_command`: Ejecución de comandos en PowerShell (`uv`, `python`, `pytest`, `ruff`, `mypy`, `git`, `docker`, pipeline de datos).
- `search_web`: Verificación de versiones vigentes de kernels NAIF, URLs de NASA PGDA/Horizons, coordenadas oficiales de sitios lunares y documentación de librerías científicas (`spiceypy`, `rasterio`, `pyproj`, `numba`).
- `invoke_subagent` (`self`): Delegación de tareas independientes en contexto separado con las mismas herramientas (por ejemplo, escritura de pruebas en paralelo o revisión independiente).
- `invoke_subagent` (`research`): Exploración o síntesis de lectura de archivos o documentación en modo de solo lectura cuando sea extensa.
- `invoke_subagent` (`browser`): No aplica en desarrollo de backend salvo que se requiera inspeccionar una página JS-renderizada oficial (ej. LROC/QuickMap) para verificar coordenadas.
- `invoke_subagent` (`image-generator`): No aplica (las imágenes del proyecto son hillshades científicos generados determinísticamente por `Pillow` desde el DEM).
- `invoke_subagent` (`ai-architect`, `deployment-expert`, `performance-optimizer`): Especializados en la plataforma Vercel; no aplican a un backend FastAPI/Python en Docker.
- `define_subagent` / `manage_subagents` / `send_message`: Definición y coordinación de subagentes revisores independientes para las Fases 3 (horizonte) y 5 (API).
- `run_workflow` / `swarm`: No requeridos salvo que se decida paralelizar un lote grande de módulos independientes; `invoke_subagent` cubre las revisiones y tareas paralelas.
- `schedule` / `manage_task`: Seguimiento de comandos en segundo plano largos (descarga de DEM/kernels o instalación).
- `ask_question`: Consultas estructuradas al usuario solo si surgiera ambigüedad crítica de requisitos bloqueantes.
- `search_marketplace` / `list_plugin_accounts`: Verificación de plugins/cuentas disponibles; no se requieren plugins externos adicionales.
- `enter_plan_mode`: Retorno al modelo planificador ante bloqueos o cambios de enfoque arquitectónico.

## 2. Herramientas CLI y entorno local

- `uv` (instalado localmente para el sandbox en scratch): Gestión de entornos virtuales, resolución determinista en `uv.lock` y ejecución (`uv sync`, `uv run`).
- `Python 3.12` (gestionado por `uv`): Lenguaje del backend y pipeline (`requires-python = ">=3.11,<3.14"`).
- `make` (`Makefile` estándar + shim `make.bat` en Windows): Atajos uniformes `setup`, `data`, `data-dev`, `precompute`, `run`, `test`, `test-all`, `lint`, `typecheck`.
- `pytest` + `pytest-cov` + `pytest-asyncio` + `pytest-benchmark` + `hypothesis` + `respx`: Ejecución TDD, cobertura ≥ 85 %, pruebas de propiedades, mocks HTTP estrictos y benchmarks `BM-*`.
- `ruff`: Linter y formateador estático (`ruff check`, `ruff format`).
- `mypy`: Verificación estricta de tipos en `app/` y `pipeline/` (`pydantic.mypy`).
- `pre-commit`: Hooks locales de calidad (`ruff`, `mypy`, validación YAML, tamaño máximo de archivos).
- `git`: Control de versiones y commits atómicos por fase (`fase N: ...`).
- `docker` / `docker compose`: No aplica por decisión explícita del usuario (reemplazado en Fase 6 por despliegue nativo con `uv` y scripts `scripts/start_prod.*` + `scripts/healthcheck.py`).

## 3. Skills disponibles en el entorno

### 3.1 Skills de API e ingeniería Postman (`.gemini/config/plugins/postman/skills/`)
- `api-engineer`: Guía general de ingeniería de APIs; orienta el diseño de contratos claros y verificables antes de implementar endpoints en FastAPI.
- `api-documentation`: Principios de documentación de contratos OpenAPI (inputs requeridos, errores, ejemplos); se aplica al OpenAPI de FastAPI (`/openapi.json`) y `README.md`.
- `api-testing`: Principios de verificación de endpoints y aserciones contra el contrato; la ejecución automatizada local usa `pytest` + `httpx.AsyncClient` + `ASGITransport` + `respx` según `04_PRUEBAS_UNITARIAS.md` (sin requerir cuenta/cloud de Postman).
- `api-mocking` / `api-simulation` / `api-discovery` / `api-monitoring` / `ai-readiness` / `application-testing` / `ci-integration` / `cli-install` / `collection-schema-v3` / `datasets` / `flows` / `performance-testing` / `postman-mcp-server` / `variables` / `webhook-testing` / `workspaces`: No aplican directamente porque no se usa Postman CLI/Cloud ni Flows ni Playwright en este proyecto Python autocontenido, y la cuenta de Postman MCP no está autenticada.

### 3.2 Skills integradas de Antigravity (`.gemini/antigravity/builtin/skills/`)
- `verification`: Enfoque de verificación integral de flujos; útil en Fase 5/6 para validar extremo a extremo `/api/v1/*` contra los contratos.
- `run-workflow` / `swarm` / `swarm_monitor`: Orquestación de múltiples agentes; no es indispensable dado el flujo secuencial por fases con subagentes revisores puntuales.
- `generative_ui`: Renderizado interactivo HTML; opcional para visualizar diagnósticos o máscaras de horizonte sintéticas en Fase 3 si ayuda a validar resultados.
- `automation` / `agy-customizations` / `antigravity-guide` / `migrate-agent-settings` / `migrate-workflows` / `plugin` / `ui-plugin-navigation`: Herramientas de configuración y automatización del IDE Antigravity; no aplican al código del proyecto.

### 3.3 Skills de otros dominios (no aplican)
- **Vercel (`vercel-plugin/skills/*`):** 35 skills (`ai-gateway`, `ai-sdk`, `auth`, `bootstrap`, `build-agents`, `cdn-caching`, `chat-sdk`, `create-a-backend`, `custom-metrics`, `daemons`, `deployments-cicd`, `domains`, `env-vars`, `eve`, `flags-sdk`, `is-agentic`, `knowledge-update`, `marketplace`, `microfrontends`, `offload-to-sandbox`, `queues`, `react-best-practices`, `routing-middleware`, `runtime-cache`, `vercel-agent`, `vercel-cli`, `vercel-connect`, `vercel-firewall`, `vercel-flags`, `vercel-functions`, `vercel-sandbox`, `vercel-services`, `vercel-storage`, `vercel-tracing`, `workflow`) — No aplican (el backend es FastAPI/Python nativo gestionado con `uv`, no Next.js/Vercel).
- **Unity (`unity/skills/*`):** 31 skills (`2d-pixel-perfect`, `asset-transformer-toolkit`, `audio-setup-mixers`, `build-gtk`, `build-live-game`, `craft-game-floors`, `create-2d-physics`, `create-tile-palette-or-rule-tiles`, `generate-editor-search-query`, `implement-in-app-purchases`, `initialize-ai-navigation`, `levelplay-unity-integration`, `localization`, `manage-sprite-atlas`, `migrate-birp-to-urp`, `new-unity-project`, `optimize-audio`, `optimize-text-mesh-pro`, `optimize-web`, `physics-3d-collision`, `setup-multiplayer-services`, `setup-vivox-voice-chat`, `shader-graph-create-custom-node`, `sprite-editor`, `sprite-segment-3x3grid`, `ui`, `ui-imgui`, `ui-ugui`, `ui-uitk`, `unity-cli`, `unity-package-management`, `urp-postprocessing`, `validate-urp-render-graph-renderer-feature`) — No aplican (motor de videojuegos Unity).
- **Android (`android-cli-plugin/skills/*`):** 3 skills (`android-cli`, `android-device-hub`, `compose-preview`) — No aplican.
- **Three.js (`threejs-animations`):** No aplica al backend (pertenece al frontend 3D).

## 4. Skills no instaladas mencionadas en las instrucciones

- No hay skills dedicadas instaladas para TDD, revisión de código, auditoría de dependencias, lectura de XLSX ni redacción de README.
  - Se suplen mediante: disciplina estricta TDD guiada por `04_PRUEBAS_UNITARIAS.md`, subagentes revisores independientes (`invoke_subagent`) para Fases 3 y 5, `uv pip`/`pip-audit` (en Fase 6/CI), `read_file` nativo (para PDFs/imágenes) o Python (`csv`/`json`/`yaml`) para datos tabulares, y redacción directa de `README.md` según `01_PLANEACION_BACKEND.md`.
