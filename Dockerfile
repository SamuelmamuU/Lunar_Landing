# Stage 1: Build React + Three.js frontend connected to real backend (VITE_USE_MOCK=false)
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_USE_MOCK=false
RUN npm run build

# Stage 2: Python + FastAPI + SPICE kernels + NASA LOLA South Pole .TIF DEM + Static Frontend
FROM python:3.11-slim
WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Download NASA LOLA South Pole DEM (LDEM_80S_80MPP_ADJ.TIF, 189 MB) into /app/backend/data/dem/
RUN python -c "from lunar.download import ensure_south_pole_dem; ensure_south_pole_dem()"

# Copy compiled frontend bundle so FastAPI serves it at /
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 8000
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
