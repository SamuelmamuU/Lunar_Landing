import { BODIES, type BodyId } from '../lib/bodies';

interface Props {
  body: BodyId;
  className?: string;
}

/** Punto con el color fijo de Sol o Tierra, para leyendas. Decorativo: siempre va junto al nombre. */
export function BodySwatch({ body, className = 'size-2.5' }: Props) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="5" cy="5" r="5" fill={BODIES[body].color} />
    </svg>
  );
}
