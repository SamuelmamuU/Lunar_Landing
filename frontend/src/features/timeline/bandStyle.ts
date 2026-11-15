// Como se ve cada estado de visibilidad en las bandas de la linea de tiempo. La banda va en el color fijo del
// cuerpo y el estado se lee por el relleno, no por el color: lleno = despejado, rayado = por poco,
// vacio = tapado (ademas su linea de elevacion pasa a punteada). Asi no se gastan verde/ambar/rojo, que son
// del semaforo.

import type { LinkState } from '../../shared/lib/visibility';

export const BAND_LABEL: Record<LinkState, string> = {
  clear: 'Despejado',
  marginal: 'Visible por poco',
  blocked: 'Tapado',
};

/** Orden fijo para la leyenda. */
export const BAND_STATES: LinkState[] = ['clear', 'marginal', 'blocked'];

/** Patron de las lineas punteadas (cuerpo tapado). */
export const HIDDEN_DASH = '2 4';
