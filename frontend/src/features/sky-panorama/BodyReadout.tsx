import { BODIES, type BodyId } from '../../shared/lib/bodies';
import { linkState } from '../../shared/lib/visibility';
import type { BodyPosition } from '../../shared/types/lunar';
import { BodySwatch } from '../../shared/ui/BodySwatch';
import { LinkKey } from './LinkKey';
import { describeMargin, describePosition, visibilityWord } from './bodyStatus';

interface Props {
  body: BodyId;
  position: BodyPosition;
}

/**
 * Estado de un cuerpo para el panel oscuro: nombre y veredicto (con el mismo trazo que su enlace en la
 * vista desde arriba), el margen sobre el terreno y la posicion.
 */
export function BodyReadout({ body, position }: Props) {
  return (
    <li>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold text-slate-50">
          <BodySwatch body={body} />
          {BODIES[body].label}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-100">
          <LinkKey state={linkState(position)} />
          {visibilityWord(position)}
        </span>
      </div>
      <p className="text-sm text-slate-300">{describeMargin(position)}</p>
      <p className="text-xs text-slate-400">{describePosition(position)}</p>
    </li>
  );
}
