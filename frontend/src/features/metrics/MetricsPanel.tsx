import { useAppStore } from '../../app/store';
import { AlternativeDates } from './AlternativeDates';
import { NextEvents } from './NextEvents';
import { VerdictCard } from './VerdictCard';
import { useMissionAlternatives } from './useMissionAlternatives';

/**
 * Slice 4: veredicto y proximos eventos. Las metricas de la ventana van en una pestana del panorama
 * (WindowMetrics). Contenedor: lee las efemerides del store y reparte. Todo lo calcula backend; aqui solo se muestra.
 */
export function MetricsPanel() {
  const data = useAppStore((s) => s.ephemeris.data);
  const isLoading = useAppStore((s) => s.ephemeris.status === 'loading');
  const scenario = useAppStore((s) => s.activeScenario);
  const updateScenario = useAppStore((s) => s.updateScenario);
  const alternatives = useMissionAlternatives(scenario);

  if (!data) return null;

  // Semaforo del veredicto: el mismo recuadro encierra veredicto y proximos eventos.
  const tone = data.verdict.isCandidate ? 'border-green-200' : 'border-red-200';
  const fill = data.verdict.isCandidate ? 'bg-green-50' : 'bg-red-50';

  return (
    // Mientras llega otro escenario se conserva lo anterior, atenuado, igual que el panorama.
    <section
      aria-label="Veredicto y próximos eventos"
      aria-busy={isLoading}
      className={`pt-4 transition-opacity ${isLoading ? 'opacity-50' : ''}`}
    >
      <div className={`grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] ${tone} ${fill}`}>
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
        {/* Separador del mismo color: arriba en pantallas angostas, a la izquierda en anchas. */}
        <div className={`border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4 ${tone}`}>
          <NextEvents next={data.next} from={data.start} />
        </div>
      </div>
    </section>
  );
}
