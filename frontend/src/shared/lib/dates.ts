// Fechas en UTC (sin React). Toda la app trabaja en UTC: el input se interpreta como UTC, no como hora local.

const DAY_MS = 86_400_000;

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

/** "6 mar 2025" */
export function formatUtcDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** "6 mar 2025, 17:28" (UTC) */
export function formatUtcDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** ISO -> valor de <input type="datetime-local"> en UTC: "2025-03-06T17:28". */
export function isoToDateTimeInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (leido como UTC) -> ISO, o null si no es valido. */
export function dateTimeInputToIso(raw: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s = '0'] = match;
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const date = new Date(ms);
  // Rechaza fechas que Date "corrige" en silencio (31 de febrero -> 3 de marzo).
  if (date.getUTCMonth() !== +mo - 1 || date.getUTCDate() !== +d) return null;
  return date.toISOString();
}

/** Suma dias a un ISO. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

/** true si dos ISO caen en el mismo minuto (ignora segundos). */
export function sameMinute(a: string, b: string): boolean {
  return Math.floor(Date.parse(a) / 60_000) === Math.floor(Date.parse(b) / 60_000);
}
