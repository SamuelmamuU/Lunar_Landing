import type { BodyId } from '../lib/bodies';
import { BodyIcon } from './BodyIcon';

interface Props {
  body: BodyId;
  className?: string;
}

// Tamanos igualados a ojo (en la leyenda el tamano no significa nada): el Sol con rayos llena el recuadro y el
// globo de la Tierra es un poco mayor que el circulo del Sol, asi los dos pesan parecido y los nombres se alinean.
const VIEW_SIZE = 24;
const DISC_RADIUS = { sun: 6, earth: 9 } as const;

/**
 * Icono de Sol o Tierra con su color fijo, para leyendas. Decorativo: siempre va junto al nombre.
 * La forma (rayos o globo) distingue a los cuerpos aunque no se distinga el color.
 */
export function BodySwatch({ body, className = 'size-5' }: Props) {
  return (
    <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} aria-hidden="true" className={`shrink-0 ${className}`}>
      <BodyIcon body={body} cx={VIEW_SIZE / 2} cy={VIEW_SIZE / 2} radius={DISC_RADIUS[body]} halo={false} />
    </svg>
  );
}
