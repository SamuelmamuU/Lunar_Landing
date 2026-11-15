
import type { NextEvents } from '../../shared/types/lunar';

interface Props {
  next: NextEvents;
}

function getEventLabel(event: NextEvents['sunEvent'] | NextEvents['earthEvent']) {
  switch (event) {
    case 'sunset':
      return 'Puesta de Sol';
    case 'sunrise':
      return 'Salida del Sol';
    case 'earthset':
      return 'La Tierra se oculta';
    case 'earthrise':
      return 'La Tierra vuelve a aparecer';
    default:
      return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatRemaining(hours: number | null) {
  if (hours === null) return null;

  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) return `${minutes} min`;
  if (minutes === 0) return `${wholeHours} h`;

  return `${wholeHours} h ${minutes} min`;
}

interface EventItemProps {
  title: string;
  event: NextEvents['sunEvent'] | NextEvents['earthEvent'];
  time: string | null;
  hours: number | null;
}

function EventItem({ title, event, time, hours }: EventItemProps) {
  const label = getEventLabel(event);
  const date = formatDate(time);
  const remaining = formatRemaining(hours);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{title}</p>

      {label ? (
        <>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {label}
          </p>
          {date && <p className="mt-1 text-sm text-slate-600">{date}</p>}
          {remaining && (
            <p className="mt-2 text-sm font-medium text-slate-700">
              En {remaining}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Sin cambios previstos en los próximos 60 días.
        </p>
      )}
    </article>
  );
}

export function NextEvents({ next }: Props) {
  return (
    <section aria-labelledby="next-events-title">
      <h2
        id="next-events-title"
        className="mb-3 text-lg font-semibold text-slate-900"
      >
        Próximos eventos
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <EventItem
          title="Sol"
          event={next.sunEvent}
          time={next.sunEventTime}
          hours={next.hoursToSunEvent}
        />
        <EventItem
          title="Tierra"
          event={next.earthEvent}
          time={next.earthEventTime}
          hours={next.hoursToEarthEvent}
        />
      </div>
    </section>
  );
}
