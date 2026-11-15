# Registro de cambios — Simulador 3D Inmersivo de Aterrizaje Lunar

**Rama:** `Samu3D`  
**Fecha:** 2026-11-15  
**Documento de planeación de referencia:** `docs/planeacion3d.md`

Este documento resume todos los cambios implementados para incorporar la grilla local DEM $64 \times 64$ en el backend y el simulador 3D dual (vista espacial `MOON_ME` + vista inmersiva en superficie con descenso animado y oclusión topográfica física) dentro de `SkyPanorama.tsx`.

---

## 1. Backend (`backend/`)

### `backend/lunar/horizon.py`
- **Respaldo de búsqueda de DEMs en `_load_dems()`:** Si `DEM_DIR` (`backend/data/dem/`) no contiene archivos `.tif`/`.img`, busca automáticamente en `DATA_DIR` (`backend/data/`).
- **Soporte `local_dem` en `Mask`:**
  - `Mask.__init__(..., local_dem: dict | None = None)` almacena la grilla topocéntrica local.
  - `Mask.summary(include_profile=True)` añade el campo `"local_dem": self.local_dem` al objeto `horizon` de `/api/evaluate` y `/api/mission`.
- **Generación de grilla $64 \times 64$ (`compute_local_dem`, `local_dem_for`):**
  - `_step_latlon()`: helper geodésico compartido con `_destination()` para proyectar desplazamientos `(east_m, north_m)` alrededor del sitio.
  - `compute_local_dem()`: genera una malla $64 \times 64$ sobre $16\,000\text{ m}$ (`±8 km`, paso `253.968 m`, filas Norte→Sur, columnas Oeste→Este):
    - Muestrea elevaciones reales desde `DemStack` (LOLA `LDEM_80S_80MPP_ADJ.TIF` cuando cubre la coordenada).
    - `_fill_nan_nearest()`: rellena celdas `NaN` de borde (p. ej. coordenadas cercanas a $-80^\circ$) mediante `scipy.ndimage.distance_transform_edt`, garantizando cero `NaN` en el JSON.
    - `_profile_heightfield()`: para sitios del catálogo fuera del GeoTIFF polar sur actual (como `apollo14`), sintetiza relieve suave coherente con `z_m` y `profile_deg`.
    - Devuelve `None` en modo esfera lisa (`terrain=False`).
  - `local_dem_for()` cachea resultados en `_local_dem_cache`.
  - `mask_for(..., compute=True)` adjunta `local_dem` manteniendo intacto `compute=False` para `test_horizontes_precalculados.py`.

### `backend/tests/test_local_dem.py`
- Nueva suite de 4 pruebas:
  1. `test_local_dem_sitio_polo_sur_y_coordenada_libre`: valida dimensiones $64 \times 64$, valores finitos y cotas (`min_z_m <= center_z_m <= max_z_m`) en `mons-mouton-im2`, coordenada libre `(-85.4, 31.2)` y borde `-80.05°`.
  2. `test_local_dem_sitio_catalogo_fuera_de_cobertura_dem`: valida el respaldo direccional para `apollo14`.
  3. `test_sphere_mask_sin_local_dem`: confirma `local_dem is None` cuando `terrain=False`.
  4. `test_evaluate_endpoint_incluye_local_dem_y_vectores_3d`: prueba de extremo a extremo sobre `POST /api/evaluate` (`include_series=True`), verificando `horizon.local_dem`, `at_start.vectors_3d` (`MOON_ME`) y `series.sun_interference` / `series.earth_interference`.

---

## 2. Contrato de API y Documentación (`docs/`)

### `docs/contrato-api.md`
- Se documentó `horizon.local_dem` (`size`, `extent_m`, `step_m`, `center_z_m`, `min_z_m`, `max_z_m`, `heights_m`) y su valor `null` cuando `horizon.terrain` es `false`.

### `docs/planeacion3d.md` y `docs/cambios-simulador-3d.md`
- `docs/planeacion3d.md`: plan técnico y arquitectónico aprobado para la fase 3D.
- `docs/cambios-simulador-3d.md`: registro de cambios de esta versión.

---

## 3. Dependencias del Frontend (`frontend/`)

### `frontend/package.json` y `frontend/package-lock.json`
- Se añadieron:
  - `"three": "^0.187.0"` en `dependencies`
  - `"@types/three": "^0.187.0"` en `devDependencies`

---

## 4. Tipos, Transformaciones, Adaptador API y Mock (`frontend/src/`)

### `frontend/src/shared/types/lunar.ts`
- Nuevos tipos: `Vec3`, `LocalDemPatch` y `OrbitalVectors3D`.
- `HorizonProfile`: suma `altitudeMeters: number | null` y `localDem: LocalDemPatch | null`.
- `BodyPosition`: suma `interference: boolean` y `skyVector: Vec3`.
- `EphemerisResponse`: suma `vectors3d: OrbitalVectors3D | null`.

### `frontend/src/shared/lib/skyVector.ts`
- Helpers matemáticos puros sin React:
  - `azElToSkyVector()`: convierte `(az, el)` a vector unitario Three.js (`+X=Este, +Y=Zenit, -Z=Norte`).
  - `moonMeBasis()` y `azElToMoonMe()`: calcula la base local `(east, north, up)` en marco `MOON_ME` coherente con el backend.
  - `moonMeToThree()`: mapea `MOON_ME` a ejes Three.js con el Polo Norte lunar hacia `+Y`.

### `frontend/src/services/lunarApi.ts`
- Se extendió `ApiEvaluate` (`z_m`, `local_dem`, `vectors_3d`, `sun_interference`, `earth_interference`) y los mapeadores `toLocalDem`, `toVectors3D`, `toSamples` y `toEphemeris`.

### `frontend/src/mocks/ephemeris.mock.ts`
- `generateHorizon()` ahora incluye `altitudeMeters` y una grilla sintética determinista `localDem` de $64 \times 64$ con cráteres coherente con el perfil del horizonte.
- `bodyPosition()` calcula `interference` y `skyVector`.
- `generateEphemeris()` puebla `vectors3d` para modo offline (`VITE_USE_MOCK=true`).

---

## 5. Simulador 3D e Integración en `SkyPanorama` (`frontend/src/features/sky-panorama/`)

### Módulos Three.js (`features/sky-panorama/three/`)
- **`lunar3dMath.ts`**: helpers `bodyOcclusionState()`, `skyPositionAtRadius()`, `computeOrbitalDirectionsAtSample()` y curva cinemática de aterrizaje `computeDescentState()` ($5000\text{ m} \to 2\text{ m}$).
- **`orbitalScene.ts`** *(Vista 1 — Espacio `MOON_ME`)*:
  - Globo lunar con textura y bump map procedurales de cráteres/maria, paralelo $-80^\circ\text{S}$ y ecuador.
  - Terminador solar real iluminado por `DirectionalLight`, esferas indicadoras de Sol (`#d95926`) y Tierra (`#3987e5`).
  - Pin en el sitio de aterrizaje, arco de aproximación orbital con nave animada, rayos de línea de vista (punteados ante bloqueo) y `OrbitControls` con presets (`Global`, `Polo Sur`, `Sitio`).
  - Liberación completa de geometrías, materiales, texturas y renderer en `dispose()`, además de pausa automática con `visibilitychange`.
- **`demGeometry.ts`**:
  - `sampleLocalElevationOffset()`: interpolación bilineal de altura local más curvatura lunar $r^2 / (2 R_M)$.
  - `buildLocalDemMesh()`: malla $64 \times 64$ del parche local (`localDem`) o casquete esférico si `localDem === null`.
  - `buildHorizonRidge()`: cordillera perimetral $360^\circ$ a $26\,000\text{ m}$ acorde a `profile_deg` para producir oclusión real por z-buffer, con soporte de escala vertical (`1x` física o `5x` inspección).
- **`landerMesh.ts`**: módulo de aterrizaje procedural (~$4\text{ m}$) con patas/zapatas, panel solar articulado siguiendo al Sol, antena parabólica apuntando a la Tierra y pluma de motor durante el descenso.
- **`surfaceScene.ts`** *(Vista 2 — Superficie Inmersiva y Descenso)*:
  - Terreno local $64 \times 64$ + horizonte lejano $360^\circ$ + bóveda celeste a $44\,000\text{ m}$ con trayectorias completas de Sol y Tierra sobre `samples[]`.
  - Oclusión física real de discos/trayectorias tras montañas lunares, más anillo fantasma diagnóstico (`depthTest: false`) cuando `interference` es `true`.
  - Marcadores cardinales `N/E/S/O`, trayectoria guía de descenso, modos de cámara (`Cabina 1ª`, `Nave 3ª`, `Descenso`) y enfoque directo (`lookAtBody`).

### Componentes React
- **`OrbitalView3D.tsx`**: wrapper React con controles de cámara e indicadores de estado Sol/Tierra.
- **`SurfaceView3D.tsx`** y **`LandingHud.tsx`**: HUD de altitud, velocidades `Vv`/`Vh`, fase de descenso, alerta de oclusión topográfica, escala `1×/5×`, reproducción/slider del aterrizaje y botones `Enfocar Sol`/`Enfocar Tierra`.
- **`ViewModeSwitch.tsx`**: selector `Panorama 2D` | `Superficie 3D` | `Espacio 3D` | `Dual 3D`.
- **`SkyPanorama.tsx`**: integra el cambio de vistas, el ciclo `requestAnimationFrame` del descenso animado (~14 s) y mantiene sincronizados `Timeline`, `TopView` y `BodyStatusPanel`.

---

## 6. Verificación ejecutada

- **Backend (`backend\.venv`, `pytest 8.4.2`):**
  - `pytest tests/test_local_dem.py -v` → **4 passed**.
  - `pytest tests -q` → **172 passed** (79.17 s, 0 fallos).
- **Frontend (`frontend/`):**
  - `npm run lint` (`oxlint`) → **0 warnings, 0 errors** (138 archivos).
  - `npm run build` (`tsc -b && vite build`) → **exit 0**, 150 módulos compilados (`dist/assets/index-DGZM6JMr.js` 898.06 kB).
