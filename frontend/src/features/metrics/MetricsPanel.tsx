import { useAppStore } from '../../app/store';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { MetricsGrid } from './MetricsGrid';
import { NextEvents } from './NextEvents';
import { VerdictCard } from './VerdictCard';

/**
 * Slice 4: veredicto, proximos eventos y metricas de la ventana. Contenedor: lee las efemerides del store y
 * reparte. Todo lo calcula backend; aqui solo se muestra.
 */
export function MetricsPanel() {
  const data = useAppStore((s) => s.ephemeris.data);
  const isLoading = useAppStore((s) => s.ephemeris.status === 'loading');
  const durationDays = useAppStore((s) => s.activeScenario?.durationDays);

  if (!data) return null;

  const windowText = `${durationDays ?? ''} ${durationDays === 1 ? 'día' : 'días'} desde el ${formatUtcDateTime(data.start)} UTC`;

  return (
    // Mientras llega otro escenario se conserva lo anterior, atenuado, igual que el panorama.
    <section
      aria-label="Veredicto y métricas"
      aria-busy={isLoading}
      className={`space-y-6 pt-4 transition-opacity ${isLoading ? 'opacity-50' : ''}`}
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VerdictCard verdict={data.verdict} />
        <NextEvents next={data.next} from={data.start} />
      </div>
      <MetricsGrid metrics={data.metrics} windowText={windowText} />
    </section>
  );
}
