import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import type { EphemerisSample } from '../../shared/types/lunar';
import type { TimelineScale } from './timelineScale';

interface Props {
  /** Instante que se ve en el panorama. */
  sample: EphemerisSample;
  index: number;
  scale: TimelineScale;
}

// La Tierra se pinta primero para que el punto del Sol quede encima si coinciden.
const DRAW_ORDER = [...BODY_IDS].reverse();

/** Instante elegido: linea vertical clara y un punto sobre la elevacion de cada cuerpo. */
export function TimeCursor({ sample, index, scale }: Props) {
  const x = scale.xAtIndex(index);

  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={scale.top - 2} y2={scale.bandsBottom + 2} strokeWidth={1.5} className="stroke-slate-100" />
      {DRAW_ORDER.map((id) => (
        <circle
          key={id}
          cx={x}
          cy={scale.y(sample[id].elevation)}
          r={4.5}
          fill={BODIES[id].color}
          strokeWidth={2}
          className="stroke-black"
        />
      ))}
    </g>
  );
}
