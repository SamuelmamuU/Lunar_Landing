import { useAppStore } from '../../app/store';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { formatDays } from '../../shared/lib/format';
import { MetricsGrid } from './MetricsGrid';

/**
 * Metricas de la ventana del escenario activo. Contenedor: lee el store y arma "a que periodo se refieren". Se
 * muestra como pestana del panorama (App la pasa a SkyPanorama), no debajo del veredicto.
 */
export function WindowMetrics() {
  const data = useAppStore((s) => s.ephemeris.data);
  const durationDays = useAppStore((s) => s.activeScenario?.durationDays);

  if (!data) return null;

  const windowText = `${durationDays === undefined ? '' : formatDays(durationDays)} from ${formatUtcDateTime(data.start)} UTC`;
  return <MetricsGrid metrics={data.metrics} windowText={windowText} />;
}
