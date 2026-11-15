import { compassPoint, formatDegrees } from '../../shared/lib/angles';
import { BODIES, type BodyId } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import type { BodyPosition } from '../../shared/types/lunar';
import { BodySwatch } from '../../shared/ui/BodySwatch';
import { ChartTooltip } from '../../shared/ui/ChartTooltip';
import { describeMargin, describePosition, visibilityWord } from './bodyStatus';
import type { PanoramaScale } from './panoramaScale';

/** Que hay bajo el cursor: el terreno en una direccion, o un cuerpo (ahora o en otro instante del recorrido). */
export type PanoramaTarget =
  | { kind: 'ground'; azimuth: number; terrain: number }
  /** `time` = instante del recorrido; null = el disco del instante que se muestra. */
  | { kind: 'body'; body: BodyId; position: BodyPosition; time: string | null };

interface Props {
  target: PanoramaTarget;
  /** Punto de anclaje en px del SVG. */
  x: number;
  y: number;
  scale: PanoramaScale;
}

/** Tarjeta del cursor en el panorama. Se abre hacia el lado con mas espacio. */
export function PanoramaTooltip({ target, x, y, scale }: Props) {
  const flipX = x > (scale.left + scale.right) / 2;
  const flipY = y > (scale.top + scale.bottom) / 2;

  return (
    <ChartTooltip x={x} y={y} flipX={flipX} flipY={flipY}>
      {target.kind === 'ground' ? (
        <>
          <p>
            {formatDegrees(target.azimuth, 0)} {compassPoint(target.azimuth)}
          </p>
          <p className="text-slate-400">terreno a {formatDegrees(target.terrain)}</p>
        </>
      ) : (
        <>
          <p className="flex items-center gap-1.5">
            <BodySwatch body={target.body} className="size-3.5" />
            <span className="font-semibold">{BODIES[target.body].label}</span>
            <span className="text-slate-300">{visibilityWord(target.position)}</span>
          </p>
          {target.time && <p className="text-slate-300">{formatUtcDateTime(target.time)} UTC</p>}
          <p>{describeMargin(target.position)}</p>
          <p className="text-slate-400">{describePosition(target.position)}</p>
          {target.time && <p className="mt-1 text-slate-400">Clic para ver este momento</p>}
        </>
      )}
    </ChartTooltip>
  );
}
