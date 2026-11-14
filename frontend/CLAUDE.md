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

## Contrato de datos (proponerlo YA a backend)

Tipos en `src/shared/types/lunar.ts`. Ejemplo real en `src/mocks/example-ephemeris-response.json`.

```
GET /api/sites                -> LandingSite[]
GET /api/ephemeris?lat=&lon=&start=&end=&step=&siteId=  -> EphemerisResponse
```

`EphemerisResponse` trae: `horizon` (360 elevaciones del terreno, una por grado de azimut) y `samples`
(por cada instante: azimut, elevacion, elevacion del terreno, visible y fraccion visible, para Sol y Tierra).

Convenciones: grados; lat -90..90 (sur negativo); lon -180..180 (este positivo); azimut desde el norte en
sentido horario; tiempos ISO 8601 UTC.

**Decision propuesta:** backend entrega datos crudos (samples + horizonte); **las metricas las calcula el
front** (porcentajes, ventanas, tiempo hasta puesta). Asi backend se concentra en que las posiciones sean
correctas y no hay que acordar mas endpoints.

Volumen: 30 dias con paso de 60 min = 721 muestras. Con paso de 10 min = 4321. Para graficas, reducir puntos.

## Datos de prueba (mocks)

- `src/mocks/sites.mock.ts`: 14 sitios (polo sur, CLPS, Artemis, Chandrayaan-3, Chang'e en lado oculto,
  Apollo). Coordenadas aproximadas.
- `src/mocks/ephemeris.mock.ts`: generador **sintetico** con el comportamiento correcto (Sol rozando el
  horizonte en el polo, estaciones, libracion, lado oculto sin Tierra, terreno que tapa). Fases inventadas:
  **no son las posiciones reales de esas fechas.**
- `src/services/lunarApi.ts`: unica puerta a los datos. Con `VITE_USE_MOCK=false` y `VITE_API_URL` pega al
  backend real sin tocar componentes.

Casos utiles para probar la UI:

| Sitio | Que deberia verse |
|---|---|
| Cresta Shackleton | Sol casi en el horizonte; mucha luz en abril, casi nada en octubre (mock) |
| Interior Shackleton | Paredes de ~20 grados: nunca Sol ni Tierra |
| Macizo Malapert | Cima: horizonte bajo cero, buena luz y Tierra visible la mayor parte del tiempo |
| Chang'e 6 / 4 | Tierra nunca visible (0%) |
| Chandrayaan-3, Apollo | Tierra siempre visible; Sol sube alto, dia/noche de ~14 dias |

Mostrar un aviso "datos sinteticos" en la UI cuando `source === 'mock'`.

## Vertical slices (cada una termina en algo que se ve y se puede demostrar)

Estructura por feature:

```
src/
  app/            App.tsx, layout, store global (escenarios, escenario activo, instante actual)
  features/
    site-picker/      slice 1
    scenario-form/    slice 2
    sky-panorama/     slice 3
    metrics/          slice 4
    compare/          slice 5
    timeline/         slice 6
  services/       lunarApi.ts
  mocks/
  shared/         types/, lib/ (calculos puros), ui/ (botones, cards)
```

| # | Slice | Listo cuando... | Tiempo aprox |
|---|---|---|---|
| 0 | Base: Vite + Tailwind, copiar types/mocks/services, layout vacio, store | La app arranca y lista los sitios de `getSites()` | 45 min |
| 1 | Selector de sitio: lista por categoria + buscador + lat/lon personalizadas con validacion | Elegir sitio cambia el escenario activo | 1 h |
| 2 | Fecha y carga: inicio, duracion (1/7/14/30 dias), paso; hook `useEphemeris` con loading/error | Se ve "N muestras" y el estado de carga | 45 min |
| 3 | **Panorama del horizonte** (corazon del reto): SVG azimut vs elevacion, silueta del terreno, Sol y Tierra con su tamano | Cambiar sitio/fecha mueve todo | 2-3 h |
| 4 | Metricas: % Sol, % Tierra, % ambos, noche mas larga, apagon de comunicacion mas largo, elevacion solar max; horas hasta puesta de Sol y de Tierra desde el alunizaje; semaforo | Tarjetas con numeros que cambian por sitio/fecha | 1.5 h |
| 5 | **Comparador**: 2-4 escenarios lado a lado, mejor valor resaltado; botones "misma fecha, otro sitio" y "mismo sitio, otra fecha" | Se ve el trade-off de un vistazo | 2 h |
| 6 | Linea de tiempo: elevacion Sol/Tierra vs tiempo con bandas de visibilidad; slider que mueve el instante del panorama; play | Arrastrar el slider anima el panorama | 2 h |
| 7 | Extras: mapa polar de sitios, modo educativo ("por que?"), 3D, URL compartible, exportar | - | lo que sobre |

**Demo minima viable: slices 0 a 5.** El comparador es lo que mas responde al reto; no dejarlo al final.

Sin tests por tiempo, pero: los calculos (metricas, ventanas) como **funciones puras en `shared/lib`**,
fuera de los componentes. Si algo sale raro, se revisa ahi y no en el JSX.
