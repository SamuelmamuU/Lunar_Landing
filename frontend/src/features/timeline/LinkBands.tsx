import { BODIES, BODY_IDS, type BodyId } from '../../shared/lib/bodies';
import type { LinkRun, TimelineScale } from './timelineScale';

interface Props {
  runs: Record<BodyId, LinkRun[]>;
  scale: TimelineScale;
  /** Prefijo unico para los id de los patrones rayados. */
  patternId: string;
}

/**
 * Una banda por cuerpo, en su color: llena donde esta despejado, rayada donde se ve por poco y vacia donde lo
 * tapa el terreno.
 */
export function LinkBands({ runs, scale, patternId }: Props) {
  return (
    <g>
      <defs>
        {BODY_IDS.map((id) => (
          <pattern
            key={id}
            id={`${patternId}-${id}`}
            width={4}
            height={4}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={2} height={4} fill={BODIES[id].color} />
          </pattern>
        ))}
      </defs>

      {BODY_IDS.map((id) => (
        <g key={id}>
          <rect
            x={scale.left}
            y={scale.bandY[id]}
            width={scale.right - scale.left}
            height={scale.bandHeight}
            rx={2}
            className="fill-slate-900"
          />
          {runs[id]
            .filter((run) => run.state !== 'blocked')
            .map((run) => (
              <rect
                key={run.startMs}
                x={scale.x(run.startMs)}
                y={scale.bandY[id]}
                // Un tramo de una sola muestra en una ventana larga mediria menos de un pixel.
                width={Math.max(1, scale.x(run.endMs) - scale.x(run.startMs))}
                height={scale.bandHeight}
                rx={2}
                fill={run.state === 'clear' ? BODIES[id].color : `url(#${patternId}-${id})`}
              />
            ))}
        </g>
      ))}
    </g>
  );
}
