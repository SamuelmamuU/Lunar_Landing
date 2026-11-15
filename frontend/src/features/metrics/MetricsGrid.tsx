import { useId } from 'react';
import type { ScenarioMetrics } from '../../shared/types/lunar';
import { MetricCard } from './MetricCard';
import { extraMetrics, mainMetrics } from './metricItems';

interface Props {
  metrics: ScenarioMetrics;
  /** "30 días desde el 6 mar 2025, 17:29 UTC": a que periodo se refieren los numeros. */
  windowText: string;
}

/** Las 6 metricas principales a la vista y el resto en un desplegable. */
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {mainMetrics(metrics).map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </div>

      <details className="group">
        <summary className="w-fit cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40">
          Más métricas
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {extraMetrics(metrics).map((item) => (
            <MetricCard key={item.label} {...item} />
          ))}
        </div>
      </details>
    </section>
  );
}
