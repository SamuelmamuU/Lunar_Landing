import { formatDegrees } from '../../shared/lib/angles';
import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { linkState } from '../../shared/lib/visibility';
import type { EphemerisSample } from '../../shared/types/lunar';
import { BodySwatch } from '../../shared/ui/BodySwatch';
import { ChartTooltip } from '../../shared/ui/ChartTooltip';
import { BAND_LABEL } from './bandStyle';
import { offsetLabel, type TimelineScale } from './timelineScale';

interface Props {
  sample: EphemerisSample;
  /** Posicion del cursor en px dentro del contenedor. */
  x: number;
  scale: TimelineScale;
}

/** Datos bajo el cursor: fecha, tiempo desde el inicio y elevacion y estado de cada cuerpo. */
export function TimelineTooltip({ sample, x, scale }: Props) {
  return (
    // Arriba de la grafica; se abre hacia el lado con mas espacio.
    <ChartTooltip x={x} y={scale.top - 12} flipX={x > (scale.left + scale.right) / 2}>
      <p>{formatUtcDateTime(sample.time)} UTC</p>
      <p className="text-slate-400">{offsetLabel(sample.time, scale.startMs)}</p>
      <ul className="mt-1 space-y-0.5">
        {BODY_IDS.map((id) => (
          <li key={id} className="flex items-center gap-1.5">
            <BodySwatch body={id} className="size-3.5" />
            {BODIES[id].label} {formatDegrees(sample[id].elevation)},{' '}
            <span className="text-slate-300">{BAND_LABEL[linkState(sample[id])].toLowerCase()}</span>
          </li>
        ))}
      </ul>
    </ChartTooltip>
  );
}
