// Textos de los eventos de salida y puesta (sin React).

import type { NextEvents } from '../../shared/types/lunar';

export type NextEventType = NextEvents['sunEvent'] | NextEvents['earthEvent'];

/** 'sunset' -> "Puesta de Sol". null = no hay cambio en los proximos 60 dias. */
export function eventLabel(event: NextEventType): string | null {
  switch (event) {
    case 'sunset':
      return 'Puesta de Sol';
    case 'sunrise':
      return 'Salida del Sol';
    case 'earthset':
      return 'La Tierra se oculta';
    case 'earthrise':
      return 'La Tierra vuelve a aparecer';
    default:
      return null;
  }
}
