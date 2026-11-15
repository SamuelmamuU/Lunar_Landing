import { formatDegrees } from '../../shared/lib/angles';
import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import { elevationTicks, timeTicks, type TimelineScale } from './timelineScale';

interface Props {
  scale: TimelineScale;
}

/** Rejilla y rotulos: elevacion a la izquierda, tiempo desde el inicio abajo y el nombre de cada banda. */
export function TimelineAxes({ scale }: Props) {
  const ticks = elevationTicks(scale);
  const digits = ticks.some((tick) => !Number.isInteger(tick)) ? 1 : 0;

  return (
    <g className="text-[11px] tabular-nums">
      <text x={scale.left} y={12} className="fill-slate-400">
        Elevación sobre el horizonte plano
      </text>

      {ticks.map((tick) => (
        <g key={tick}>
          {/* El 0 es el horizonte plano (sin relieve): va mas marcado que el resto, como en el panorama. */}
          <line
            x1={scale.left}
            x2={scale.right}
            y1={scale.y(tick)}
            y2={scale.y(tick)}
            className={tick === 0 ? 'stroke-slate-500' : 'stroke-slate-800'}
          />
          <text x={scale.left - 8} y={scale.y(tick) + 4} textAnchor="end" className="fill-slate-400">
            {formatDegrees(tick, digits)}
          </text>
        </g>
      ))}

      {timeTicks(scale).map((tick, i, all) => (
        <g key={tick.ms}>
          <line
            x1={scale.x(tick.ms)}
            x2={scale.x(tick.ms)}
            y1={scale.top}
            y2={scale.bandsBottom}
            className="stroke-slate-800"
          />
          <text
            x={scale.x(tick.ms)}
            y={scale.bandsBottom + 18}
            // El primero y el ultimo se alinean hacia dentro para no salirse del SVG.
            textAnchor={i === 0 ? 'start' : i === all.length - 1 && tick.ms >= scale.endMs ? 'end' : 'middle'}
            className="fill-slate-400"
          >
            {tick.label}
          </text>
        </g>
      ))}

      {BODY_IDS.map((id) => (
        <text
          key={id}
          x={scale.left - 8}
          y={scale.bandY[id] + scale.bandHeight - 1}
          textAnchor="end"
          className="fill-slate-200"
        >
          {BODIES[id].label}
        </text>
      ))}
    </g>
  );
}
