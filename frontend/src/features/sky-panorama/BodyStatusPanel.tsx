import { BODY_IDS } from '../../shared/lib/bodies';
import type { EphemerisSample } from '../../shared/types/lunar';
import { BodyReadout } from './BodyReadout';
import { LinkLegend } from './LinkLegend';

interface Props {
  current: EphemerisSample;
  className?: string;
}

/** Panel de datos del bento: estado del Sol y de la Tierra arriba y la leyenda de enlaces al pie. */
export function BodyStatusPanel({ current, className = '' }: Props) {
  return (
    <div className={`flex flex-col justify-between gap-3 rounded-lg bg-slate-950 p-3 ${className}`}>
      <ul className="space-y-2.5">
        {BODY_IDS.map((id) => (
          <BodyReadout key={id} body={id} position={current[id]} />
        ))}
      </ul>
      <LinkLegend />
    </div>
  );
}
