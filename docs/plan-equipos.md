# Plan por equipos (entrega: 15 nov)

Contrato: `docs/contrato-api.md`. Este plan se arma hacia atrás desde la demo: todo slice sirve al guion o es extra.

## 1. Dónde estamos (14 nov, noche)

| | Estado real |
|---|---|
| **Backend** | Casi completo: posiciones con SPICE, horizonte con LOLA, **serie de tiempo**, métricas, eventos con precisión de 1 s, "tiempo hasta puesta", veredicto CANDIDATO / NO CANDIDATO, fechas alternativas. 82 pruebas pasan. 30 días se calculan en ~0.3 s |
| **Frontend** | Slices 0–2 listos (catálogo, coordenadas propias, fecha y duración, carga de datos). **Ya conectado al backend real** (`VITE_USE_MOCK=false`): catálogo y efemérides llegan de la API |
| **Lo que falta** | Casi todo lo que falta es **visual**: panorama, veredicto y métricas, comparador, línea de tiempo |

Dudas del briefing que quedaron resueltas leyendo y ejecutando el código:

- **El azimut del backend está bien.** Se comprobó contra un cálculo independiente con `unit_directions` en 3 sitios
  (IM-2: Sol 65.68°, Tierra 335.85°). Los valores 71.45 / 15.32 de `apiOutput.md` eran un ejemplo mal escrito.
- **La serie de tiempo ya existe** (`include_series: true`). No hay que construir un endpoint nuevo.
- El horizonte empieza en el norte, crece hacia el este e incluye la curvatura de la Luna.

## 2. Decisiones cerradas

| # | Decisión | Resultado |
|---|---|---|
| D1 | Azimut | Correcto como está. Se agrega una prueba que lo proteja (B1) |
| D2 | Instante vs serie | Serie: `POST /api/evaluate` con `include_series: true`, paso 60 min |
| D3 | Dónde se calculan las métricas | **Backend** (ya las calcula y están probadas). El front no las recalcula: las muestra |
| D4 | 2D vs 3D | **2D primero** (panorama). 3D es extra: los vectores ya vienen en la respuesta |
| D5 | Fuente del contrato | `docs/contrato-api.md` + JSON reales en `docs/ejemplos/`. Nombres del backend (snake_case); el front traduce en `lunarApi.ts` |
| D6 | "Visible" | Sol: asoma el disco. Tierra: centro sobre el terreno. "Despejado": margen ≥ 0.5° (contrato, sección 2) |
| D7 | Catálogo | **Backend** (`backend/data/sites.json`). El catálogo del front queda solo para el modo mock |
| D8 | Rendimiento | Máx. 366 días; el front pide 1–30 días a 60 min (≤ 721 muestras, ~0.3 s) |
| D9 | Integración | Proxy de Vite (`/api` → `localhost:8000`): sin CORS ni puertos fijos. Errores en `detail` |

## 3. Guion de la demo (~3 min)

| # | Tiempo | Qué se muestra | Qué dice | Slices |
|---|---|---|---|---|
| 1 | 0:00–0:25 | La app abierta. Se elige **IM-2 Athena (Mons Mouton)** y "Usar alunizaje" (6 mar 2025) | "En el polo sur el Sol no sube: da vueltas rozando el horizonte. Un cerro decide si hay energía" | F1–F2 ✔ |
| 2 | 0:25–1:05 | **Panorama**: silueta real del terreno (LOLA), Sol a 2.5° y Tierra a 11°. Textos: "Sol visible, 1.6° sobre el terreno · se pone en 13 d 5 h", "Tierra visible · se oculta en 12 d 10 h". Veredicto **CANDIDATO** | "Esto es lo que vio Athena al aterrizar. Datos SPICE de NASA y relieve real" | F3, F4 |
| 3 | 1:05–1:40 | Se cambia la fecha dos semanas: el veredicto pasa a **NO CANDIDATO** con el motivo en texto | "Se retrasó el lanzamiento. La herramienta responde en un segundo qué cambia" | F4 (+F7a: fechas alternativas) |
| 4 | 1:40–2:20 | **Comparador**: IM-2 vs Connecting Ridge vs Chang'e 6 en la misma fecha. Chang'e 6: Tierra 0 % | "Misma fecha, tres sitios: se ve de un vistazo quién tiene luz y quién comunicación" | F5 |
| 5 | 2:20–2:50 | **Línea de tiempo**: se arrastra el slider y el Sol recorre el horizonte y se esconde tras el cerro | "Un día lunar dura 29.5 días terrestres" | F6 |
| 6 | 2:50–3:00 | Cierre | "Validado contra 7 misiones reales. Sirve a planificadores y a un salón de clases" | B5 |

**Demo mínima viable:** pasos 1 a 4 (F3, F4, F5). El paso 5 es lo primero que se recorta si falta tiempo.

## 4. Slices de backend

Rama por slice: `API/slice-N` → PR a `develop`.

| ID | Slice | Depende de | Entrega | Listo cuando | Tiempo |
|---|---|---|---|---|---|
| B1 | **Aceptar el contrato** y protegerlo | — | Revisión de `docs/contrato-api.md`; prueba que compara `azimuth_deg`/`elevation_deg` con el cálculo desde `vectors_3d.unit_directions`; prueba de la forma de `/api/evaluate` con `include_series` (que no se renombren campos) | Las pruebas pasan y el equipo dice "contrato aceptado" (o propone cambios en el mismo documento) | 30 min |
| B2 | **Catálogo unificado** | B1 | En `data/sites.json`: `category_id` (`artemis\|clps\|international\|apollo\|reference`), `agency`, `mission`, `landed_utc` (salen de `real_missions.json`). Agregar los sitios de contraste que usa la demo: interior de Shackleton (sombra permanente), macizo Malapert, Haworth, Nobile, Chang'e 4 | `GET /api/sites` trae los campos nuevos; el botón "Usar alunizaje" del front funciona con datos reales | 45 min |
| B3 | **Relieve real para todo el catálogo del polo** | B2 | Con el `.TIF` en `data/dem/`: `python main.py horizon --all --dem data/dem/LDEM_80S_80MPP_ADJ.TIF` y **commitear `data/horizons.json`** | Todos los sitios al sur de 80°S responden `horizon.terrain: true` en una máquina **sin** el `.TIF` | 30 min |
| B4 | **Serie completa y sitio sin ambigüedad** | B1 | `earth_frac` en la serie. Si llegan `site_id` y `x`/`y` juntos, gana `site_id` (hoy se pierde el relieve) | El ejemplo de `docs/ejemplos/` regenerado incluye `earth_frac` | 30 min |
| B5 | **Listo para la demo** | B3 | Máquina de la demo con el `.TIF` (coordenadas personalizadas con relieve; medir que la primera respuesta tarde < 5 s). `python main.py validate` y una lámina con las 7 misiones reales | Ensayo completo del guion con backend real, sin errores | 45 min |
| B6 | Extra: revisar sitios en el borde del DEM | B3 | En sitios cerca de 80°S (p. ej. IM-1, 80.13°S) los rayos hacia el norte se salen del DEM y ahí el horizonte queda liso, justo hacia donde está la Tierra. Añadir un DEM global grueso o documentar el límite | Decidido y anotado en el contrato | lo que sobre |
| B7 | Extra: apoyo al front | B5 | Con B1–B5 hechos (~3 h), el equipo de backend toma F7a (fechas alternativas con `/api/mission`) o prepara el pitch | — | lo que sobre |

## 5. Slices de frontend

Rama por slice: `UI/vertical-slice-N` → PR a `develop`.

| ID | Slice | Depende de | Entrega | Listo cuando | Tiempo |
|---|---|---|---|---|---|
| F-int | **Conexión al backend real** ✔ hecho | Contrato | Adaptador en `services/lunarApi.ts`, tipos nuevos en `shared/types/lunar.ts`, mock con el mismo modelo, proxy de Vite | Con `VITE_USE_MOCK=false` la app lista el catálogo real y carga efemérides | — |
| F3a | **Efemérides al store** | F-int | `ephemeris` + `loadEphemeris` en `app/store.ts`; panorama, métricas y timeline leen de ahí. Aviso visible si `source === 'mock'` y si `terrain === false` ("sin relieve: horizonte liso") | Cambiar sitio o fecha actualiza un único estado compartido | 45 min |
| F3 | **Panorama del horizonte** (paso 2 del guion) | F3a | `features/sky-panorama/`: SVG azimut vs elevación (eje Y exagerado), silueta del terreno, Sol y Tierra a su tamaño, recorrido tenue, texto "Sol: 1.6° sobre el terreno, visible". Colores fijos en `shared/lib/bodies.ts` | Cambiar sitio/fecha mueve todo; IM-2 el 6 mar 2025 muestra Sol ≈ 2.5° al este-noreste y Tierra ≈ 11° al norte-noroeste | 2–3 h |
| F4 | **Veredicto y métricas** (pasos 2 y 3) | F3a | `features/metrics/`: CANDIDATO / NO CANDIDATO con motivos (`verdict`), "se pone en…" (`next`), tarjetas (`metrics`): % Sol, % Tierra, % ambos, noche más larga, apagón más largo, elevación solar máxima | Los números coinciden con `/docs` del backend para el mismo sitio y fecha | 1–1.5 h |
| F5 | **Comparador** (paso 4) | F4 | `features/compare/`: 2–4 escenarios lado a lado (una llamada a `getEphemeris` por escenario, en paralelo), mejor valor resaltado, "misma fecha, otro sitio" y "mismo sitio, otra fecha" | Se ve el trade-off de un vistazo con 3 sitios | 2 h |
| F6 | **Línea de tiempo** (paso 5) | F3 | `features/timeline/`: elevación de Sol y Tierra vs tiempo, bandas de visibilidad, marcas de `events`, slider que mueve `currentTime`, play | Arrastrar el slider anima el panorama | 1.5–2 h |
| F7a | Extra: fechas alternativas | F4 | `getMission()` en `lunarApi.ts` contra `/api/mission` con **fechas** `landing` y `departure` (ya no `duration_days`); botones "probar 3 días antes / después" con `alternatives` (`landing_utc` / `departure_utc`) | Un clic aplica la fecha sugerida | 1 h |
| F7b | Extra: 3D, modo educativo, URL compartible | F6 | Vista Three.js con `vectors_3d` (guía en `docs/archivo/api-output-3d.md`) | — | lo que sobre |

## 6. Orden y reparto sugerido (4 personas)

```
Hoy (noche)                    Mañana (mañana)                 Mañana (tarde)
Back 1:  B1 → B2               B4 → B5                         ensayo + pitch
Back 2:  B3 (necesita el TIF)  B6 / F7a (apoyo al front)       ensayo + pitch
Front 1: F3a → F3              F3 (termina) → F6               pulido
Front 2: F4 (con F3a)          F5                              F7a / pulido
```

Congelar funciones nuevas 3 horas antes de la entrega: de ahí en adelante solo ensayo y correcciones.

## 7. Puntos de integración

| Cuándo | Qué pasa | Quién hace qué |
|---|---|---|
| **Ya** | El front habla con el backend real | Front: `VITE_USE_MOCK=false` en `.env.local` y backend arrancado (ver `README.md`). Quien no tenga Python sigue con mock: devuelve el mismo modelo |
| B2 listo | Llegan `landed_utc`, `agency`, `category_id` | Front: nada que cambiar (el adaptador ya los lee). Verificar "Usar alunizaje" |
| B3 listo | Más sitios con relieve real | Front: nada. El aviso "sin relieve" desaparece solo en esos sitios |
| B4 listo | `earth_frac` en la serie | Front: nada (el adaptador ya lo lee si existe) |
| F4 listo | Primera revisión cruzada | Back revisa que los números de la UI coincidan con `/docs` |
| F5 listo | Ensayo del guion completo | Los 4, con backend real y el `.TIF` en la máquina de la demo |

Nadie espera a nadie: el front ya tiene datos reales para todo lo que va a construir, y lo que el backend agregue
(B2–B4) entra sin tocar componentes.

## 8. Preguntas abiertas para backend

1. ¿Aceptan el contrato tal cual? (Es su API actual; los únicos cambios pedidos son B2 y B4.)
2. ¿Qué máquina se usa en la demo y tiene el `.TIF` en `backend/data/dem/`?
3. Para sitios al norte de 80°S (Apollo, Chandrayaan-3, etc.) el horizonte queda liso. ¿Lo dejamos así con un
   aviso en la UI (recomendado) o consiguen un DEM global grueso?
