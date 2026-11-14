# Matriz de Trazabilidad (TRAZABILIDAD.md)

Referencias:
- Requisitos: `Backend_docs/03_REQUERIMIENTOS.md`
- Pruebas: `Backend_docs/04_PRUEBAS_UNITARIAS.md`

Estados: `☐` Pendiente · `☑` Cubierto y verificado en verde

| Requisito | Prioridad | Prueba(s) | Estado |
|-----------|-----------|-----------|--------|
| RF-DATA-01 | M | UT-DATA-01, UT-DATA-02 | ☑ |
| RF-DATA-02 | M | UT-DATA-03, UT-DATA-04 | ☑ |
| RF-DATA-03 | M | UT-DATA-10 | ☑ |
| RF-DATA-04 | M | UT-DATA-08 | ☑ |
| RF-DATA-05 | M | UT-DATA-05, UT-DATA-06 | ☑ |
| RF-DATA-06 | M | UT-DATA-07 | ☑ |
| RF-DATA-07 | M | UT-DATA-09 | ☑ |
| RF-DATA-08 | M | UT-SITE-01..04 | ☑ |
| RF-DATA-09 | S | precompute_horizons (pipeline listo; cálculo en Fase 3) | ☐ |
| RF-DATA-10 | C | Configuración `DEM_HIRES_PATH` (`test_core.py`) | ☐ |
| RF-COORD-01..06 | M | UT-COORD-01..10 | ☐ |
| RF-EPH-01..07 | M/S | UT-EPH-01..14, VAL-HZ-01 | ☐ |
| RF-HOR-01..06 | M/S | UT-HOR-01..15 | ☐ |
| RF-TER-01..02 | M/S | UT-TER-01..07 | ☐ |
| RF-VIS-01..04 | M | UT-VIS-01..08 | ☐ |
| RF-EV-01..05 | M/S | UT-EV-01..11 | ☐ |
| RF-PWR-01..02, RF-VIA-01 | S | UT-PWR-01..07 | ☐ |
| RF-API-01..13 | M/S | UT-API-01..30 (Fase 0: `/health`, RFC 7807, CORS, `X-Request-ID`, `Server-Timing`, fechas UTC) | ☐ |
| RNF-PERF-* | — | BM-01..06 | ☐ |
| RNF-REL-01 | M | `test_health_503_data_not_ready`, UT-API-02 | ☑ |
| RNF-REL-02 | M | UT-API-20 | ☐ |
| RNF-MAN-01 | M | Cobertura `pytest --cov-fail-under=85` | ☑ |
| RNF-MAN-02 | M | `make lint` (`ruff`) y `make typecheck` (`mypy --strict`) | ☑ |
| RNF-MAN-03 | M | UT-ARCH-01 (`test_UT_ARCH_01_no_forbidden_imports_in_api`) | ☑ |
| RNF-MAN-04 | M | UT-ARCH-02 (`test_UT_ARCH_02_no_hardcoded_absolute_paths`) | ☑ |
| RNF-SEC-01..03 | M | `StrictModel` (`extra="forbid"`), límite de cuerpo 64 KB (`test_headers_cors_and_rfc7807_error_handlers`), UT-API-10, UT-API-30 | ☑ |
| RNF-UX-01 | M | UT-ARCH-03 (`test_UT_ARCH_03_response_float_field_units`) | ☑ |
