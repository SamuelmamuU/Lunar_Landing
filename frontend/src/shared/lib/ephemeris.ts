// Lectura de efemerides ya calculadas por backend (sin React). Aqui no se recalcula nada.

import type { EphemerisSample, HorizonProfile } from '../types/lunar';

/** Indice de la muestra mas cercana a un instante (ISO); -1 si no hay muestras. Van a paso fijo desde el inicio. */
export function sampleIndexAt(samples: EphemerisSample[], time: string): number {
  if (samples.length <= 1) return samples.length - 1;
  const first = Date.parse(samples[0].time);
  const step = Date.parse(samples[1].time) - first;
  const index = Math.round((Date.parse(time) - first) / step);
  return Math.min(samples.length - 1, Math.max(0, index));
}

/** Muestra mas cercana a un instante (ISO). */
export function sampleAt(samples: EphemerisSample[], time: string): EphemerisSample | null {
  const index = sampleIndexAt(samples, time);
  return index < 0 ? null : samples[index];
}

/**
 * Elevacion del terreno en un azimut cualquiera, interpolando entre muestras del perfil.
 * Funciona con cualquier stepDeg (1, 0.25...): no asume 360 valores.
 */
export function horizonAt(horizon: HorizonProfile, azimuth: number): number {
  const { elevations, stepDeg } = horizon;
  const count = elevations.length;
  if (count === 0) return 0;
  const position = (((azimuth % 360) + 360) % 360) / stepDeg;
  const low = Math.floor(position) % count;
  const high = (low + 1) % count;
  const weight = position - Math.floor(position);
  return elevations[low] + (elevations[high] - elevations[low]) * weight;
}
