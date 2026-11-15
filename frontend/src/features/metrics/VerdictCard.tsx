import { useId } from 'react';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { formatDuration } from '../../shared/lib/format';
import type { Verdict } from '../../shared/types/lunar';

interface Props {
  verdict: Verdict;
}

/**
 * CANDIDATO o NO CANDIDATO para aterrizar en la ventana, con sus motivos (texto de backend) y la mejor
 * ventana de aterrizaje. Verde y rojo son el semaforo; el veredicto siempre va tambien en texto.
 */
export function VerdictCard({ verdict }: Props) {
  const { isCandidate, reasons, landingWindows, bestWindow } = verdict;
  // id unico: en el comparador puede haber varios veredictos en la misma pagina.
  const titleId = useId();
  const windowCount = landingWindows.length;

  return (
    <section
      aria-labelledby={titleId}
      className={`rounded-lg border p-4 ${isCandidate ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
    >
      <h2 id={titleId} className={`text-2xl font-bold ${isCandidate ? 'text-green-800' : 'text-red-800'}`}>
        {isCandidate ? 'CANDIDATO' : 'NO CANDIDATO'}
      </h2>
      <p className="text-sm text-slate-600">para aterrizar en esta ventana</p>

      {reasons.length > 0 ? (
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
          {reasons.map((reason, index) => (
            <li key={`${index}-${reason}`}>{reason}</li>
          ))}
        </ul>
      ) : (
        isCandidate && (
          <p className="mt-3 text-sm text-slate-700">
            Hay {windowCount === 1 ? 'una ventana' : `${windowCount} ventanas`} con Sol y Tierra despejados y horas por
            delante.
          </p>
        )
      )}

      {bestWindow && (
        <div className="mt-3 border-t border-slate-200 dark:border-slate-700/70 pt-3 text-sm">
          <p className="font-semibold text-slate-800 dark:text-slate-400">Mejor ventana: {formatDuration(bestWindow.durationHours)}</p>
          <p className="mt-0.5 text-slate-700">
            {formatUtcDateTime(bestWindow.start)} – {formatUtcDateTime(bestWindow.end)} UTC
          </p>
        </div>
      )}
    </section>
  );
}
