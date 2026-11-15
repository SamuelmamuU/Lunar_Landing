// Como se dibuja cada estado del enlace sitio-cuerpo. Verde, ambar y rojo son colores de estado
// (reservados para el semaforo); nunca van solos: cada estado tiene ademas su patron de linea y su texto.
// Pensados para el fondo oscuro del panel (slate-950), donde los tres pasan 3:1 de contraste.

import type { LinkState } from '../../shared/lib/visibility';

interface LinkStyle {
  /** Texto para la leyenda. */
  label: string;
  /** Color del trazo (clase de Tailwind). */
  strokeClass: string;
  /** Patron de la linea: continua, discontinua o punteada. */
  dashArray?: string;
}

export const LINK_STYLE: Record<LinkState, LinkStyle> = {
  clear: { label: 'Clear', strokeClass: 'stroke-green-500' },
  marginal: { label: 'Barely visible (no margin)', strokeClass: 'stroke-amber-400', dashArray: '6 4' },
  blocked: { label: 'Blocked by terrain', strokeClass: 'stroke-red-500', dashArray: '1.5 5' },
};

/** Orden fijo para la leyenda. */
export const LINK_STATES: LinkState[] = ['clear', 'marginal', 'blocked'];
