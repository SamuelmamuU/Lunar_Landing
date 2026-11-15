// Geometria de la vista cenital (sin React): el sitio en el centro y Sol y Tierra en orbitas fijas.
// El radio NO codifica nada (ni distancia ni elevacion): solo separa los dos cuerpos. Lo que importa
// es la direccion (azimut) y el estado del enlace con el sitio.

import type { BodyId } from '../../shared/lib/bodies';

export const TOP_VIEW_SIZE = 240;
export const CENTER = TOP_VIEW_SIZE / 2;
/** Radio de los rotulos N/E/S/O. */
export const CARDINAL_RADIUS = 106;
/** Radio del punto del sitio. */
export const SITE_RADIUS = 5;

export const ORBIT_RADIUS: Record<BodyId, number> = { sun: 52, earth: 84 };
/**
 * Radio fijo del disco de cada cuerpo (aqui no hay escala angular). El icono del Sol llega al doble con los
 * rayos (bodyExtent): 5.5 da un Sol de 22 px, parecido a la Tierra de 18.
 */
export const DISC_RADIUS: Record<BodyId, number> = { sun: 5.5, earth: 9 };

/** Azimut (0 = norte arriba, sentido horario, este a la derecha) y radio -> punto del SVG. */
export function polarToPoint(azimuth: number, radius: number): { x: number; y: number } {
  const radians = (azimuth * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) };
}

/** Ancho aproximado de un caracter del rotulo (11 px en fuente monoespaciada ~ 0.6 em, un poco mas por el peso). */
const LABEL_CHAR_WIDTH = 6.8;
/** Separacion minima del rotulo con los bordes del recuadro. */
const EDGE_PADDING = 4;
/** Por encima de esta altura el rotulo chocaria con la N: se pone debajo del disco. */
const TOP_LIMIT = 30;

export interface LabelPlacement {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/**
 * Donde va el rotulo de un cuerpo: al lado del disco (hacia afuera) si cabe dentro del recuadro y no choca
 * con la E o la O; si no, arriba del disco (o debajo, cerca del norte), centrado y sin salirse.
 */
export function labelPlacement(azimuth: number, center: { x: number; y: number }, disc: number, text: string): LabelPlacement {
  const width = text.length * LABEL_CHAR_WIDTH;
  const onRight = center.x >= CENTER;
  const nearSide = Math.abs(Math.sin((azimuth * Math.PI) / 180)) > 0.7;
  const sideX = center.x + (onRight ? disc + 5 : -disc - 5);
  const fitsSide = onRight ? sideX + width <= TOP_VIEW_SIZE - EDGE_PADDING : sideX - width >= EDGE_PADDING;
  if (!nearSide && fitsSide) return { x: sideX, y: center.y + 4, anchor: onRight ? 'start' : 'end' };

  const above = center.y - disc - 6;
  const x = Math.min(TOP_VIEW_SIZE - EDGE_PADDING - width / 2, Math.max(EDGE_PADDING + width / 2, center.x));
  return { x, y: above < TOP_LIMIT ? center.y + disc + 14 : above, anchor: 'middle' };
}
