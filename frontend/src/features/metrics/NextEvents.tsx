import { useId } from 'react';
import { formatUtcDateTime } from '../../shared/lib/dates';
import type { NextEvents as NextEventsData } from '../../shared/types/lunar';
import { NextEventItem } from './NextEventItem';

interface Props {
  next: NextEventsData;
  /** Inicio de la ventana: backend cuenta los tiempos desde ahi, no desde "ahora". */
  from: string;
}

/** Proximo cambio del Sol y de la Tierra desde el inicio de la ventana. */
export function NextEvents({ next, from }: Props) {
  // id unico: en el comparador puede haber varios paneles en la misma pagina.
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          Upcoming events
        </h2>
        <p className="text-sm text-slate-500">from {formatUtcDateTime(from)} UTC</p>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <NextEventItem body="sun" event={next.sunEvent} time={next.sunEventTime} hours={next.hoursToSunEvent} />
        <NextEventItem
          body="earth"
          event={next.earthEvent}
          time={next.earthEventTime}
          hours={next.hoursToEarthEvent}
        />
      </div>
    </section>
  );
}
