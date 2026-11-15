// Formato de angulos para la UI (sin React).

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO',
] as const;

/** "1.6°". Evita el "-0.0°". */
export function formatDegrees(value: number, digits = 1): string {
  const text = value.toFixed(digits);
  return `${Number(text) === 0 ? text.replace('-', '') : text}°`;
}

/** Azimut (0 = norte, sentido horario) -> rumbo de 16 puntos en espanol: 66 -> "ENE". */
export function compassPoint(azimuth: number): string {
  const normalized = ((azimuth % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / 22.5) % 16];
}
