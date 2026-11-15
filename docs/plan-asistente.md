# Plan: asistente "¿Cómo hacerlo viable?" (backend + frontend)

**Estado:** propuesta del equipo de backend para alinear con frontend (15 nov). Nada de esto está implementado aún.
Se decide en la sección 7 y, una vez aceptado, el contrato del endpoint pasa a `docs/contrato-api.md`.

**Relación con el plan general:** es un extra (como F7). No debe frenar la demo mínima viable de
`docs/plan-equipos.md` (panorama, veredicto y métricas, comparador). Se congela junto con todo lo demás
**3 horas antes de la entrega**.

---

## 1. Qué es

Cuando el escenario del usuario sale **NO CANDIDATO**, la app muestra un panel con **sugerencias concretas para
hacerlo viable**, cada una con un botón **"Aplicar"** que cambia el escenario:

- Mover las fechas (aterrizaje y salida juntos, misma duración).
- Acortar la misión (salida más temprana).
- Otro sitio del catálogo que sí funciona en esas fechas.
- Un punto cercano (a pocos km) con mejor horizonte. *(opcional, fase 3)*

Es un **sistema experto basado en reglas**, no un chat: el backend diagnostica qué falla, genera opciones y
**verifica cada una con el mismo modelo** antes de sugerirla. Ninguna sugerencia se muestra sin haber sido
recalculada como CANDIDATO.

## 2. Por qué es viable hoy

La mayor parte ya existe en el backend y está probada (167 pruebas, validación 7/7):

| Pieza existente | Dónde | Uso en el asistente |
|---|---|---|
| Diagnóstico de qué falla | `result.checks` / `reasons` de `/api/mission` | Decide qué tipo de sugerencia probar |
| Fechas alternativas | `result.alternatives.before/after` (traen `landing_utc` y `departure_utc`) | Sugerencia "mover fechas" |
| Duración máxima | `result.max_feasible_duration_days` | Sugerencia "acortar misión" |
| Relieve en cualquier punto | DEM polar 80 m/px + global 474 m/px | Sugerencia "punto cercano" |
| Velocidad | ~0.3 s por sitio del catálogo; 0.3–0.6 s por punto nuevo | 20 sitios ≈ 6–8 s |

## 3. Reglas del sistema experto

| Qué falla (`checks[].id`) | Primero sugerir | Después | No sugerir |
|---|---|---|---|
| `sol_al_aterrizar` | Mover fechas (el Sol vuelve en ~29.5 días) | Otro sitio / punto más alto | — |
| `tierra_al_aterrizar` | Mover fechas (libración, ~27 días) | Otro sitio | Mover fechas si el sitio está en el **lado oculto** (la Tierra nunca sale): ir directo a otro sitio |
| `energia` (noche > batería) | Acortar la misión | Mover fechas; otro sitio | — |
| `comunicacion` (hueco sin Tierra) | Acortar la misión | Mover fechas; otro sitio | — |

Orden: **primero el cambio más pequeño** (fechas o duración antes que sitio; sitio cercano antes que lejano).
Máximo 5 sugerencias.

## 4. Propuesta de contrato: `POST /api/suggest`

**Petición:** la misma que `POST /api/mission` (sitio por `site_id` o `x`/`y`, `landing`, `departure` y reglas
opcionales), más:

```json
{
  "site_id": "mons-mouton-im2",
  "landing": "2025-03-20T17:29:00Z",
  "departure": "2025-03-30T17:29:00Z",
  "battery_hours": 12,
  "max_comm_gap_hours": 24,
  "include_nearby": false,
  "max_suggestions": 5
}
```

**Respuesta** (forma propuesta; los valores son de ejemplo salvo los marcados como reales):

```json
{
  "diagnosis": {
    "is_candidate": false,
    "label": "NO CANDIDATO",
    "failed": ["sol_al_aterrizar", "tierra_al_aterrizar"],
    "reasons": ["Al aterrizar el Sol no está despejado ..."]
  },
  "suggestions": [
    {
      "kind": "shift_dates",
      "title": "Aterrizar 10.6 días antes",
      "detail": "Misma duración (10 días). Sol y Tierra despejados al aterrizar.",
      "apply": { "landing": "2025-03-10T03:29:00Z", "departure": "2025-03-20T03:29:00Z" },
      "check": { "label": "CANDIDATO", "pct_sun": 0, "pct_earth": 0 }
    },
    {
      "kind": "other_site",
      "title": "Mismas fechas en Connecting Ridge",
      "detail": "...",
      "apply": { "site_id": "connecting-ridge" },
      "check": { "label": "CANDIDATO", "pct_sun": 0, "pct_earth": 0 },
      "distance_km": 0
    }
  ],
  "elapsed_s": 0
}
```

*(Real: para IM-2 con aterrizaje el 20 mar y salida el 30 mar, `/api/mission` hoy sugiere aterrizar el
10 mar 03:29 y salir el 20 mar 03:29. Los porcentajes y el resto son marcadores.)*

| Campo | Significado |
|---|---|
| `kind` | `shift_dates` · `shorten_mission` · `other_site` · `nearby_point` |
| `title` / `detail` | Texto en español listo para mostrar |
| `apply` | **Solo** los campos del escenario que cambian. El front los aplica tal cual |
| `check` | Resultado del modelo con el cambio aplicado (siempre `CANDIDATO`) |
| `distance_km` | En `other_site` y `nearby_point`: distancia al sitio original |
| `suggestions: []` | No se encontró nada viable: el front muestra `diagnosis.reasons` y un texto fijo |

Tiempos objetivo: **< 3 s** sin `include_nearby`; **< 10 s** con `include_nearby` (solo con los DEM en la
máquina; si no están, esa parte se omite y se avisa en `detail`).

## 5. Qué hace cada equipo

### Backend
| ID | Tarea | Listo cuando | Tiempo |
|---|---|---|---|
| A1 | Contrato de `/api/suggest` en `docs/contrato-api.md` + `docs/ejemplos/suggest-im2.json` **real** | Front puede mockear con el ejemplo | 20 min |
| A2 | Endpoint con `shift_dates` y `shorten_mission` (reutiliza `/api/mission`) | Pruebas pasan; IM-2 20 mar da la sugerencia del ejemplo | 45 min |
| A3 | `other_site`: evalúa el catálogo en las mismas fechas, ordena por cercanía | Chang'e 6 sugiere sitios con Tierra visible | 45 min |
| A4 *(opcional)* | `nearby_point`: anillo de puntos a 2/5/10 km, filtro grueso y confirmación | < 10 s en la máquina de la demo | 1–1.5 h |

### Frontend
| ID | Tarea | Listo cuando | Tiempo |
|---|---|---|---|
| P0 | **Prerrequisito:** fecha y hora de salida en el escenario (ver el prompt de cambios de backend) | El escenario tiene aterrizaje y salida | — |
| P1 | `getSuggestions()` en `services/lunarApi.ts` + tipos en `shared/types/lunar.ts`; mock desde `docs/ejemplos/suggest-im2.json` | Funciona en modo mock | 30 min |
| P2 | Panel "¿Cómo hacerlo viable?" (feature nueva, p. ej. `features/suggestions/`): aparece si el veredicto es NO CANDIDATO; carga, error y lista vacía | Se ve con IM-2 el 20 mar | 1 h |
| P3 | Botón "Aplicar": actualiza el escenario con `apply` (sitio, aterrizaje y/o salida) y recalcula | Un clic deja el escenario en CANDIDATO | 30 min |

**En paralelo:** cuando A1 esté listo, front trabaja con el ejemplo en modo mock mientras backend hace A2–A3.

## 6. Orden y puntos de integración

```
A1 contrato + ejemplo ──► P1 + P2 con mock (front)
        │
        └──► A2 ──► A3 ──► integración P3 con backend real ──► ensayo ──► (A4 si sobra tiempo)
```

| Momento | Qué se revisa juntos |
|---|---|
| A1 listo | Front confirma que la forma del JSON le sirve (o la cambia en el contrato) |
| A2 + P2 listos | Primer clic real en "Aplicar" |
| Antes del congelamiento | Ensayo del caso de la demo; si algo falla, el panel se oculta (no rompe el resto) |

## 7. Decisiones que necesitamos (responder antes de empezar)

| # | Pregunta | Propuesta de backend |
|---|---|---|
| D-A1 | ¿Qué significa "no viable"? El veredicto del front hoy viene de `/api/evaluate` (hay alguna ventana en el rango); el asistente usa la lógica de misión (aterrizar en X, operar hasta la salida, batería y comunicación) | Usar la lógica de **misión**: con aterrizaje + salida, es lo que el usuario está planeando |
| D-A2 | ¿Hay tiempo para hacerlo antes del congelamiento? | Sí para A1–A3 y P1–P3 (~2.5 h back, ~2 h front) si se empieza ya. A4 solo si sobra |
| D-A3 | ¿Dónde va el panel en la pantalla? | Debajo del veredicto (F4), solo cuando es NO CANDIDATO |
| D-A4 | ¿Entra en el guion de la demo? | Sí, en el paso 3 ("se retrasó el lanzamiento"): en vez de cambiar la fecha a mano, se pulsa "Aplicar" |
| D-A5 | ¿Chat / lenguaje natural? | No para hoy (dependencia externa, difícil de verificar en vivo). Queda como mejora futura sobre las mismas sugerencias |

## 8. Criterios de aceptación

- IM-2, aterrizaje 2025-03-20 17:29Z, salida 2025-03-30 17:29Z → panel con al menos la sugerencia de mover fechas;
  "Aplicar" deja el escenario en CANDIDATO.
- Chang'e 6 (lado oculto) → **no** sugiere mover fechas; sugiere otro sitio con Tierra visible.
- Un escenario CANDIDATO → el panel no aparece.
- Sin sugerencias posibles → mensaje claro con los motivos, sin errores en consola.
- Backend: pruebas nuevas pasan junto con las existentes. Front: `npm run build` y `npm run lint` limpios.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| No da tiempo antes del congelamiento | Es extra: si A2 o P2 no están a tiempo, no se muestra. La demo mínima no depende de esto |
| `nearby_point` lento | Opcional y apagado por defecto (`include_nearby: false`) |
| Sugerir algo que en realidad no funciona | Toda sugerencia se recalcula con el modelo antes de enviarla (`check`) |
| Front y back con formas distintas del JSON | El ejemplo de `docs/ejemplos/` lo genera la API real, no se escribe a mano |
