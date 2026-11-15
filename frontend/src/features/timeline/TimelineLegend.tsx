import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import { BodySwatch } from '../../shared/ui/BodySwatch';
import { BandKey } from './BandKey';
import { BAND_LABEL, BAND_STATES } from './bandStyle';

interface Props {
  className?: string;
}

/** Leyenda: que linea es cada cuerpo y que significa el relleno de las bandas. Va sobre fondo oscuro. */
export function TimelineLegend({ className = '' }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-200 ${className}`}>
      <ul aria-label="Bodies" className="flex items-center gap-x-3">
        {BODY_IDS.map((id) => (
          <li key={id} className="flex items-center gap-1.5">
            <BodySwatch body={id} className="size-4" />
            {BODIES[id].label}
          </li>
        ))}
      </ul>
      <ul aria-label="Visibility" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {BAND_STATES.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <BandKey state={state} />
            {BAND_LABEL[state]}
          </li>
        ))}
      </ul>
    </div>
  );
}
