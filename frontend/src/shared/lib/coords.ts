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
  if (raw.trim() === '') return 'Escribe una latitud.';
  const value = parseCoordinate(raw);
  if (value === null) return 'La latitud debe ser un numero, por ejemplo -89.45.';
  if (value < LAT_MIN || value > LAT_MAX) return 'La latitud va de -90 (polo sur) a 90 (polo norte).';
  return null;
}

/** Mensaje de error para la longitud, o null si es valida. */
export function validateLon(raw: string): string | null {
  if (raw.trim() === '') return 'Escribe una longitud.';
  const value = parseCoordinate(raw);
  if (value === null) return 'La longitud debe ser un numero, por ejemplo -137.3.';
  if (value < LON_MIN || value > LON_MAX) return 'La longitud va de -180 a 180 (este positivo).';
  return null;
}

/** -89.45 -> "89.45° S" */
export function formatLat(lat: number, digits = 2): string {
  const hemi = lat < 0 ? 'S' : 'N';
  return `${Math.abs(lat).toFixed(digits)}° ${hemi}`;
}

/** -137.3 -> "137.30° O" (oeste), 32.3 -> "32.30° E" */
export function formatLon(lon: number, digits = 2): string {
  const hemi = lon < 0 ? 'O' : 'E';
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
  'south-pole': 'Polo sur',
  'far-side': 'Lado oculto',
  'near-side': 'Lado visible',
};
