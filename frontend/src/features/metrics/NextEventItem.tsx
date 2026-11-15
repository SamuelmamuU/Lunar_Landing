import { formatUtcDateTime } from '../../shared/lib/dates';
import { formatDuration } from '../../shared/lib/format';
import { eventLabel, type NextEventType } from './eventLabels';

interface Props {
  title: string;
  event: NextEventType;
  time: string | null;
  hours: number | null;
}

/** Proximo cambio de un cuerpo: que pasa, cuando (UTC) y en cuanto tiempo. */
export function NextEventItem({ title, event, time, hours }: Props) {
  const label = eventLabel(event);
  const date = time ? `${formatUtcDateTime(time)} UTC` : null;
  const remaining = hours === null ? null : formatDuration(hours);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{title}</p>

      {label ? (
        <>
          <p className="mt-2 text-lg font-semibold text-slate-900">{label}</p>
          {date && <p className="mt-1 text-sm text-slate-600">{date}</p>}
          {remaining && <p className="mt-2 text-sm font-medium text-slate-700">En {remaining}</p>}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Sin cambios previstos en los próximos 60 días.</p>
      )}
    </article>
  );
}
