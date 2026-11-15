import { BODIES, type BodyId } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { formatDuration } from '../../shared/lib/format';
import { BodySwatch } from '../../shared/ui/BodySwatch';
import { eventLabel, type NextEventType } from '../../shared/lib/eventLabels';

interface Props {
  body: BodyId;
  event: NextEventType;
  time: string | null;
  hours: number | null;
}

/**
 * Proximo cambio de un cuerpo: que pasa, en cuanto tiempo y cuando (UTC). Sin tarjeta: va dentro del recuadro del
 * veredicto y una tarjeta ahi seria caja dentro de caja.
 */
export function NextEventItem({ body, event, time, hours }: Props) {
  const label = eventLabel(event);

  return (
    <article>
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <BodySwatch body={body} className="size-4" />
        {BODIES[body].label}
      </p>

      {label ? (
        <>
          {/* El evento y el "en cuanto" en lineas aparte: asi Sol y Tierra miden lo mismo aunque un texto sea mas largo. */}
          <p className="mt-1 text-base font-semibold text-slate-900">{label}</p>
          {hours !== null && <p className="text-sm text-slate-700">en {formatDuration(hours)}</p>}
          {time && <p className="mt-0.5 text-sm text-slate-500">{formatUtcDateTime(time)} UTC</p>}
        </>
      ) : (
        // Mismas lineas y tamanos que un evento, para que Sol y Tierra se vean parejos.
        <>
          <p className="mt-1 text-base font-semibold text-slate-900">Sin cambios</p>
          <p className="text-sm text-slate-700">en los próximos 60 días</p>
        </>
      )}
    </article>
  );
}
