import { formatDays } from '../../shared/lib/format';
import type { MissionAlternative } from '../../shared/types/lunar';
import { Button } from '../../shared/ui/Button';
import { AlternativeOption } from './AlternativeOption';
import type { AlternativesState } from './useMissionAlternatives';

interface Props {
  /** null = todavia no se busca. */
  state: AlternativesState | null;
  durationDays: number;
  /** Mientras carga otro escenario no se puede buscar (el veredicto en pantalla es el anterior). */
  disabled: boolean;
  onSearch: () => void;
  onApply: (alternative: MissionAlternative) => void;
}

/**
 * Extra F7a, dentro del veredicto NO CANDIDATO: "se retraso el lanzamiento, que fecha cercana si sirve?". Busca
 * con /api/mission fechas antes y despues con la misma duracion y un clic aplica la elegida.
 */
export function AlternativeDates({ state, durationDays, disabled, onSearch, onApply }: Props) {
  const duration = formatDays(durationDays);
  const data = state?.status === 'ready' ? state.data : null;
  // Primero la de despues: es la respuesta a "se retraso el lanzamiento".
  const options = data ? [data.after, data.before].filter((o): o is MissionAlternative => o !== null) : [];

  return (
    <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3 text-sm">
      {data === null && (
        <>
          <Button size="sm" onClick={onSearch} disabled={disabled || state?.status === 'loading'}>
            {state?.status === 'loading' ? 'Searching dates…' : 'Find nearby dates that work'}
          </Button>
          <p className="text-slate-600">
            Same duration ({duration}), up to a month earlier or later: land with the Sun and Earth clear, with no
            night longer than the battery lasts and no more than a day without Earth.
          </p>
        </>
      )}

      {state?.status === 'error' && (
        <p role="alert" className="text-red-800">
          Could not search for dates: {state.error}
        </p>
      )}

      <div aria-live="polite">
        {data && options.length > 0 && (
          <>
            <p className="font-semibold text-slate-800">With the same duration ({duration}) these work:</p>
            <ul className="mt-2 space-y-2">
              {options.map((option) => (
                <AlternativeOption key={option.landing} alternative={option} onApply={onApply} />
              ))}
            </ul>
          </>
        )}
        {/* Las reglas de mision no son las del veredicto: puede que esta misma fecha si cumpla. */}
        {data?.isCandidate && (
          <p className="text-slate-700">
            Landing right at the start, a {duration} mission does meet the mission rules.
          </p>
        )}
        {data && !data.isCandidate && options.length === 0 && (
          <p className="text-slate-700">
            No date within ±{Math.round(data.searchDays)} days works for a {duration} mission. Try a shorter
            duration.
          </p>
        )}
      </div>
    </div>
  );
}
