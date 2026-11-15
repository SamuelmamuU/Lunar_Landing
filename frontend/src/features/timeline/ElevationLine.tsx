import { useMemo } from 'react';
import { BODIES, type BodyId } from '../../shared/lib/bodies';
import type { EphemerisSample } from '../../shared/types/lunar';
import { HIDDEN_DASH } from './bandStyle';
import { elevationPath, type TimelineScale } from './timelineScale';

interface Props {
  body: BodyId;
  samples: EphemerisSample[];
  scale: TimelineScale;
}

/** Elevacion de un cuerpo en la ventana: continua donde se ve, punteada y tenue donde la tapa el terreno. */
export function ElevationLine({ body, samples, scale }: Props) {
  const all = useMemo(() => elevationPath(samples, body, scale), [samples, body, scale]);
  const visible = useMemo(() => elevationPath(samples, body, scale, true), [samples, body, scale]);
  const color = BODIES[body].color;

  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d={all} stroke={color} strokeWidth={1.5} strokeDasharray={HIDDEN_DASH} opacity={0.55} />
      <path d={visible} stroke={color} strokeWidth={2} />
    </g>
  );
}
