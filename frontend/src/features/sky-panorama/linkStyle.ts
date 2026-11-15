// Como se dibuja cada estado del enlace sitio-cuerpo. Verde, ambar y rojo son colores de estado
// (reservados para el semaforo); nunca van solos: cada estado tiene ademas su patron de linea y su texto.

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
  clear: { label: 'Despejado', strokeClass: 'stroke-green-500' },
  marginal: { label: 'Por poco (menos de 0.5° de margen)', strokeClass: 'stroke-amber-400', dashArray: '6 4' },
  blocked: { label: 'Tapado por el terreno', strokeClass: 'stroke-red-500', dashArray: '1.5 5' },
};

/** Orden fijo para la leyenda. */
export const LINK_STATES: LinkState[] = ['clear', 'marginal', 'blocked'];
