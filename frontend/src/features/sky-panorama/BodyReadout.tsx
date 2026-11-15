import { BODIES, type BodyId } from '../../shared/lib/bodies';
import type { BodyPosition } from '../../shared/types/lunar';
import { BodySwatch } from '../../shared/ui/BodySwatch';
import { describePosition, describeVisibility } from './bodyStatus';

interface Props {
  body: BodyId;
  position: BodyPosition;
}

/** Linea de texto de un cuerpo: "Sol: 1.6° sobre el terreno, visible". Tambien hace de leyenda. */
export function BodyReadout({ body, position }: Props) {
  return (
    <li>
      <span className="flex items-baseline gap-2 text-slate-900">
        <BodySwatch body={body} className="size-2.5 translate-y-px" />
        <span>
          <span className="font-semibold">{BODIES[body].label}:</span> {describeVisibility(position)}
        </span>
      </span>
      <span className="block pl-4.5 text-sm text-slate-500">{describePosition(position)}</span>
    </li>
  );
}
