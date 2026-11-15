import { useId } from 'react';
import { EXTRA_METRICS, MAIN_METRICS, metricItems } from '../../shared/lib/metrics';
import type { ScenarioMetrics } from '../../shared/types/lunar';
import { MetricCard } from './MetricCard';

interface Props {
  metrics: ScenarioMetrics;
  /** "30 días desde el 6 mar 2025, 17:29 UTC": a que periodo se refieren los numeros. */
  windowText: string;
}

/** Todas las metricas de la ventana: primero las 6 principales, luego el resto. */
export function MetricsGrid({ metrics, windowText }: Props) {
  // id unico: en el comparador puede haber varias rejillas en la misma pagina.
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          Métricas de la ventana
        </h2>
        <p className="text-sm text-slate-500">{windowText}</p>
      </div>

      {/* Las 12 a la vista: con 6 por fila quedan las principales arriba y las demas abajo. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metricItems([...MAIN_METRICS, ...EXTRA_METRICS], metrics).map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}
