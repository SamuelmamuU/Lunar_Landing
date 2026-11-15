// Ventana de tiempo de un escenario: opciones, validaciones y armado de la peticion (sin React).

import type { EphemerisRequest, MissionRequest, Scenario } from '../types/lunar';
import { addDays, dateTimeInputToIso } from './dates';

/**
 * Ventana mas larga que se puede pedir, en dias: dos dias lunares (~29.5 dias cada uno). Backend acepta hasta
 * 366, pero a paso de 1 h serian ~8800 muestras: carga lenta y un slider que no se puede mover con precision.
 */
export const MAX_DURATION_DAYS = 60;
/** Ventana mas corta: una muestra de backend (el paso es de 60 min). */
const MIN_DURATION_MINUTES = 60;
const MINUTES_PER_DAY = 1440;

/**
 * Fechas que cubren los datos de orbitas de backend. La orientacion de la Luna (moon_pa_de421) termina a fines de
 * 2050: medido contra backend, el ultimo fin que acepta es el 28 dic 2050 23:59; despues responde 422 con
 * "SPICE(FRAMEDATANOTFOUND)", que nadie entiende. Si backend cambia a DE440, se puede ampliar.
 */
const MIN_YEAR = 1950;
const MAX_YEAR = 2050;
/** Primer y ultimo instante que se pueden pedir (valor de datetime-local). */
export const COVERAGE_START_INPUT = `${MIN_YEAR}-01-01T00:00`;
export const COVERAGE_END_INPUT = `${MAX_YEAR}-12-28T23:59`;
const COVERAGE_END_MS = Date.parse(`${COVERAGE_END_INPUT}:00Z`);
const COVERAGE_MESSAGE = `Use a date between ${MIN_YEAR} and 28 Dec ${MAX_YEAR}: that is what the orbit data covers.`;

/**
 * Mensaje de error para el inicio (valor de datetime-local), o null si es valido. Con la duracion del escenario
 * se revisa tambien que el fin (que se recorre con el inicio) no se salga de los datos.
 */
export function validateStart(raw: string, durationDays = 0): string | null {
  if (raw.trim() === '') return 'Pick a start date.';
  const iso = dateTimeInputToIso(raw);
  if (iso === null) return 'The date is not valid.';
  const year = new Date(iso).getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) return COVERAGE_MESSAGE;
  if (Date.parse(addDays(iso, durationDays)) > COVERAGE_END_MS) {
    return `With this duration the end would go past 28 Dec ${MAX_YEAR}: use an earlier start or shorten the window.`;
  }
  return null;
}

/**
 * Mensaje de error para el fin (valor de datetime-local) dado el inicio (ISO), o null si es valido.
 * El fin define la duracion: debe quedar despues del inicio y dentro de MAX_DURATION_DAYS.
 */
export function validateEnd(raw: string, startIso: string): string | null {
  if (raw.trim() === '') return 'Pick an end date.';
  const iso = dateTimeInputToIso(raw);
  if (iso === null) return 'The date is not valid.';
  const minutes = minutesBetween(startIso, iso);
  if (minutes <= 0) return 'The end must be after the start.';
  if (minutes < MIN_DURATION_MINUTES) return 'The window must last at least 1 hour.';
  if (minutes > MAX_DURATION_DAYS * MINUTES_PER_DAY) return `The window can last up to ${MAX_DURATION_DAYS} days.`;
  if (Date.parse(iso) > COVERAGE_END_MS) return COVERAGE_MESSAGE;
  return null;
}

/**
 * Minutos enteros entre el inicio y el fin, contando el inicio como se ve en el campo (sin segundos). La fecha de
 * alunizaje trae segundos (17:28:50): sin esto, un fin escrito a las 17:28 de una semana despues daria
 * "6 d 23 h" y el campo saltaria a 17:27.
 */
function minutesBetween(startIso: string, endIso: string): number {
  return Math.round(Date.parse(endIso) / 60_000) - Math.floor(Date.parse(startIso) / 60_000);
}

/** Dias entre el inicio y el fin, en minutos enteros (ver minutesBetween). */
export function durationDaysBetween(startIso: string, endIso: string): number {
  return minutesBetween(startIso, endIso) / MINUTES_PER_DAY;
}

/** Fin de la ventana de un escenario (ISO). */
export function scenarioEnd(scenario: Scenario): string {
  return addDays(scenario.start, scenario.durationDays);
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

/** Escenario -> peticion de fechas alternativas: aterriza al inicio de la ventana y sale al final. */
export function scenarioToMissionRequest(scenario: Scenario): MissionRequest {
  const { lat, lon, start, end, siteId } = scenarioToRequest(scenario);
  return { lat, lon, landing: start, departure: end, ...(siteId ? { siteId } : {}) };
}

/**
 * Clave de un escenario: dos escenarios con la misma clave piden exactamente lo mismo a backend (mismo sitio y
 * ventana), aunque tengan distinto id.
 */
export function scenarioKey(scenario: Scenario): string {
  return JSON.stringify(scenarioToRequest(scenario));
}
