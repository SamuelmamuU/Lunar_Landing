// Formato de numeros para la UI (sin React): porcentajes y duraciones.

/** 47.25 -> "47.3%", 100 -> "100%". */
export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

/**
 * Horas -> texto corto: 317.47 -> "13 d 5 h", 5.5 -> "5 h 30 min", 0.75 -> "45 min".
 * Con dias se omiten los minutos: a esa escala no aportan.
 */
export function formatDuration(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const days = Math.floor(totalMinutes / 1440);
  const wholeHours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return wholeHours > 0 ? `${days} d ${wholeHours} h` : `${days} d`;
  if (wholeHours > 0) return minutes > 0 ? `${wholeHours} h ${minutes} min` : `${wholeHours} h`;
  return `${minutes} min`;
}

/** Duracion de una ventana en dias -> texto corto: 7 -> "7 d", 9.47 -> "9 d 11 h", 0.5 -> "12 h". */
export function formatDays(days: number): string {
  return formatDuration(days * 24);
}
