import { useId } from 'react';
import type { NextEvents as NextEventsData } from '../../shared/types/lunar';
import { NextEventItem } from './NextEventItem';

interface Props {
  next: NextEventsData;
}

/** Proximo cambio del Sol y de la Tierra desde el inicio de la ventana. */
export function NextEvents({ next }: Props) {
  // id unico: en el comparador puede haber varios paneles en la misma pagina.
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="mb-3 text-lg font-semibold text-slate-900">
        Próximos eventos
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NextEventItem title="Sol" event={next.sunEvent} time={next.sunEventTime} hours={next.hoursToSunEvent} />
        <NextEventItem
          title="Tierra"
          event={next.earthEvent}
          time={next.earthEventTime}
          hours={next.hoursToEarthEvent}
        />
      </div>
    </section>
  );
}
