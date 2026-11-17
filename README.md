# Lunar Landing Site Navigator

NASA Space Apps 2026 · equipo Bosón de Quásar.

Eliges **sitio + fecha** de alunizaje y ves dónde están el Sol y la Tierra respecto al horizonte real del
terreno, para juzgar energía solar y comunicación directa, y comparar escenarios cuando la misión cambia.

## Demo en vivo (Live Demo)

- **Aplicación Web Interactiva (ALBA — 2D + Simuladores 3D):** https://alba-web-production.up.railway.app
- **Documentación interactiva de la API (Swagger `/docs`):** https://alba-web-production.up.railway.app/docs
- **Estado del servidor y efemérides (`/api/health`):** https://alba-web-production.up.railway.app/api/health

## Estructura

```
backend/    Motor de cálculo (SPICE + LOLA) y API FastAPI.   Ver backend/README.md y backend/CLAUDE.md
frontend/   Aplicación React + TypeScript + Tailwind.        Ver frontend/README.md y frontend/CLAUDE.md
docs/
  contrato-api.md   Contrato único entre backend y frontend (fuente de verdad)
  plan-equipos.md   Guion de la demo y slices de cada equipo
  ejemplos/         Respuestas JSON reales de la API
  archivo/          Documentos anteriores (solo referencia)
```

## Arrancar todo en desarrollo

Dos terminales:

```bash
# 1. Backend  ->  http://localhost:8000/docs
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (en macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn api:app --reload --port 8000

# 2. Frontend ->  http://localhost:5173
cd frontend
npm install
copy .env.example .env.local      # y poner VITE_USE_MOCK=false para usar el backend real
npm run dev
```

El frontend llama a `/api/...` y Vite lo reenvía a `localhost:8000` (no hace falta configurar CORS).

## Reglas del equipo

- El contrato vive en `docs/contrato-api.md`. Si un equipo necesita cambiarlo, primero se cambia ahí y se avisa.
- Ramas: `UI/vertical-slice-N` (front) y `API/slice-N` (back). PR hacia `develop`, nunca directo a `main`.
- Commits chicos con Conventional Commits en español. Cada commit debe compilar / pasar pruebas.
- Nunca subir el DEM (`backend/data/dem/`), `.venv/`, `node_modules/` ni `output/`.
