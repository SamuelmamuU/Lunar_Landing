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

/**
 * Mensaje de error para el fin (valor de datetime-local) dado el inicio (ISO), o null si es valido.
 * El fin define la duracion: debe quedar despues del inicio y dentro de MAX_DURATION_DAYS.
 */
export function validateEnd(raw: string, startIso: string): string | null {
  if (raw.trim() === '') return 'Elige una fecha de fin.';
  const iso = dateTimeInputToIso(raw);
  if (iso === null) return 'La fecha no es válida.';
  const minutes = minutesBetween(startIso, iso);
  if (minutes <= 0) return 'El fin debe ser después del inicio.';
  if (minutes < MIN_DURATION_MINUTES) return 'La ventana debe durar al menos 1 hora.';
  if (minutes > MAX_DURATION_DAYS * MINUTES_PER_DAY) return `La ventana puede durar hasta ${MAX_DURATION_DAYS} días.`;
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
