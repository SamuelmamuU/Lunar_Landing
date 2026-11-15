# Lunar Landing Site Navigator - Contexto del frontend

NASA Space Apps 2026 (14-15 nov). Stack: React + TypeScript + Tailwind (Vite).

## Que hay que construir (en una frase)

Una herramienta donde eliges **sitio + fecha** de alunizaje (sobre todo en el polo sur) y ves al instante
**donde estan el Sol y la Tierra respecto al horizonte del terreno**, para juzgar **energia solar**
(Sol visible y que tan alto) y **comunicacion directa** (Tierra visible), y **comparar escenarios**
rapido cuando la mision cambia de fecha o de lugar.

Lo que pide el reto, ordenado por peso:

1. Posicion de Sol y Tierra respecto al horizonte en un sitio y fecha.
2. Comparar varios sitios/fechas rapido (el caso de uso: "se retraso el lanzamiento, que cambia?").
3. Tiempo restante hasta la puesta de Sol y de Tierra.
4. Metricas: elevacion solar, duracion de luz, ventanas de visibilidad de la Tierra.
5. Catalogo de sitios + coordenadas personalizadas.
6. Que lo entienda alguien que no es experto (educadores, publico).

## Conceptos minimos (para el equipo)

| Termino | Que es | Por que importa en la UI |
|---|---|---|
| Azimut | Direccion en el horizonte, 0-360, 0 = norte, 90 = este | Eje X del panorama |
| Elevacion | Angulo sobre el horizonte "plano" | Eje Y del panorama. En el polo sur el Sol anda entre -2 y +2 grados: **hay que exagerar el eje Y** |
| Horizonte del terreno | Que tan alto se ve el terreno en cada direccion (montanas, bordes de crater) | Un cuerpo es visible si su elevacion es mayor que la del terreno en ese azimut. Desde una cima puede ser negativo |
| Dia lunar | ~29.5 dias terrestres. En el polo el Sol no sube y baja: da vueltas rozando el horizonte | La linea de tiempo debe ser de semanas, no de horas |
| Libracion | Bamboleo aparente de la Luna; la Tierra casi no se mueve en el cielo lunar, solo oscila +-7 grados | En el polo sur la Tierra entra y sale del horizonte cada ~27 dias. En el lado oculto nunca sale |
| Earthset | Cuando la Tierra baja del horizonte del terreno | Inicio de apagon de comunicacion directa |
| Sombra permanente (PSR) | Interiores de crater que nunca ven el Sol | Hay hielo, pero cero energia solar |

## Contrato de datos y backend real

**Fuente de verdad:** `docs/contrato-api.md` (raiz del repo). Plan y slices de ambos equipos: `docs/plan-equipos.md`.
Si el contrato cambia, se cambia primero ahi.

- El contrato es la API que backend ya tiene (`snake_case`). El front **no** usa esos nombres en los componentes:
  `src/services/lunarApi.ts` traduce la respuesta al modelo del front (`src/shared/types/lunar.ts`, `camelCase`).
  Si backend cambia un campo, solo se toca `lunarApi.ts`.
- Endpoints que usa el front: `GET /api/sites` y `POST /api/evaluate` (con `include_series: true`, paso 60 min).
  Extra: `POST /api/mission` (fechas alternativas, `search_days: 30`; solo se pide con un boton porque tarda ~1.5 s
  y va por la misma cola de SPICE). Recibe **fechas**, no duracion: `landing` (aterrizaje) y
  `departure` (salida de la Luna); la duracion la calcula backend.
- `start` y `end` de `/api/evaluate` tambien son fechas. El formulario tiene dos fechas (Inicio y Fin, maximo
  `MAX_DURATION_DAYS` = 60 dias); el escenario guarda inicio + duracion para que al mover el inicio el fin se recorra
  con la misma duracion. El front manda `end = start + dias` (`scenarioToRequest`), nunca un numero de dias.
- Sitio del catalogo: se manda solo `site_id`. Sitio personalizado: solo `x` (lon) y `y` (lat). Nunca ambos.
- **Una peticion a `/api/evaluate` a la vez.** SPICE no es thread-safe: dos calculos simultaneos tumban backend con
  `SPICE(BADSUBSCRIPT)`. `getEphemeris` las pone en fila (`enqueueEvaluate` en `lunarApi.ts`); no saltarse esa cola.

`EphemerisResponse` (lo que devuelve `getEphemeris`) trae:

| Campo | Que es | Quien lo usa |
|---|---|---|
| `horizon` | Silueta del terreno (`elevations` cada `stepDeg`; puede ser 1 o 0.25 grados) | Panorama |
| `samples` | Por instante: azimut, elevacion, elevacion del terreno, visible y fraccion visible de Sol y Tierra | Panorama, timeline |
| `metrics` | % Sol, % Tierra, % ambos, noche mas larga, apagon mas largo, elevacion solar max/min | Metricas, comparador |
| `events` | Salidas y puestas de Sol y Tierra (precision ~1 s) | Timeline |
| `next` | Proximo cambio desde el inicio: "se pone en X h" (null = no cambia en 60 dias) | Metricas |
| `verdict` | CANDIDATO o no, motivos en texto, ventanas de aterrizaje | Metricas, comparador |
| `terrain` | false = sin relieve real (esfera lisa): **avisar en la UI** | Panorama |
| `source` | `'spice'` (backend real) o `'mock'` (sinteticos): **avisar en la UI** | App |

**Las metricas, eventos y veredicto los calcula backend** (ya estan probados contra misiones reales). El front no
los recalcula: los muestra. En `shared/lib` solo van calculos de presentacion (escalas del panorama, formato de
duraciones, reducir puntos para graficar).

Definicion de visible (igual que backend): Sol visible = asoma alguna parte del disco; Tierra visible = el centro
esta sobre el terreno. "Despejado" lo decide backend (`sun_clear` / `earth_clear`, segun cuanto del disco tapa
el relieve) y el front lo usa tal cual en `BodyPosition.clear`: no se reemplaza por un umbral fijo.

Convenciones: grados; lat -90..90 (sur negativo); lon -180..180 (este positivo); azimut desde el norte en
sentido horario; tiempos ISO 8601 UTC.

Volumen: 30 dias con paso de 60 min = 721 muestras (~0.3 s en backend).

## Como correr con datos reales o con mock

| Modo | `.env.local` | Necesita |
|---|---|---|
| Backend real (recomendado) | `VITE_USE_MOCK=false` | Backend arrancado: `uvicorn api:app --reload --port 8000` dentro de `backend/` |
| Mock | `VITE_USE_MOCK=true` (o sin archivo) | Nada |

**Sin `.env.local` la app corre con el mock** (posiciones inventadas). Para la demo: copiar `.env.example` a
`.env.local` con `VITE_USE_MOCK=false` y reiniciar Vite. Si la UI muestra el aviso de datos sinteticos, es el mock.

El front llama a `/api/...` y Vite lo reenvia a `localhost:8000` (`vite.config.ts`): no importa el puerto del front.

- `src/services/lunarApi.ts`: unica puerta a los datos (mock o backend).
- `src/mocks/sites.mock.ts`: 14 sitios de prueba, coordenadas aproximadas. **El catalogo real es el de backend.**
- `src/mocks/ephemeris.mock.ts` + `summary.mock.ts`: generador **sintetico** con el comportamiento correcto (Sol
  rozando el horizonte en el polo, libracion, lado oculto sin Tierra, terreno que tapa) y el mismo modelo que la
  API real. Fases inventadas: **no son las posiciones reales de esas fechas.**

Casos utiles para probar la UI con backend real:

| Sitio (id) | Fecha | Que deberia verse |
|---|---|---|
| `mons-mouton-im2` | 2025-03-06T17:29Z | Sol a 2.5 grados (az 66), Tierra a 11 grados (az 336), CANDIDATO; Sol se pone en ~13 dias |
| `connecting-ridge` | 2026-11-14 | Sol visible el 100% de 30 dias, Tierra ~47% |
| `change6` | cualquiera | Tierra nunca visible (0%), con relieve real |
| `apollo11` | cualquiera | Dia/noche de ~14 dias, Tierra siempre visible |
| Coordenadas propias | cualquiera | Relieve real si la maquina tiene los DEM en `backend/data/dem/`; si no, aviso "sin relieve" |

## Vertical slices (cada una termina en algo que se ve y se puede demostrar)

Estructura por feature (ver reglas completas en **Buenas practicas** abajo):

```
src/
  main.tsx                 Punto de entrada. No tocar salvo providers globales.
  index.css                Solo @import "tailwindcss" (+ @theme si hace falta).
  app/
    App.tsx                Solo compone: que feature va en el sidebar y cual en el main.
    store.ts               Store global (zustand): escenarios, escenario activo, instante actual.
    layout/
      AppLayout.tsx        Armazon: Header + Sidebar + MainContent.
      Header.tsx
      Sidebar.tsx          El <aside>. Recibe children.
      MainContent.tsx      El <main> (ventana principal). Recibe children.
  features/
    site-picker/           slice 1
      index.ts             API publica del feature (lo unico que se importa desde fuera).
      SitePicker.tsx       Contenedor: datos + store. Delega la UI a los hijos.
      SiteList.tsx, SiteOption.tsx, SiteSearch.tsx, SiteListSkeleton.tsx, CustomSiteForm.tsx
      useSites.ts          Hook de datos del feature.
      siteFilters.ts       Funciones puras del feature.
    scenario-form/         slice 2
    sky-panorama/          slice 3
    metrics/               slice 4
    compare/               slice 5
    timeline/              slice 6
  services/
    lunarApi.ts            Unica puerta a los datos (mock o backend).
  mocks/                   Solo los importa services/.
  shared/
    types/lunar.ts         Modelo de datos del front (el contrato con backend esta en docs/contrato-api.md).
    lib/                   Funciones puras sin React (coords.ts, dates.ts, ephemeris.ts, eventLabels.ts...).
                           Unica excepcion: hooks genericos sin negocio (useElementSize.ts).
    ui/                    Componentes genericos sin logica de negocio (Button, TextField, DataField, Coordinates,
                           RegionBadge, DataSourceBadge, ChartTooltip...).
      icons/               Iconos SVG como componentes (CompassIcon...), siempre con aria-hidden.
```

| # | Slice | Listo cuando... | Estado |
|---|---|---|---|
| 0 | Base: Vite + Tailwind, types/mocks/services, layout, store | La app arranca y lista los sitios | Hecho |
| 1 | Selector de sitio: lista por categoria + buscador + lat/lon personalizadas | Elegir sitio cambia el escenario activo | Hecho |
| 2 | Fecha y carga: inicio y fin (hasta 60 dias); `useEphemeris` con loading/error | Se ve el estado de carga | Hecho |
| F-int | Conexion al backend real: adaptador en `lunarApi.ts`, proxy de Vite | Con `VITE_USE_MOCK=false` llegan catalogo y efemerides reales | Hecho |
| 3a | Efemerides al store (`ephemeris` + `loadEphemeris`); avisos de `source === 'mock'` y `terrain === false` | Un solo estado compartido | Hecho |
| 3 | **Panorama del horizonte** (corazon del reto): SVG azimut vs elevacion, silueta del terreno, Sol y Tierra con su tamano, recorrido; cursor con iman sobre discos y recorrido (clic = ir a ese instante) | Cambiar sitio/fecha mueve todo | Hecho |
| 4 | Veredicto y metricas: CANDIDATO o no con motivos, "se pone en...", tarjetas con `metrics` | Los numeros coinciden con `/docs` de backend | Hecho |
| 5 | **Comparador**: 2-4 escenarios lado a lado, mejor valor resaltado; "misma fecha, otro sitio" y "mismo sitio, otra fecha" | Se ve el trade-off de un vistazo | Hecho |
| 6 | Linea de tiempo: elevacion Sol/Tierra vs tiempo, bandas de visibilidad, `events` (con lista "Ver en el panorama"), slider que mueve el panorama; play | Arrastrar el slider anima el panorama | Hecho |
| 7a | Fechas alternativas: en el veredicto NO CANDIDATO, "Buscar fechas cercanas" (`/api/mission`, ±30 dias, misma duracion) y "Probar N d antes/despues" | Un clic aplica la fecha sugerida | Hecho |
| 7b | Extras: 3D, modo educativo, URL compartible | - | lo que sobre |

Detalle, dependencias y guion de la demo: `docs/plan-equipos.md`.

**Demo minima viable: slices 0 a 5.** El comparador es lo que mas responde al reto; no dejarlo al final.

Sin tests por tiempo, pero: los calculos de presentacion (escalas, formato) como **funciones puras en
`shared/lib`**, fuera de los componentes. Si algo sale raro, se revisa ahi y no en el JSX.

## Buenas practicas (obligatorias, para no tener todo regado)

### Donde va cada cosa

| Si vas a crear... | Va en... | Ejemplo |
|---|---|---|
| Una region de la pantalla (header, aside, main, footer) | `app/layout/` | `Sidebar.tsx` |
| Algo que pertenece a un slice | `features/<slice>/` | `features/metrics/MetricCard.tsx` |
| Un componente que usan 2+ features y no sabe de negocio | `shared/ui/` | `TextField.tsx`, `Button.tsx` |
| Un calculo de presentacion (escalas, formato, validacion) | `shared/lib/` si lo usan varios; `features/<slice>/<algo>.ts` si es solo de ese slice | `coords.ts`, `siteFilters.ts` |
| Un hook de datos o de logica | `features/<slice>/useAlgo.ts` (o `shared/lib/` si es generico) | `useSites.ts`, `useEphemeris.ts` |
| Una llamada al backend | `services/lunarApi.ts`. **En ningun otro lado se hace `fetch`.** | `getEphemeris()` |
| Un tipo del modelo de datos | `shared/types/lunar.ts` | `EphemerisSample` |
| La forma cruda de una respuesta de backend | Dentro de `services/lunarApi.ts` (no se exporta) | `ApiEvaluate` |
| Estado que comparten varios features | `app/store.ts` | `activeScenario` |

Si no sabes donde va, preguntalo antes de crear una carpeta nueva.

### Direccion de los imports

```
app  ->  features  ->  shared
  \         |
   \        v
    ---> services  ->  mocks
```

- `app/` puede importar de `features/` (solo su `index.ts`), `shared/` y `services/`.
- `features/` importa de `shared/`, `services/` y `app/store`. **Nunca** de los archivos internos de otro
  feature: solo de su `index.ts` (`import { SitePicker } from '../features/site-picker'`).
- `app/layout/` **no importa features**. Recibe el contenido por `children` o props, para poder mover
  piezas cambiando solo `App.tsx`.
- `shared/` **nunca** importa de `app/`, `features/` ni `services/`. `shared/lib/` no importa React, salvo hooks
  genericos sin negocio (`useElementSize.ts`).
- Los componentes **nunca** importan de `mocks/`. Todo pasa por `services/lunarApi.ts`.

### Componentes

- **Un componente por archivo.** El archivo se llama igual que el componente, en PascalCase (`SiteOption.tsx`).
  Nada de subcomponentes escondidos al final del archivo.
- **Contenedor vs presentacional.** El contenedor del feature (`SitePicker`) lee store/hooks y pasa props.
  Los hijos (`SiteList`, `SiteOption`) solo reciben props y no tocan el store ni hacen fetch.
- Exports **con nombre** (`export function SiteOption`). Solo `App` es default.
- Props tipadas con `interface Props` arriba del componente.
- Si un componente pasa de ~150 lineas o hace mas de una cosa, se divide.
- Cada feature tiene un `index.ts` que exporta solo lo que usa `App.tsx`.

### Estado

- **Store global (zustand)** solo para lo que comparten varios features: escenarios, escenario activo,
  instante actual. Todo lo demas es `useState` local.
- Leer el store con selector: `useAppStore((s) => s.activeScenario)`, nunca `useAppStore()` completo
  (re-renderiza todo).
- Las acciones del store (`selectSite`, `addCustomSite`...) viven en `store.ts`, no en los componentes.
- Los sitios propios ("+ Nuevo", se quitan con su X) y los escenarios del comparador se guardan en `localStorage`
  (`persist` de zustand, clave `lunar-landing:compare`): solo sitio + fechas, nunca las efemerides (se vuelven a
  pedir al abrir). Si cambia la forma de `Scenario`, subir
  `PERSIST_VERSION` en `store.ts` para descartar lo guardado.

### Estilos

- **Solo Tailwind.** No crear archivos `.css` nuevos ni `style={{}}` salvo valores calculados (posiciones del SVG,
  retrasos de animacion). Estilos globales (como `cursor: pointer` en botones) van en `@layer base` de `index.css`.
- **Botones: siempre `<Button variant="primary|ghost|link">`** de `shared/ui`. No estilizar `<button>` a mano: el
  color de las acciones vive solo en `Button.tsx`. Unica excepcion: items seleccionables de una lista
  (como `SiteOption`), que son un `<button>` con `aria-pressed` y su propio estilo.
- **Iconos:** un componente por icono en `shared/ui/icons/`. Nada de `<svg>` pegado dentro de un componente.
- **Scroll:** toda zona con `overflow-y-auto` lleva tambien `scrollbar-subtle` (utilidad definida en `index.css`).
- **Animaciones** (`tailwindcss-animated`): siempre con `motion-reduce:animate-none` y duraciones cortas
  (`animate-duration-300` a `500`). Solo en entradas y como respuesta a acciones, no decorativas en loop.
- Paleta: superficies `slate`, acento `blue-600` (marca del equipo), texto `slate-900` / `slate-500`.
- **Modo oscuro: no usar `dark:` en los componentes.** Sigue al sistema hasta que el usuario elige con `ThemeToggle`
  (se guarda en `localStorage`, `shared/lib/theme.ts`). `index.html` pone `.dark` en `<html>` antes de pintar e
  `index.css` invierte las escalas de color (grises neutros casi negros, tintes apagados). Se escribe la clase de
  modo claro y el oscuro sale solo. Lo que ya es oscuro por diseno (el bento del panorama) lleva `theme-fixed` y
  conserva sus colores. Si un color nuevo no se ve bien en oscuro, se ajusta en `index.css`, no en el componente.
- **Datos (coordenadas, datos de mision): `teal`** (`text-teal-700`, chips `bg-teal-50`), peso normal, sin bold.
  Usar `<Coordinates>` y `<DataField tone="accent">` en vez de repetir clases.
- **Rojo, ambar y `green` estan reservados** para errores, avisos y el semaforo de metricas. No usarlos para
  series ni decoracion. (`teal` no es `green`: el semaforo usa `green-*`, los datos `teal-*`.)
- Sol y Tierra tienen **un color fijo cada uno en toda la app** (panorama, timeline, comparador). Se definen
  una sola vez en `shared/lib/` en el slice 3 y todos lo importan de ahi.
- Para graficas seguir la skill `dataviz`: un solo eje Y, leyenda + etiqueta directa, nunca solo color.
- **Nada cambia de tamano al mover el instante.** Todo texto que dependa de `currentTime` (fechas, estados como
  "parcialmente visible") lleva ancho fijo o no se parte (`whitespace-nowrap`, `w-[Nch]`). Si cambia de alto o de
  ancho, a ciertos anchos de pantalla algo baja de linea y la pagina brinca al arrastrar la linea de tiempo.
  Al probarlo, barrer anchos cada 10 px: el problema aparece solo en franjas angostas.
- **Todo contenedor con scroll lleva `relative`.** Si no, lo que va en `position: absolute` adentro (los `sr-only`
  de los labels) se mide contra la pagina, alarga el documento y se puede escrollear toda la pagina.

### Nombres e idioma

- Codigo (variables, funciones, tipos, archivos) y **textos de la UI en ingles** (la entrega es en ingles). Comentarios en **espanol**.
- Componentes `PascalCase.tsx`, hooks `useAlgo.ts`, utilidades `camelCase.ts`.

### Accesibilidad minima

- Todo input con `<label>`. Errores con `aria-invalid` + `aria-describedby` (ya lo hace `TextField`).
- Botones son `<button>`, no `<div onClick>`. Foco visible (`focus-visible:ring-*`).
- Nunca comunicar algo solo con color: va con texto o icono.

### Git

- Una rama por slice: `UI/vertical-slice-N`. PR hacia `develop`, nunca directo a `main`.
- Commits chicos, uno por responsabilidad, con Conventional Commits en espanol:
  `feat(site-picker): ...`, `fix(store): ...`, `refactor(layout): ...`, `docs: ...`, `chore(deps): ...`.
- **Cada commit debe compilar** (`npm run build`).

### Antes de abrir un PR

1. `npm run build` sin errores.
2. `npm run lint` sin warnings.
3. La app corre y la consola del navegador no tiene errores.
4. Ningun archivo fuera de la estructura de arriba y ningun `fetch` fuera de `services/`.
