import { useAppStore } from '../../app/store';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { formatDays } from '../../shared/lib/format';
import { AlternativeDates } from './AlternativeDates';
import { MetricsGrid } from './MetricsGrid';
import { NextEvents } from './NextEvents';
import { VerdictCard } from './VerdictCard';
import { useMissionAlternatives } from './useMissionAlternatives';

/**
 * Slice 4: veredicto, proximos eventos y metricas de la ventana. Contenedor: lee las efemerides del store y
 * reparte. Todo lo calcula backend; aqui solo se muestra.
 */
export function MetricsPanel() {
  const data = useAppStore((s) => s.ephemeris.data);
  const isLoading = useAppStore((s) => s.ephemeris.status === 'loading');
  const scenario = useAppStore((s) => s.activeScenario);
  const updateScenario = useAppStore((s) => s.updateScenario);
  const alternatives = useMissionAlternatives(scenario);
  const durationDays = scenario?.durationDays;

  if (!data) return null;

  const windowText = `${durationDays === undefined ? '' : formatDays(durationDays)} desde el ${formatUtcDateTime(data.start)} UTC`;

  return (
    // Mientras llega otro escenario se conserva lo anterior, atenuado, igual que el panorama.
    <section
      aria-label="Veredicto y métricas"
      aria-busy={isLoading}
      className={`space-y-6 pt-4 transition-opacity ${isLoading ? 'opacity-50' : ''}`}
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VerdictCard verdict={data.verdict}>
          {/* Extra F7a: con un clic, la fecha sugerida pasa a ser el inicio (misma duracion). */}
          {!data.verdict.isCandidate && scenario && (
            <AlternativeDates
              state={alternatives.state}
              durationDays={scenario.durationDays}
              disabled={isLoading}
              onSearch={() => void alternatives.search()}
              onApply={(alternative) => updateScenario({ start: alternative.landing })}
            />
          )}
        </VerdictCard>
        <NextEvents next={data.next} from={data.start} />
      </div>
      <MetricsGrid metrics={data.metrics} windowText={windowText} />
    </section>
  );
}
