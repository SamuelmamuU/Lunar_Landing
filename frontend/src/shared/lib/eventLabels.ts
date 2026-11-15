// Textos de los eventos de salida y puesta (sin React). Los usan metricas y la linea de tiempo.

import type { BodyId } from './bodies';
import type { NextEvents, SkyEventType } from '../types/lunar';

export type NextEventType = NextEvents['sunEvent'] | NextEvents['earthEvent'];

/** 'sunset' -> "Puesta de Sol". null = no hay cambio en los proximos 60 dias. */
export function eventLabel(event: SkyEventType | null): string | null {
  switch (event) {
    case 'sunset':
      return 'Sunset';
    case 'sunrise':
      return 'Sunrise';
    case 'earthset':
      return 'Earthset';
    case 'earthrise':
      return 'Earthrise';
    default:
      return null;
  }
}

/** A que cuerpo pertenece un evento. */
export function eventBody(event: SkyEventType): BodyId {
  return event === 'sunrise' || event === 'sunset' ? 'sun' : 'earth';
}

/** true si el cuerpo aparece (salida); false si se oculta (puesta). */
export function isRiseEvent(event: SkyEventType): boolean {
  return event === 'sunrise' || event === 'earthrise';
}
