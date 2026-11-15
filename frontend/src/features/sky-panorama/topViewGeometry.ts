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
/** Tamano fijo de los discos: aqui no hay escala angular. */
export const DISC_RADIUS: Record<BodyId, number> = { sun: 7, earth: 9 };

/** Azimut (0 = norte arriba, sentido horario, este a la derecha) y radio -> punto del SVG. */
export function polarToPoint(azimuth: number, radius: number): { x: number; y: number } {
  const radians = (azimuth * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) };
}
