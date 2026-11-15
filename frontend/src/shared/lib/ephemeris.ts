// Lectura de efemerides ya calculadas por backend (sin React). Aqui no se recalcula nada.

import type { EphemerisSample, HorizonProfile } from '../types/lunar';

/** Muestra mas cercana a un instante (ISO). Las muestras van a paso fijo desde el inicio. */
export function sampleAt(samples: EphemerisSample[], time: string): EphemerisSample | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) return samples[0];
  const first = Date.parse(samples[0].time);
  const step = Date.parse(samples[1].time) - first;
  const index = Math.round((Date.parse(time) - first) / step);
  return samples[Math.min(samples.length - 1, Math.max(0, index))];
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
