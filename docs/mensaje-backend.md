# Mensaje para el equipo de backend

Equipo, revisamos su código completo (no solo el documento) y lo ejecutamos. Resumen:

**1. Su API ya es el contrato.** No les pedimos endpoints nuevos. El front ya está conectado a `GET /api/sites` y
`POST /api/evaluate` con `include_series: true`, y traduce todo en un solo archivo. Lo dejamos escrito en
`docs/contrato-api.md` con JSON reales en `docs/ejemplos/`. **Léanlo y digan si lo aceptan o qué cambiarían.**
Lo único importante: no renombrar ni quitar los campos que lista `backend/CLAUDE.md` sin avisar.

**2. El azimut está bien.** Lo comprobamos contra un cálculo independiente con `unit_directions` en 3 sitios. Los
valores del ejemplo que nos pasaron (71.45 / 15.32) estaban mal escritos en el documento; la API da 65.68 / 335.85.

**3. Sobre `LDEM_80S_80MPP_ADJ.TIF`:** sí es el archivo correcto (LOLA, polo sur, 80 m/px) y su código ya lo usa
bien. Tres cosas:
- No va a git (189 MB). Va en `backend/data/dem/`, que ya está ignorado.
- Lo que sí hay que commitear es `data/horizons.json`: hoy trae 5 sitios. Falta correr
  `python main.py horizon --all --dem data/dem/LDEM_80S_80MPP_ADJ.TIF` para el resto del polo, así todos tenemos
  relieve real sin el archivo.
- Solo cubre de 80°S al polo. Apollo, Chandrayaan-3, etc. quedan con horizonte liso; el front lo avisará.

**4. Lo que les pedimos (unas 3 horas en total, detalle en `docs/plan-equipos.md`):**

| ID | Qué | Tiempo |
|---|---|---|
| B1 | Aceptar el contrato + una prueba que proteja el azimut y la forma de la respuesta | 30 min |
| B2 | En `sites.json`: `category_id`, `agency`, `mission`, `landed_utc`, y 5 sitios de contraste (interior de Shackleton, Malapert, Haworth, Nobile, Chang'e 4) | 45 min |
| B3 | Precalcular horizontes de todo el catálogo del polo y commitear `horizons.json` | 30 min |
| B4 | `earth_frac` en la serie; si llegan `site_id` y `x`/`y`, que gane `site_id` | 30 min |
| B5 | Máquina de la demo con el `.TIF`, ensayo del guion, lámina de las 7 misiones validadas | 45 min |

Nada de esto bloquea al front: lo que agreguen entra solo.

**5. Cambios que hicimos en el repo (sin tocar su código):** `README_BACKEND.md` pasó a `backend/README.md`,
`planeacion.md` a `docs/archivo/`, se agregó `backend/CLAUDE.md` con las convenciones compartidas y se dejó de
versionar `.idea/`.

**3 preguntas:** ¿aceptan el contrato?, ¿qué máquina se usa en la demo y tiene el `.TIF`?, ¿dejamos horizonte liso
con aviso fuera del polo (recomendado) o consiguen un DEM global?
