# Planeación Fase 3D: Simulador 3D Inmersivo de Alunizaje y Oclusión Lunar

**Estado:** planeación aprobada para ejecución (2026-11-15).
**Documentos relacionados:** `docs/contrato-api.md`, `docs/plan-equipos.md`, `docs/archivo/api-output-3d.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`.

---

## 1. Contexto y Objetivo de la Fase 3D

El proyecto ya cuenta con el sistema 2D completo en producción (catálogo de sitios y coordenadas personalizadas, panorama del horizonte, veredicto `CANDIDATO / NO CANDIDATO`, comparador de escenarios y línea de tiempo interactiva con *Play*), respaldado por el motor astronómico y topográfico del backend (**SPICE DE421** en marco `MOON_ME` + modelos de elevación lunar **LOLA**).

### Objetivo de la siguiente fase
Agregar un **Simulador 3D Inmersivo** directamente integrado en el flujo principal de la aplicación (`SkyPanorama.tsx`) que permita:

1. **Simular el descenso y aterrizaje** en la coordenada `(lat, lon)` y fecha/hora UTC seleccionadas, siguiendo una trayectoria de aproximación desde la órbita hasta la superficie.
2. **Evaluar visualmente en 3D la presencia de energía (Sol) y comunicaciones directas (Tierra)** a lo largo de toda la ventana de tiempo simulada, aprovechando el slider y botón *Play* del `Timeline` existente.
3. **Modelar la superficie lunar de forma realista** combinando una **grilla local DEM de $64 \times 64$ elevaciones** alrededor del punto de aterrizaje con la **máscara de horizonte de $360^\circ$ (`horizon.profile_deg`)**, para analizar de manera real y visual cuándo el relieve lunar o el horizonte bloquean el Sol o la Tierra (`terrain_interference`).
4. **Ofrecer dos perspectivas 3D sincronizadas** usando los dos sistemas de coordenadas que el backend ya calcula y entrega:
   - **Vista 1 (Perspectiva Espacial / Orbital — `MOON_ME`)**: Flotando en el espacio exterior viendo la Luna, el terminador solar real, la Tierra, el Sol, el indicador del punto de aterrizaje, la trayectoria de descenso y los rayos de línea de vista.
   - **Vista 2 (Perspectiva Inmersiva desde la Nave — Marco Topocéntrico Local)**: Viendo desde la nave/punto de aterrizaje el relieve real lunar en $360^\circ$, la trayectoria completa del Sol y la Tierra en la cúpula celeste y las oclusiones físicas causadas por montañas o bordes de cráter.

---

## 2. Decisiones Cerradas de Arquitectura

| # | Decisión | Resultado |
|---|---|---|
| **D-3D1** | **Ubicación en la UI** | Integrado dentro de `frontend/src/features/sky-panorama/SkyPanorama.tsx` mediante un selector de modo (`Panorama 2D` \| `Espacio 3D` \| `Superficie Inmersiva 3D` \| `Vista Dual 3D`), justo encima de `Timeline.tsx`, compartiendo `ephemeris.data`, `currentTime` y `setCurrentTime` del store (`useAppStore`). |
| **D-3D2** | **Terreno local DEM $64 \times 64$ + Horizonte $360^\circ$** | El backend extenderá `horizon` en `POST /api/evaluate` (y `POST /api/mission`) para entregar un parche matricial local de $64 \times 64$ elevaciones reales en metros (`horizon.local_dem`) extraído de LOLA (`LDEM_80S_80MPP_ADJ.TIF` / `LDEM_64_global.tif`). El terreno cercano bajo la nave usa `local_dem` ($64 \times 64$) y el horizonte lejano hasta $200\text{ km}$ usa `horizon.profile_deg` ($1440$ muestras cada $0.25^\circ$) para garantizar oclusión exacta. |
| **D-3D3** | **Dos sistemas de coordenadas sincronizados en toda la serie** | Para cada muestra $t_i$ de `series`, el frontend deriva ambos sistemas sin pedir llamadas adicionales al backend durante la reproducción:<br>• **Vista 1 (`MOON_ME`)**: Usa `at_start.vectors_3d` como referencia y proyecta `(sun_az, sun_el)` y `(earth_az, earth_el)` de `series` al marco `MOON_ME` mediante la base ortonormal local $(\hat{u}_{\text{este}}, \hat{u}_{\text{norte}}, \hat{u}_{\text{arriba}})$ del sitio `(lat, lon)`.<br>• **Vista 2 (Three.js Local)**: $+X = \text{Este}$, $+Y = \text{Cénit}$, $-Z = \text{Norte}$, $+Z = \text{Sur}$, usando la misma fórmula que `body_state()` en `backend/lunar/geometry.py`. |
| **D-3D4** | **Colores y convenciones visuales** | Sol (`#d95926`) y Tierra (`#3987e5`) importados exclusivamente desde `frontend/src/shared/lib/bodies.ts`. El contenedor 3D conserva `theme-fixed` (cielo negro espacial) y el semáforo de estado usa las convenciones existentes (despejado, marginal, interferencia por terreno / bajo horizonte). |
| **D-3D5** | **Gestión de WebGL y React** | Renderizadores `THREE.WebGLRenderer` (y `CSS3DRenderer` / etiquetas HTML superpuestas) aislados en componentes cliente con limpieza obligatoria en `useEffect` (`.dispose()` de geometrías, materiales, texturas y renderer; cancelación de `requestAnimationFrame`; límite de DPR $\le 2$ y pausa en `visibilitychange`). |

---

## 3. Especificación de Datos y Contrato Backend ↔ Frontend

### 3.1 Extensión retrocompatible en `POST /api/evaluate` (y `POST /api/mission`)

No se crean endpoints nuevos ni se renombran campos existentes (respetando `docs/contrato-api.md` y `backend/CLAUDE.md`). Solo se agregan campos nuevos en `horizon` y se aprovechan campos ya enviados que el frontend aún no mapeaba:

#### A. Nuevo bloque `horizon.local_dem` (Grilla $64 \times 64$ de LOLA)
Cuando existe cobertura DEM para la coordenada solicitada, `horizon` incluirá:

```json
{
  "horizon": {
    "terrain": true,
    "dem": ["LDEM_80S_80MPP_ADJ.TIF (~80 m/px)", "LDEM_64_global.tif (~474 m/px)"],
    "z_m": 5321.501,
    "h_obs_m": 2.0,
    "az_step_deg": 0.25,
    "max_deg": 4.061,
    "min_deg": -1.47,
    "profile_deg": ["...1440 valores..."],
    "local_dem": {
      "grid_size": 64,
      "extent_m": 16000,
      "step_m": 253.968,
      "center_z_m": 5321.5,
      "min_z_m": 4180.2,
      "max_z_m": 5610.8,
      "elevations_m": [
        [5102.4, 5110.1, "...64 valores Oeste -> Este..."],
        "...64 filas Norte -> Sur..."
      ]
    }
  }
}
```

- **Geometría de muestreo**: Matriz de $64 \times 64$ puntos ($4096$ floats) sobre un cuadrado tangente local de `extent_m` $\times$ `extent_m` ($16\text{ km} \times 16\text{ km}$ por defecto; $\pm 8\text{ km}$ en Este y Norte desde el punto de aterrizaje), proyectado a coordenadas selenográficas $(\text{lat}, \text{lon})$ con `_destination()` y muestreado bilinealmente con `DemStack.sample()` (`scipy.ndimage.map_coordinates`).
- **Convención de índices**:
  - Fila `r` ($0 \dots 63$): de **Norte** ($+8000\text{ m}$, correspondiente a $-Z$ en Three.js) hacia **Sur** ($-8000\text{ m}$, $+Z$).
  - Columna `c` ($0 \dots 63$): de **Oeste** ($-8000\text{ m}$, $-X$) hacia **Este** ($+8000\text{ m}$, $+X$).
  - Altitud relativa en el origen del sitio: `elevations_m[r][c] - center_z_m` (en metros), coincidiendo exactamente con `z_m` en el centro.
- **Cobertura y fallback**:
  - Tiempo de cálculo al vuelo: $< 15\text{ ms}$ en el backend (cuando los `.TIF` están cargados en `DemStack`).
  - Se puede precalcular opcionalmente en `backend/data/horizons.json` para los sitios del catálogo (peso estimado ~30 KB por sitio o ~600 KB en total para 20 sitios).
  - Si la máquina no tiene archivos DEM y no hay `local_dem` precalculado (`terrain: false`), `local_dem` será `null` y el frontend generará una superficie esférica lisa con aviso visible ("Sin relieve LOLA").
- **Ubicación del DEM local en el repo**: Se detectó que `LDEM_80S_80MPP_ADJ.TIF` está actualmente en `backend/data/LDEM_80S_80MPP_ADJ.TIF`, mientras `backend/lunar/config.py` apunta a `DEM_DIR = DATA_DIR / "dem"`. Como parte del Slice B-3D se moverá a `backend/data/dem/` (o `horizon.py` buscará en ambos directorios) para habilitar el cálculo al vuelo en coordenadas personalizadas del polo sur.

#### B. Campos ya existentes en el backend que el frontend comenzará a mapear
1. `at_start.vectors_3d`:
   - `moon_radius_km` (`1737.4`)
   - `positions_km`: `{ site, earth, sun }`
   - `unit_directions`: `{ site, earth, sun, site_to_earth, site_to_sun }`
2. `at_start.sun.vector_3d_sky` y `at_start.earth.vector_3d_sky`
3. `horizon.z_m` (altitud base del sitio en metros)
4. `series.sun_interference[]` y `series.earth_interference[]` (distingue cuándo el cuerpo está bajo el horizonte matemático vs bloqueado por una montaña real)

### 3.2 Modelo de datos en Frontend (`shared/types/lunar.ts` y `services/lunarApi.ts`)

1. Extender `BodyPosition` en `frontend/src/shared/types/lunar.ts`:
   - Agregar `interference: boolean` (mapeado desde `sun_interference` / `earth_interference` en `toSamples()`).
   - Agregar `skyVector: [number, number, number]` (calculado en `toSamples()` con la convención Three.js $[ \cos(\text{el})\sin(\text{az}),\; \sin(\text{el}),\; -\cos(\text{el})\cos(\text{az}) ]$ para cada paso de la serie).
2. Extender `HorizonProfile`:
   - `altitudeMeters?: number | null` (desde `horizon.z_m`).
   - `localDem?: LocalDemPatch | null` (`gridSize`, `extentMeters`, `stepMeters`, `centerAltitudeMeters`, `minAltitudeMeters`, `maxAltitudeMeters`, `elevationsMeters`).
3. Extender `EphemerisResponse`:
   - `vectors3d?: OrbitalVectors3D` (mapeado desde `at_start.vectors_3d`).
4. Actualizar `frontend/src/mocks/ephemeris.mock.ts` para generar `vectors3d`, `interference` y un `localDem` sintético de $64 \times 64$ cráteres coherente con `MOCK_TERRAIN`, manteniendo funcionando la app con `VITE_USE_MOCK=true`.

---

## 4. Diseño Detallado de las Dos Vistas 3D y Simulación de Aterrizaje

### 4.1 Vista 1: Perspectiva Espacial / Orbital (`OrbitalView3D.tsx`, marco `MOON_ME`)

Permite observar el sistema Luna–Sitio–Tierra–Sol "flotando en el espacio" en el instante seleccionado (`currentTime`):

1. **Globo Lunar 3D**:
   - Esfera centrada en `(0, 0, 0)` con radio visual `MOON_RADIUS_3D = 10`, textura albedo/normal lunar y rotación alineada al marco `MOON_ME`.
   - Iluminación mediante `THREE.DirectionalLight` ubicada en la dirección unitaria del Sol en el instante `t` (`sunDirMoonMe(t)`), reproduciendo con precisión el **terminador lunar** (día vs noche lunar) y las sombras rasantes en las latitudes polares.
2. **Marcador de Sitio, Nave y Curva de Aterrizaje**:
   - Pin 3D / módulo de alunizaje posicionado sobre `siteUnitDir * MOON_RADIUS_3D` orientado con la normal local (`quaternion.setFromUnitVectors((0,1,0), siteDir)`).
   - Arco 3D de aproximación/descenso desde la órbita baja hasta el punto de aterrizaje, sobre el cual avanza la nave cuando se reproduce la secuencia de descenso.
   - Anillo de latitud/longitud o retícula tenue opcional para ubicar fácilmente el Polo Sur o el lado oculto.
3. **Tierra y Sol en Escena**:
   - **Tierra** posicionada en la dirección `earthDirMoonMe(t)` a distancia visual cómoda (ej. `38` unidades) con esfera texturizada y atmósfera sutil.
   - **Sol** indicado en la dirección `sunDirMoonMe(t)` (corona/emisor lejano + dirección de luz).
4. **Rayos de Línea de Vista (Energía y Comunicación)**:
   - Dos rayos desde el punto de aterrizaje hacia el **Sol** (naranja `#d95926`) y hacia la **Tierra** (azul `#3987e5`):
     - **Despejado (`clear`)**: Línea continua luminosa.
     - **Marginal (`visible && !clear`)**: Línea punteada o pulso ámbar (rozando el terreno a $< \varepsilon$).
     - **Bloqueado por terreno (`interference`)**: Línea cortada con marcador de impacto/bloqueo cerca de la superficie.
     - **Bajo horizonte**: Línea apagada/oculta bajo el limbo lunar.
5. **Controles**: `OrbitControls` con zoom/rotación suave y botones rápidos (*"Enfocar Sitio"*, *"Vista Polo Sur"*, *"Ver Sistema Completo"*).

---

### 4.2 Vista 2: Perspectiva Inmersiva desde la Nave (`SurfaceView3D.tsx`, marco topocéntrico local)

Permite situarse en la coordenada y fecha seleccionadas ("somos la nave") y comprobar visualmente cómo la topografía real de LOLA interactúa con el Sol y la Tierra durante toda la simulación:

1. **Terreno Lunar Realista de Dos Capas (Local $64 \times 64$ + Horizonte $360^\circ$)**:
   - **Capa 1 — Malla Local DEM $64 \times 64$ (`local_dem`)**:
     - `PlaneGeometry` de $63 \times 63$ segmentos ($64 \times 64$ vértices) cubriendo $16\text{ km} \times 16\text{ km}$ alrededor de la nave.
     - Cada vértice toma su altura real `(elevations_m[r][c] - center_z_m)` escalada a unidades Three.js y sombreada dinámicamente por la luz del Sol (`castShadow` / `receiveShadow` con `PCFSoftShadowMap`).
     - Así, las crestas y depresiones cercanas proyectan **sombras reales en el suelo alrededor de la nave** cuando el Sol roza el horizonte.
   - **Capa 2 — Anillo Topográfico del Horizonte Lejano (`horizon.profile_deg`)**:
     - Malla cilíndrica/anular cerrada de $360^\circ$ ($1440$ segmentos a $0.25^\circ$) situada en el perímetro exterior (ej. radio `180` unidades) cuya cresta superior sigue exactamente la altura angular $\tan(\text{profile\_deg}[i])$ corregida por curvatura lunar.
     - El anillo tiene material opaco con sombreado de silueta lunar para que, por prueba de profundidad WebGL (`depthTest: true`), cualquier astro cuya elevación sea menor que `profile_deg[az]` **desaparezca físicamente detrás de la montaña**.
   - **Control de Escala Vertical ($1\times$ Real vs $5\times$ Análisis Topográfico)**:
     - En $1\times$ se muestra la escala angular real.
     - En $5\times$ se amplifica el eje vertical ($Y$) de forma consistente para el terreno local, el perfil del horizonte y las elevaciones del Sol/Tierra, preservando la relación $\text{clearance} = \text{elevation} - \text{horizon}$ (fundamental en el polo sur, donde las variaciones ocurren entre $-2^\circ$ y $+4^\circ$).
2. **Modelo Procedural de la Nave / Lander Lunar**:
   - Construido jerárquicamente con grupos y pivotes limpios (`THREE.Group`): cuerpo central octagonal, tren de aterrizaje con 4 patas apoyadas sobre la altura `0` del punto de aterrizaje, **panel solar** con pivote que sigue el azimut/elevación del Sol cuando es visible, y **antena parabólica de alta ganancia** orientada hacia la Tierra cuando hay enlace directo.
   - Modos de cámara en Vista 2:
     - **Primera persona ("Desde la cabina / cámara del mástil")**: A $2\text{ m}$ (`h_obs_m`) sobre el punto de aterrizaje, mirando hacia el horizonte de $360^\circ$.
     - **Tercera persona ("Alrededor del lander")**: Órbita cercana alrededor de la nave posada sobre la malla $64 \times 64$ para ver su iluminación y sombras proyectadas.
3. **Cúpula Celeste, Trayectorias Completas y Análisis Visual de Bloqueo**:
   - **Sol y Tierra** colocados en la cúpula celeste (`SKY_RADIUS = 220`) con tamaño angular proporcional visible (o modo proporcional real vs aumentado para legibilidad), usando $\vec{v}_{\text{sky}}(t)$.
   - **Arcos de trayectoria de toda la simulación**: Se dibujan en el cielo los recorridos completos del Sol y la Tierra para todas las muestras de `samples[]`:
     - Tramo despejado en color sólido (`#d95926` / `#3987e5`).
     - Tramo oculto por el relieve o bajo horizonte en línea discontinua tenue.
     - Clic sobre la trayectoria o arrastre del `Timeline` mueve el instante actual en vivo.
   - **Diagnóstico visual de bloqueo (`terrain_interference`)**:
     - Cuando el backend reporta `interference: true` (el cuerpo está sobre el horizonte ideal pero tapado por el relieve LOLA), además de ocultarse físicamente detrás del terreno en 3D, se renderiza un **indicador fantasma (*ghost ring*)** tras la montaña con una línea vertical al borde superior de la cresta bloqueadora y etiqueta de diagnóstico (ej. *"Bloqueado por relieve: faltan $+1.2^\circ$ para librar cresta"*).
   - **Brújula y Ayudas de Orientación**:
     - Marcadores cardinales `N`, `E`, `S`, `O` flotando en el anillo del horizonte + botones rápidos *"Mirar al Sol"*, *"Mirar a la Tierra"* y *"Reiniciar Horizonte"*.

---

### 4.3 Secuencia Cinemática de Aterrizaje ("Simular Alunizaje")

Disponible desde la barra de controles del Simulador 3D en `SkyPanorama.tsx`:

1. **Botón *"Simular Alunizaje"* + Slider de Altitud ($5000\text{ m} \to 2\text{ m}$)**:
   - Inicia la nave en aproximación final a $5\text{ km}$ de altura sobre la coordenada `(lat, lon)` en el instante `currentTime` (por defecto el instante de aterrizaje o el seleccionado en el `Timeline`).
   - La trayectoria desciende suavemente (interpolación con `THREE.Clock` y desaceleración exponencial/easing cúbico) hasta posar las patas del módulo en la altura real `z_m` ($2\text{ m}$ de observador).
2. **Efecto Topográfico Real durante el Descenso**:
   - En Vista 2 (o en transición desde Vista 1 → Vista 2 al bajar de $1500\text{ m}$), conforme disminuye la altitud de la cámara sobre la malla $64 \times 64$ de LOLA, las montañas y bordes de cráter cercanos suben progresivamente en el campo visual hasta estabilizarse en la silueta exacta de `horizon.profile_deg`.
   - Esto permite observar en tiempo real en qué cota del descenso se establece o se pierde la línea de vista con el Sol o la Tierra.
3. **HUD de Telemetría de Alunizaje (`LandingHud.tsx`)**:
   - Superposición compacta (sin tapar la escena) con:
     - Altitud sobre el terreno (`m`), elevación real LOLA (`z_m`), coordenadas (`lat`, `lon`) y hora UTC.
     - Indicadores en tiempo real de **Energía Solar** (`visibleFraction` %, `clearance` respecto al horizonte) y **Enlace Tierra** (Despejado / Marginal / Bloqueado / Bajo horizonte).
     - Controles de reproducción del descenso (`Iniciar / Pausar / Reiniciar`, velocidad `1x / 2x`, slider manual de altitud).

---

## 5. Integración en `SkyPanorama.tsx` y Experiencia de Usuario

Siguiendo `frontend/CLAUDE.md` (un componente por archivo, contenedor vs presentacional, imports solo desde `features/sky-panorama/index.ts`):

1. **Selector de Vista en la cabecera de `SkyPanorama.tsx`**:
   - Mantener intacto el bento 2D actual (`PanoramaPanel` + `TopView` + `BodyStatusPanel`) como modo por defecto o seleccionable al instante:
     - `Panorama 2D` (el actual)
     - `Espacio 3D` (Vista 1: Orbital `MOON_ME`)
     - `Superficie 3D` (Vista 2: Inmersiva desde la nave + descenso)
     - `Dual 3D` (Vista 1 y Vista 2 lado a lado para ver al mismo tiempo la posición orbital y la vista desde la cabina)
2. **Sincronización automática con `Timeline.tsx` y `ScenarioHeader.tsx`**:
   - Cambiar sitio, fecha de inicio, duración, mover el slider del `Timeline`, pulsar *Play* o hacer clic en un evento (`sunrise`, `sunset`, `earthrise`, `earthset`) actualiza inmediatamente las luces, sombras, vectores, posición de la Tierra/Sol y estado de bloqueo en las escenas 3D **sin reconstruir las mallas**.
   - Se mantiene visible el `BodyStatusPanel` y las alertas de `source === 'mock'` / `terrain === false` para consistencia con el resto de la app.

---

## 6. Arquitectura de Archivos y Vertical Slices

### 6.1 Cambios en Backend (Slice B-3D)

| Archivo | Cambio |
|---|---|
| `backend/data/dem/` | Mover `backend/data/LDEM_80S_80MPP_ADJ.TIF` a `backend/data/dem/LDEM_80S_80MPP_ADJ.TIF` (y asegurar en `horizon.py` compatibilidad si existe en `data/`). |
| `backend/lunar/horizon.py` | Agregar `compute_local_dem(site: Site, dems: DemStack, size: int = 64, extent_m: float = 16000.0) -> dict \| None` usando `_destination` + `DemStack.sample()`. Incluir `local_dem` opcional en `Mask` / `Mask.summary()` y soporte opcional en `horizons.json` / `save_mask`. |
| `backend/lunar/evaluate.py` & `mission.py` | Verificar que `horizon` en `/api/evaluate` y `/api/mission` incluya `local_dem` (cuando haya DEM o precalculado) sin romper ninguna prueba existente. |
| `backend/tests/test_local_dem.py` | Pruebas unitarias y de contrato: verificar forma $64 \times 64$, centro coherente con `z_m`, orientación Norte→Sur / Oeste→Este, fallback `null` sin DEM y tiempo de respuesta. |
| `docs/contrato-api.md` | Documentar el campo `horizon.local_dem` (retrocompatible) y regenerar ejemplo en `docs/ejemplos/` si aplica. |

### 6.2 Cambios en Frontend (Slices F-3D1 a F-3D4)

Estructura dentro de `frontend/src/`:

```text
frontend/
  package.json                              # Agregar three y @types/three
  src/
    shared/
      types/lunar.ts                        # Tipos OrbitalVectors3D, LocalDemPatch, skyVector e interference
    services/
      lunarApi.ts                           # Mapear vectors_3d, horizon.z_m, horizon.local_dem y *_interference
    mocks/
      ephemeris.mock.ts                     # Generar vectors3d y localDem 64x64 sintetico para modo mock
    features/
      sky-panorama/
        SkyPanorama.tsx                     # Selector de vista (2D | Espacio 3D | Superficie 3D | Dual 3D)
        ViewModeSwitch.tsx                  # Botonera accesible de seleccion de modo
        three/
          lunar3dMath.ts                    # Funciones puras: az/el -> skyVector, base local MOON_ME, trayectoria descenso
          demGeometry.ts                    # Generador de malla 64x64 LOLA + anillo horizonte 360° (BufferGeometry)
          landerMesh.ts                     # Modelo procedural Three.js del lander (patas, panel solar y antena articulados)
          OrbitalView3D.tsx                 # Vista 1 (MOON_ME): Luna, terminador solar, Tierra, Sol, sitio, rayos LoS
          SurfaceView3D.tsx                 # Vista 2 (Local): terreno 64x64 + anillo LOLA, lander, trayectorias, ghost disk
          LandingHud.tsx                    # HUD de telemetria y controles de descenso / camara / escala 1x-5x
```

### 6.3 Plan de Ejecución Paso a Paso

1. **Slice B-3D — Grilla Local DEM $64 \times 64$ en Backend**
   - Mover/habilitar `LDEM_80S_80MPP_ADJ.TIF` en `backend/data/dem/`.
   - Implementar `compute_local_dem()` en `backend/lunar/horizon.py` ($64 \times 64$, $16\text{ km} \times 16\text{ km}$).
   - Opcional: actualizar `backend/data/horizons.json` con `python main.py horizon --all --dem data/dem/LDEM_80S_80MPP_ADJ.TIF` (si se incluye `local_dem` en caché) para que los sitios del catálogo tengan grilla $64 \times 64$ incluso sin el `.TIF`.
   - Ejecutar `python -m pytest tests -q` para asegurar $100\%$ de pruebas en verde.

2. **Slice F-3D1 — Dependencias, Tipos, Adaptador y Matemáticas Puras**
   - Instalar `three` y `@types/three` en `frontend/`.
   - Extender `shared/types/lunar.ts`, `services/lunarApi.ts` y `mocks/ephemeris.mock.ts`.
   - Crear `lunar3dMath.ts` con conversión verificada `MOON_ME` $\leftrightarrow$ topocéntrico local para animar la Vista 1 en todo el `Timeline` (validando contra `at_start.vectors_3d.unit_directions` en el instante $t_0$).

3. **Slice F-3D2 — Vista 1: Simulador Orbital 3D (`OrbitalView3D.tsx`)**
   - Escena `MOON_ME` con globo lunar, luz solar real, Tierra, Sol, pin/arco de aproximación y rayos de línea de vista dinámicos.
   - Limpieza completa WebGL en unmount y `visibilitychange`.

4. **Slice F-3D3 — Vista 2: Simulador Inmersivo de Superficie + Descenso (`SurfaceView3D.tsx`)**
   - Malla real $64 \times 64$ de LOLA + anillo de horizonte `profile_deg` ($1440$ puntos).
   - Lander procedural con panel solar y antena que rastrean Sol y Tierra.
   - Cúpula celeste con trayectorias completas, oclusión física por profundidad, *ghost disk* cuando `interference === true`, brújula cardinal, botones de cámara rápida, escala $1\times / 5\times$ y animación de descenso con `LandingHud.tsx`.

5. **Slice F-3D4 — Integración en `SkyPanorama.tsx` y Validación Integral**
   - Integrar `ViewModeSwitch.tsx` y las vistas 3D en `SkyPanorama.tsx` (modos `2D`, `Orbital 3D`, `Superficie 3D`, `Dual 3D`).
   - Verificar `npm run build` y `npm run lint` sin errores ni warnings.
   - Probar casos de validación reales contra backend (`VITE_USE_MOCK=false`):
     - `mons-mouton-im2` (`2025-03-06T17:29:00Z`): Sol rozando a $2.5^\circ$ (az $65.7^\circ$), Tierra a $11.2^\circ$ (az $335.8^\circ$), luego el Sol se oculta detrás del relieve al avanzar en el `Timeline`.
     - `connecting-ridge` (`2026-11-14`): ver el Sol dando la vuelta $360^\circ$ sobre las crestas polares y la Tierra entrando/saliendo por libración detrás del horizonte LOLA.
     - `change6` (lado oculto): comprobar en Vista 1 que el sitio queda en el hemisferio opuesto a la Tierra y en Vista 2 que la Tierra permanece oculta bajo la superficie lunar (`0 %` comunicación).
     - Coordenada personalizada en polo sur: comprobar cálculo al vuelo de `profile_deg` + `local_dem` $64 \times 64$ desde `LDEM_80S_80MPP_ADJ.TIF`.

---

## 7. Criterios de Aceptación de la Fase 3D

1. El usuario puede alternar dentro de `SkyPanorama.tsx` entre la vista 2D actual, la Vista Orbital 3D, la Vista Inmersiva 3D en superficie y la Vista Dual 3D sin perder el estado del escenario ni el instante actual.
2. En **Vista Orbital 3D**, la dirección del Sol (iluminación/terminador), la posición de la Tierra y la ubicación del sitio coinciden matemáticamente con `vectors_3d` del backend en $t_0$ y se actualizan suavemente al mover el `Timeline`.
3. En **Vista Inmersiva 3D**, el terreno combina la grilla local LOLA $64 \times 64$ alrededor de la nave con el perfil de $360^\circ$ (`profile_deg`), ocultando físicamente al Sol o a la Tierra cuando el backend indica bloqueo por relieve o bajo horizonte y mostrando el diagnóstico visual cuando existe `terrain_interference`.
4. La simulación de aterrizaje desciende la nave hasta el punto y fecha solicitados sobre el relieve real, mostrando los cambios de visibilidad del Sol y la Tierra en el HUD.
5. `python -m pytest tests -q` en backend y `npm run build` / `npm run lint` en frontend pasan limpios, sin fugas de memoria WebGL al cambiar de modo o sitio.
