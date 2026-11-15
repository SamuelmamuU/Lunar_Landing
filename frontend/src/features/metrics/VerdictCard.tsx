
import { formatUtcDateTime } from '../../shared/lib/dates';
import { formatDuration } from '../../shared/lib/format';
import type { Verdict } from '../../shared/types/lunar';

interface Props {
  verdict: Verdict;
}

export function VerdictCard({ verdict }: Props) {
  const { isCandidate, reasons, bestWindow } = verdict;

  return (
    <section
      aria-labelledby="verdict-title"
      className={`rounded-xl border p-5 ${
        isCandidate
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">
            Evaluación del sitio
          </p>
          <h2
            id="verdict-title"
            className={`mt-1 text-2xl font-bold ${
              isCandidate ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {isCandidate ? 'CANDIDATO' : 'NO CANDIDATO'}
          </h2>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Razones de la evaluación
        </h3>

        {reasons.length > 0 ? (
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            {reasons.map((reason, index) => (
              <li key={`${index}-${reason}`}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            El backend no proporcionó razones adicionales.
          </p>
        )}
      </div>

      {bestWindow && (
        <div className="mt-4 border-t border-slate-200/70 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">
            Mejor ventana de aterrizaje
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            {formatUtcDateTime(bestWindow.start)} – {formatUtcDateTime(bestWindow.end)} UTC
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            Duración: {formatDuration(bestWindow.durationHours)}
          </p>
        </div>
      )}
    </section>
  );
}
