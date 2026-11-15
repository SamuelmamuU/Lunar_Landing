// Estado de la linea de vista de un cuerpo en un instante (sin React). Solo clasifica lo que ya
// calculo backend (`visible`, `visibleFraction` y la elevacion del terreno); no recalcula posiciones.

import type { BodyPosition } from '../types/lunar';

/** Margen para considerar "despejado" un cuerpo (contrato, seccion 2): el mismo que usa backend. */
export const CLEAR_MARGIN_DEG = 0.5;

/**
 * clear    = visible con margen de al menos CLEAR_MARGIN_DEG (y el disco completo).
 * marginal = visible, pero por poco: menos margen o el Sol asoma solo en parte.
 * blocked  = no visible: el terreno (o el horizonte) lo tapa.
 */
export type LinkState = 'clear' | 'marginal' | 'blocked';

/** Grados del cuerpo sobre el terreno en su azimut (negativo = por debajo). */
export function clearance(position: BodyPosition): number {
  return position.elevation - position.horizonElevation;
}

export function linkState(position: BodyPosition): LinkState {
  if (!position.visible) return 'blocked';
  if (position.visibleFraction < 1 || clearance(position) < CLEAR_MARGIN_DEG) return 'marginal';
  return 'clear';
}
