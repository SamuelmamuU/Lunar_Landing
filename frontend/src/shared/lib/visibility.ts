// Estado de la linea de vista de un cuerpo en un instante (sin React). Solo clasifica lo que ya
// calculo backend (`visible`, `clear` y la elevacion del terreno); no recalcula nada.

import type { BodyPosition } from '../types/lunar';

/**
 * clear    = despejado segun backend (sun_clear / earth_clear): visible con margen sobre el relieve.
 * marginal = visible, pero sin ese margen (o el Sol asoma solo en parte).
 * blocked  = no visible: el terreno (o el horizonte) lo tapa.
 */
export type LinkState = 'clear' | 'marginal' | 'blocked';

/** Grados del centro del cuerpo sobre el terreno en su azimut (negativo = por debajo). */
export function clearance(position: BodyPosition): number {
  return position.elevation - position.horizonElevation;
}

export function linkState(position: BodyPosition): LinkState {
  if (!position.visible) return 'blocked';
  return position.clear ? 'clear' : 'marginal';
}
