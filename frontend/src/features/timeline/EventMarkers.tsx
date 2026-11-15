import { BODIES } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { eventBody, eventLabel, isRiseEvent } from '../../shared/lib/eventLabels';
import type { SkyEvent } from '../../shared/types/lunar';
import type { TimelineScale } from './timelineScale';

interface Props {
  events: SkyEvent[];
  scale: TimelineScale;
}

const HALF_WIDTH = 5;
const MARK_HEIGHT = 8;

/**
 * Salidas y puestas de backend (precision ~1 s): una linea tenue en el instante exacto y un triangulo arriba
 * en el color del cuerpo, hacia arriba si aparece y hacia abajo si se oculta. El texto va en el <title> y en la
 * lista de eventos debajo de la grafica.
 */
export function EventMarkers({ events, scale }: Props) {
  const tip = scale.top - 3;
  const base = tip - MARK_HEIGHT;

  return (
    <g>
      {events.map((event) => {
        const ms = Date.parse(event.time);
        if (ms < scale.startMs || ms > scale.endMs) return null;
        const x = scale.x(ms);
        const rise = isRiseEvent(event.type);
        const points = rise
          ? `${x - HALF_WIDTH},${tip} ${x + HALF_WIDTH},${tip} ${x},${base}`
          : `${x - HALF_WIDTH},${base} ${x + HALF_WIDTH},${base} ${x},${tip}`;

        return (
          <g key={`${event.type}-${event.time}`}>
            <line
              x1={x}
              x2={x}
              y1={scale.top}
              y2={scale.bandsBottom}
              strokeDasharray="2 3"
              className="stroke-slate-600"
            />
            <polygon points={points} fill={BODIES[eventBody(event.type)].color}>
              <title>{`${eventLabel(event.type)}, ${formatUtcDateTime(event.time)} UTC`}</title>
            </polygon>
          </g>
        );
      })}
    </g>
  );
}
