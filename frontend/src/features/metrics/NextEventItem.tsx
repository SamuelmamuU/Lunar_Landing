import { BODIES, type BodyId } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { formatDuration } from '../../shared/lib/format';
import { BodySwatch } from '../../shared/ui/BodySwatch';
import { eventLabel, type NextEventType } from './eventLabels';

interface Props {
  body: BodyId;
  event: NextEventType;
  time: string | null;
  hours: number | null;
}

/** Proximo cambio de un cuerpo: que pasa, en cuanto tiempo y cuando (UTC). */
export function NextEventItem({ body, event, time, hours }: Props) {
  const label = eventLabel(event);

  return (
    <article className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-3">
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <BodySwatch body={body} className="size-4" />
        {BODIES[body].label}
      </p>

      {label ? (
        <>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-400">
            {label}
            {hours !== null && <span className="font-normal text-slate-700"> en {formatDuration(hours)}</span>}
          </p>
          {time && <p className="mt-0.5 text-sm text-slate-500">{formatUtcDateTime(time)} UTC</p>}
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-600">Sin cambios en los próximos 60 días.</p>
      )}
    </article>
  );
}
