# Propuestas de Mejora para `Backend_docs/`

> Conforme a las instrucciones del proyecto, los archivos dentro de `Backend_docs/` no han sido modificados. Este documento registra las discrepancias detectadas para su eventual alineación documental.

## PROP-001 — Unificar nombres de campos de `manifest.json` en `01_PLANEACION_BACKEND.md` §1.4
- **Ubicación:** `Backend_docs/01_PLANEACION_BACKEND.md`, línea 284 (§1.4 `verify_data.py`).
- **Texto actual:** `Escribe manifest.json con {archivo, url, sha256, bytes, descargado_en, version}.`
- **Propuesta:** Cambiar a `{file, url, sha256, bytes, downloaded_utc, version}` para coincidir exactamente con `Backend_docs/04_PRUEBAS_UNITARIAS.md` §3.1 (`UT-DATA-07`).

## PROP-002 — Unificar nombre de arreglo de distancias en `01_PLANEACION_BACKEND.md` §3.2
- **Ubicación:** `Backend_docs/01_PLANEACION_BACKEND.md`, línea 371 (§3.2 `services/horizon.py`).
- **Texto actual:** `Salida: arreglos azimuth_deg[N] y horizon_elev_deg[N], más distance_to_obstruction_km[N].`
- **Propuesta:** Alinear el nombre con §5.7 (`GET /api/v1/horizon`) y `04_PRUEBAS_UNITARIAS.md` (`UT-HOR-05`), usando `obstruction_distance_km[N]` y `elevation_deg[N]`.

## PROP-003 — Nota sobre `addopts` en `02_TECNOLOGIAS.md` para compatibilidad Windows y exclusión de `data`
- **Ubicación:** `Backend_docs/02_TECNOLOGIAS.md`, línea 167 (§3 `[tool.pytest.ini_options]`).
- **Texto actual:** `addopts = "-m 'not network and not slow' --cov=app --cov=pipeline --cov-report=term-missing --cov-fail-under=85"`
- **Propuesta:** Usar `addopts = '-m "not network and not data and not slow" --cov=app --cov=pipeline --cov-report=term-missing --cov-fail-under=85'` para que coincida con la tabla de marcas de `04_PRUEBAS_UNITARIAS.md` §1 (`data` no corre por defecto) y evite fallos de comillas simples en Windows.
