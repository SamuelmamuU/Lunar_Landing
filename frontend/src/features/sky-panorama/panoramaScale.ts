// Escalas y trazos del panorama (sin React): de grados a pixeles del SVG.
// El SVG mide lo mismo que su contenedor (1 unidad = 1 px), asi los textos quedan a su tamano real.
// Eje X = azimut 0..360. Eje Y = elevacion, exagerada: en el polo todo pasa en unos pocos grados.

import { BODIES, BODY_IDS, type BodyId } from '../../shared/lib/bodies';
import type { EphemerisSample, HorizonProfile } from '../../shared/types/lunar';

const MARGIN = { top: 26, right: 14, bottom: 42, left: 44 };

/** Los cuerpos nunca se dibujan mas chicos que esto, aunque su tamano angular sea menor. */
const MIN_DISC_RADIUS_PX = 4;
/** Altura minima del cielo sobre el horizonte plano, para que un sitio llano no quede aplastado. */
const MIN_SKY_DEG = 2;
const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 45];
const MAX_TICKS = 7;

export interface PanoramaScale {
  /** Tamano total del SVG en pixeles. */
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Elevaciones (grados) en el borde inferior y superior del area de dibujo. */
  minElevation: number;
  maxElevation: number;
  x: (azimuth: number) => number;
  y: (elevation: number) => number;
  /** Pixel X del viewBox -> azimut 0..360. */
  azimuthAt: (x: number) => number;
  /** Cuantas veces mas grande se ve un grado vertical que uno horizontal. */
  exaggeration: number;
}

/**
 * Arma la escala para un SVG de `width` x `height` pixeles, de modo que quepan el terreno y todo el
 * recorrido de Sol y Tierra que sube sobre el.
 */
export function createScale(
  horizon: HorizonProfile,
  samples: EphemerisSample[],
  width: number,
  height: number,
): PanoramaScale {
  let terrainMin = 0;
  let skyTop = MIN_SKY_DEG;
  for (const elevation of horizon.elevations) {
    if (elevation < terrainMin) terrainMin = elevation;
    if (elevation > skyTop) skyTop = elevation;
  }
  for (const sample of samples) {
    for (const id of BODY_IDS) {
      const top = sample[id].elevation + BODIES[id].angularRadiusDeg;
      if (top > skyTop) skyTop = top;
    }
  }
  // Por abajo solo se muestra un poco mas que el terreno: un cuerpo mas hundido se marca en el borde.
  const span = skyTop - terrainMin;
  const minElevation = terrainMin - Math.max(span * 0.12, 0.5);
  const maxElevation = skyTop + span * 0.08;

  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const bottom = height - MARGIN.bottom;
  const pxPerAzimuthDeg = (right - left) / 360;
  const pxPerElevationDeg = (bottom - top) / (maxElevation - minElevation);

  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    minElevation,
    maxElevation,
    x: (azimuth) => left + azimuth * pxPerAzimuthDeg,
    y: (elevation) => bottom - (elevation - minElevation) * pxPerElevationDeg,
    azimuthAt: (x) => Math.min(360, Math.max(0, (x - left) / pxPerAzimuthDeg)),
    exaggeration: pxPerElevationDeg / pxPerAzimuthDeg,
  };
}

/** Radio del disco en pixeles: su tamano angular en la escala vertical (la exagerada). */
export function discRadius(id: BodyId, scale: PanoramaScale): number {
  const radius = BODIES[id].angularRadiusDeg * (scale.y(0) - scale.y(1));
  return Math.max(radius, MIN_DISC_RADIUS_PX);
}

/** Marcas redondas del eje de elevacion (grados). */
export function elevationTicks(scale: PanoramaScale): number[] {
  const span = scale.maxElevation - scale.minElevation;
  const step = TICK_STEPS.find((s) => span / s <= MAX_TICKS) ?? 90;
  const ticks: number[] = [];
  for (let tick = Math.ceil(scale.minElevation / step) * step; tick <= scale.maxElevation; tick += step) {
    ticks.push(Number(tick.toFixed(2)));
  }
  return ticks;
}

const point = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** Linea de la cresta del terreno, de azimut 0 a 360 (el ultimo punto repite el primero). */
export function terrainLinePath(horizon: HorizonProfile, scale: PanoramaScale): string {
  const { elevations, stepDeg } = horizon;
  if (elevations.length === 0) return '';
  const points = elevations.map((elevation, i) => point(scale.x(i * stepDeg), scale.y(elevation)));
  points.push(point(scale.x(360), scale.y(elevations[0])));
  return `M${points.join('L')}`;
}

/** Silueta rellena: la cresta cerrada por el borde inferior. */
export function terrainAreaPath(horizon: HorizonProfile, scale: PanoramaScale): string {
  const line = terrainLinePath(horizon, scale);
  if (line === '') return '';
  return `${line}L${point(scale.right, scale.bottom)}L${point(scale.left, scale.bottom)}Z`;
}

/**
 * Recorrido de un cuerpo en la ventana. Devuelve un solo path con un tramo por cada vuelta:
 * al cruzar el norte (359 -> 0) el trazo sale por un borde y entra por el otro.
 */
export function trackPath(samples: EphemerisSample[], id: BodyId, scale: PanoramaScale): string {
  const segments: string[][] = [];
  let current: string[] = [];
  let previous: { azimuth: number; elevation: number } | null = null;

  for (const sample of samples) {
    const { azimuth, elevation } = sample[id];
    if (previous && Math.abs(azimuth - previous.azimuth) > 180) {
      // Cruce del norte: se corta en el borde con la elevacion interpolada.
      const forward = azimuth < previous.azimuth;
      const unwrapped = forward ? azimuth + 360 : azimuth - 360;
      const edge = forward ? 360 : 0;
      const weight = (edge - previous.azimuth) / (unwrapped - previous.azimuth);
      const edgeElevation = previous.elevation + (elevation - previous.elevation) * weight;
      current.push(point(scale.x(edge), scale.y(edgeElevation)));
      segments.push(current);
      current = [point(scale.x(360 - edge), scale.y(edgeElevation))];
    }
    current.push(point(scale.x(azimuth), scale.y(elevation)));
    previous = { azimuth, elevation };
  }
  segments.push(current);

  return segments
    .filter((segment) => segment.length > 1)
    .map((segment) => `M${segment.join('L')}`)
    .join('');
}
