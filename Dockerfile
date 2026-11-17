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
    PYTHONUNBUFFERED=1 \
    DEM_MAX_PX=3800 \
    GDAL_CACHEMAX=32

RUN apt-get update && apt-get install -y --no-install-recommends \
    libexpat1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Download NASA LOLA South Pole DEM (LDEM_80S_80MPP_ADJ.TIF, 189 MB) into /app/backend/data/dem/ and verify load + raycast
RUN python -c "from lunar.download import ensure_south_pole_dem; from lunar.horizon import auto_dems, compute_mask; from lunar.sites import Site; p = ensure_south_pole_dem(); assert p, 'DEM download failed'; d = auto_dems(); assert d and len(d.dems) > 0, 'auto_dems failed'; m = compute_mask(Site(id='test', name='test', lat=-85.0, lon=10.0), d); assert m.terrain and m.z_m is not None, 'compute_mask failed'; print('DEM VERIFIED OK:', d.describe(), 'z_m=', m.z_m)"

# Copy compiled frontend bundle so FastAPI serves it at /
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 8000
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
