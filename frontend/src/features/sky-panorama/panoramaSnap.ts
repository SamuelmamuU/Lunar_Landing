// "Iman" del cursor en el panorama (sin React): si el cursor esta cerca del disco del Sol o de la Tierra, o de
// un punto visible de su recorrido, se pega ahi para mostrar sus datos.

import { BODY_IDS, type BodyId } from '../../shared/lib/bodies';
import type { EphemerisSample } from '../../shared/types/lunar';
import { discRadius, type PanoramaScale } from './panoramaScale';

/** Distancia (px) a la que el cursor se pega. Para un disco se mide desde su borde. */
export const SNAP_PX = 16;

/** Un punto del recorrido en pixeles: la muestra `index` de un cuerpo. */
export interface TrackPoint {
  body: BodyId;
  index: number;
  time: string;
  x: number;
  y: number;
}

export type Snap =
  /** El disco del instante que se muestra. */
  | { kind: 'disc'; body: BodyId; x: number; y: number }
  /** Otro instante del recorrido: un clic lleva el panorama ahi. */
  | { kind: 'track'; body: BodyId; index: number; x: number; y: number };

/**
 * Puntos del recorrido a los que se puede pegar el cursor. Solo los visibles (segun backend): los que quedan
 * detras del terreno no se ven y pegarse a ellos confunde.
 */
export function trackPoints(samples: EphemerisSample[], scale: PanoramaScale): TrackPoint[] {
  const points: TrackPoint[] = [];
  samples.forEach((sample, index) => {
    for (const body of BODY_IDS) {
      const { azimuth, elevation, visible } = sample[body];
      const y = scale.y(elevation);
      if (!visible || y < scale.top || y > scale.bottom) continue;
      points.push({ body, index, time: sample.time, x: scale.x(azimuth), y });
    }
  });
  return points;
}

/**
 * A que se pega el cursor en (x, y), o null si no hay nada a menos de SNAP_PX. Los discos ganan: dentro de
 * un disco siempre se elige el disco, y a igual distancia tambien.
 */
export function findSnap(
  x: number,
  y: number,
  current: EphemerisSample,
  points: TrackPoint[],
  scale: PanoramaScale,
): Snap | null {
  let best: Snap | null = null;
  let bestDistance = SNAP_PX;
  const width = scale.right - scale.left;

  for (const body of BODY_IDS) {
    const cy = scale.y(current[body].elevation);
    const radius = discRadius(body, scale);
    // Cerca del norte el disco asoma tambien por el borde opuesto (igual que en BodyDisc).
    const center = scale.x(current[body].azimuth);
    for (const cx of [center, center - width, center + width]) {
      const distance = Math.max(0, Math.hypot(x - cx, y - cy) - radius);
      if (distance <= bestDistance) {
        best = { kind: 'disc', body, x: cx, y: cy };
        bestDistance = distance;
      }
    }
  }
  if (best && bestDistance === 0) return best;

  for (const point of points) {
    // El punto del instante actual es el disco: ya se reviso arriba.
    if (point.time === current.time) continue;
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < bestDistance) {
      best = { kind: 'track', body: point.body, index: point.index, x: point.x, y: point.y };
      bestDistance = distance;
    }
  }
  return best;
}
