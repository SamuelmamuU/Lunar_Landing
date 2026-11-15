import { BODIES } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { eventBody, eventLabel } from '../../shared/lib/eventLabels';
import type { SkyEvent } from '../../shared/types/lunar';
import { BodySwatch } from '../../shared/ui/BodySwatch';
import { Button } from '../../shared/ui/Button';
import { offsetLabel } from './timelineScale';

interface Props {
  events: SkyEvent[];
  startMs: number;
  /** Lleva el instante al evento. */
  onSelect: (event: SkyEvent) => void;
}

/**
 * Salidas y puestas en texto: la vista de tabla de las marcas de la grafica, y un atajo para llevar el
 * panorama justo a ese momento.
 */
export function EventList({ events, startMs, onSelect }: Props) {
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
        Salidas y puestas en la ventana ({events.length})
      </summary>
      {events.length === 0 ? (
        <p className="mt-2 text-slate-600">Ni el Sol ni la Tierra salen o se ocultan en esta ventana.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {events.map((event) => {
            const label = eventLabel(event.type) ?? event.type;
            const date = `${formatUtcDateTime(event.time)} UTC`;
            return (
              <li key={`${event.type}-${event.time}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <BodySwatch body={eventBody(event.type)} className="size-4" />
                <span className="text-slate-900">{label}</span>
                <span className="text-slate-500 tabular-nums">
                  {date}, {offsetLabel(event.time, startMs)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => onSelect(event)}
                  aria-label={`Ver ${label.toLowerCase()} (${BODIES[eventBody(event.type)].label}) del ${date} en el panorama`}
                >
                  Ver en el panorama
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
