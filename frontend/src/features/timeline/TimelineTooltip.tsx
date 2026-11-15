import { formatDegrees } from '../../shared/lib/angles';
import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { linkState } from '../../shared/lib/visibility';
import type { EphemerisSample } from '../../shared/types/lunar';
import { BodySwatch } from '../../shared/ui/BodySwatch';
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
  const onRightHalf = x > (scale.left + scale.right) / 2;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 w-max rounded-md border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-xs text-slate-100 tabular-nums"
      // Se abre hacia el lado con mas espacio para no salirse del panel.
      style={{
        left: x,
        top: scale.top,
        transform: onRightHalf ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
      }}
    >
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
    </div>
  );
}
