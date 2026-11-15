// Funciones puras para coordenadas lunares (sin React).
// Convenciones: lat -90..90 (sur negativo), lon -180..180 (este positivo).

export const LAT_MIN = -90;
export const LAT_MAX = 90;
export const LON_MIN = -180;
export const LON_MAX = 180;

/** Acepta "−89,45", "-89.45", " 12 ". Devuelve null si no es un numero. */
export function parseCoordinate(raw: string): number | null {
  const cleaned = raw.trim().replace(/−/g, '-').replace(',', '.');
  if (cleaned === '' || !/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Mensaje de error para la latitud, o null si es valida. */
export function validateLat(raw: string): string | null {
  if (raw.trim() === '') return 'Enter a latitude.';
  const value = parseCoordinate(raw);
  if (value === null) return 'Latitude must be a number, for example -89.45.';
  if (value < LAT_MIN || value > LAT_MAX) return 'Latitude goes from -90 (south pole) to 90 (north pole).';
  return null;
}

/** Mensaje de error para la longitud, o null si es valida. */
export function validateLon(raw: string): string | null {
  if (raw.trim() === '') return 'Enter a longitude.';
  const value = parseCoordinate(raw);
  if (value === null) return 'Longitude must be a number, for example -137.3.';
  if (value < LON_MIN || value > LON_MAX) return 'Longitude goes from -180 to 180 (east positive).';
  return null;
}

/** -89.45 -> "89.45° S" */
export function formatLat(lat: number, digits = 2): string {
  const hemi = lat < 0 ? 'S' : 'N';
  return `${Math.abs(lat).toFixed(digits)}° ${hemi}`;
}

/** -137.3 -> "137.30° O" (oeste), 32.3 -> "32.30° E" */
export function formatLon(lon: number, digits = 2): string {
  const hemi = lon < 0 ? 'W' : 'E';
  return `${Math.abs(lon).toFixed(digits)}° ${hemi}`;
}

export type LunarRegion = 'south-pole' | 'far-side' | 'near-side';

/**
 * Region aproximada, solo como pista para el usuario.
 * - Polo sur: lat <= -80.
 * - Lado oculto: |lon| > 90 (la Tierra no se ve, salvo cerca del limbo por libracion).
 */
export function lunarRegion(lat: number, lon: number): LunarRegion {
  if (lat <= -80) return 'south-pole';
  if (Math.abs(lon) > 90) return 'far-side';
  return 'near-side';
}

export const REGION_LABEL: Record<LunarRegion, string> = {
  'south-pole': 'South pole',
  'far-side': 'Far side',
  'near-side': 'Near side',
};

/** Que significa la region para Sol y Tierra, en lenguaje simple (para no expertos). */
export const REGION_HINT: Record<LunarRegion, string> = {
  'south-pole': 'the Sun circles just above the horizon.',
  'far-side': 'the Earth is never visible from here.',
  'near-side': 'the Earth is always in the sky; day and night last ~14 days each.',
};

/** "Polo sur: el Sol da vueltas rozando el horizonte." */
export function regionSummary(lat: number, lon: number): string {
  const region = lunarRegion(lat, lon);
  return `${REGION_LABEL[region]}: ${REGION_HINT[region]}`;
}
