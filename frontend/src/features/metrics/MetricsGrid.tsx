
import { formatDegrees } from '../../shared/lib/angles';
import { formatDuration, formatPercent } from '../../shared/lib/format';
import type { ScenarioMetrics } from '../../shared/types/lunar';
import { MetricCard } from './MetricCard';

interface Props {
  metrics: ScenarioMetrics;
}

export function MetricsGrid({ metrics }: Props) {
  const items = [
    {
      label: 'Visibilidad del Sol',
      value: formatPercent(metrics.sunVisiblePct),
      description: 'Porcentaje del tiempo con el Sol visible',
    },
    {
      label: 'Energía solar',
      value: formatPercent(metrics.sunEnergyPct),
      description: 'Porcentaje de energía solar recibida',
    },
    {
      label: 'Visibilidad de la Tierra',
      value: formatPercent(metrics.earthVisiblePct),
      description: 'Porcentaje del tiempo con la Tierra visible',
    },
    {
      label: 'Visibilidad simultánea',
      value: formatPercent(metrics.sunAndEarthPct),
      description: 'Sol y Tierra visibles al mismo tiempo',
    },
    {
      label: 'Periodo más largo de luz',
      value: formatDuration(metrics.longestLightHours),
      description: 'Mayor periodo continuo de iluminación',
    },
    {
      label: 'Noche más larga',
      value: formatDuration(metrics.longestDarkHours),
      description: 'Mayor periodo continuo sin luz solar',
    },
    {
      label: 'Mayor interrupción de comunicación',
      value: formatDuration(metrics.longestEarthGapHours),
      description: 'Mayor periodo continuo sin visibilidad terrestre',
    },
    {
      label: 'Elevación solar máxima',
      value: formatDegrees(metrics.maxSunElevation),
      description: 'Máxima elevación del Sol sobre el horizonte',
    },
    {
      label: 'Elevación solar mínima',
      value: formatDegrees(metrics.minSunElevation),
      description: 'Mínima elevación del Sol sobre el horizonte',
    },
    {
      label: 'Tiempo candidato',
      value: formatPercent(metrics.candidatePct),
      description: 'Porcentaje del periodo que cumple los criterios',
    },
    {
      label: 'Bloqueo del Sol por terreno',
      value: formatPercent(metrics.sunBlockedByTerrainPct),
      description: 'Porcentaje del tiempo bloqueado por el relieve',
    },
    {
      label: 'Bloqueo de la Tierra por terreno',
      value: formatPercent(metrics.earthBlockedByTerrainPct),
      description: 'Porcentaje del tiempo bloqueado por el relieve',
    },
  ];

  return (
    <section aria-labelledby="metrics-title">
      <h2
        id="metrics-title"
        className="mb-3 text-lg font-semibold text-slate-900"
      >
        Métricas del escenario
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            description={item.description}
          />
        ))}
      </div>
    </section>
  );
}
