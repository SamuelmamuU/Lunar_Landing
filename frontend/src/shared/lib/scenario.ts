// Ventana de tiempo de un escenario: opciones, validaciones y armado de la peticion (sin React).

import type { EphemerisRequest, Scenario } from '../types/lunar';
import { addDays, dateTimeInputToIso } from './dates';

/** Duraciones que ofrece el formulario, en dias. 30 cubre un dia lunar completo (~29.5 dias). */
export const DURATION_OPTIONS = [1, 7, 14, 30] as const;

const MIN_YEAR = 1950;
const MAX_YEAR = 2100;

/** Mensaje de error para el inicio (valor de datetime-local), o null si es valido. */
export function validateStart(raw: string): string | null {
  if (raw.trim() === '') return 'Elige una fecha de inicio.';
  const iso = dateTimeInputToIso(raw);
  if (iso === null) return 'La fecha no es valida.';
  const year = new Date(iso).getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) return `Usa una fecha entre ${MIN_YEAR} y ${MAX_YEAR}.`;
  return null;
}

/** Escenario -> peticion de efemerides. */
export function scenarioToRequest(scenario: Scenario): EphemerisRequest {
  const { site, start, durationDays, stepMinutes } = scenario;
  return {
    lat: site.lat,
    lon: site.lon,
    start,
    end: addDays(start, durationDays),
    stepMinutes,
    // Los sitios personalizados no existen en el catalogo del backend.
    ...(site.category === 'custom' ? {} : { siteId: site.id }),
  };
}
