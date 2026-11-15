// Sol y Tierra: nombre, color fijo y tamano angular. Panorama, timeline y comparador importan de aqui.
//
// Los dos colores pasan el validador de la skill dataviz (separacion para daltonismo y contraste >= 3:1)
// tanto sobre el cielo oscuro del panorama (slate-950) como sobre fondo blanco. El Sol va en naranja y no
// en amarillo porque el ambar esta reservado para avisos.

export type BodyId = 'sun' | 'earth';

export interface Body {
  id: BodyId;
  /** Nombre para la UI. */
  label: string;
  /** Color de las marcas (disco, linea). El texto nunca va en este color. */
  color: string;
  /** Radio angular visto desde la Luna, en grados (contrato: Sol ~0.27, Tierra 0.95-0.98). */
  angularRadiusDeg: number;
}

export const BODIES: Record<BodyId, Body> = {
  sun: { id: 'sun', label: 'Sun', color: '#d95926', angularRadiusDeg: 0.27 },
  earth: { id: 'earth', label: 'Earth', color: '#3987e5', angularRadiusDeg: 0.96 },
};

/** Orden fijo para leyendas y listas. */
export const BODY_IDS: BodyId[] = ['sun', 'earth'];

/**
 * Radio total que ocupa el icono de un cuerpo cuyo disco mide `radius`. El disco del icono del Sol es la
 * mitad del icono (los rayos llegan al doble); el de la Tierra lo llena. Sirve para separar rotulos y lineas.
 */
export function bodyExtent(id: BodyId, radius: number): number {
  return id === 'sun' ? radius * 2 : radius;
}
