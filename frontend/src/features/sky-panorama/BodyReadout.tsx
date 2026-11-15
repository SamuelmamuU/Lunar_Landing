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
 * Estado de un cuerpo para el panel oscuro: nombre, veredicto (con el mismo trazo que su enlace en la vista
 * desde arriba), el margen sobre el terreno y la posicion.
 *
 * Siempre 4 lineas que no se parten: este panel decide el alto del bento, y si cambiara al mover el instante
 * ("parcialmente visible" no cabia junto al nombre) todo lo de abajo brincaba al arrastrar la linea de tiempo.
 */
export function BodyReadout({ body, position }: Props) {
  return (
    <li className="whitespace-nowrap">
      <p className="flex items-center gap-2 font-semibold text-slate-50">
        <BodySwatch body={body} />
        {BODIES[body].label}
      </p>
      <p className="flex items-center gap-1.5 text-sm text-slate-100">
        <LinkKey state={linkState(position)} />
        {visibilityWord(position)}
      </p>
      <p className="text-sm text-slate-300">{describeMargin(position)}</p>
      <p className="text-xs text-slate-400">{describePosition(position)}</p>
    </li>
  );
}
