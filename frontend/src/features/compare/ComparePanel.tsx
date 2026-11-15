import { useId } from 'react';
import { MAX_COMPARED_SCENARIOS, useAppStore } from '../../app/store';
import { scenarioKey } from '../../shared/lib/scenario';
import { CompareTable } from './CompareTable';

/**
 * Slice 5: 2 a 4 escenarios lado a lado con el mejor valor de cada metrica marcado. Contenedor: lee el
 * store y reparte. Los numeros son los de backend; aqui solo se comparan.
 */
export function ComparePanel() {
  const scenarios = useAppStore((s) => s.scenarios);
  const scenarioEphemeris = useAppStore((s) => s.scenarioEphemeris);
  const activeKey = useAppStore((s) => (s.activeScenario ? scenarioKey(s.activeScenario) : null));
  const showScenario = useAppStore((s) => s.showScenario);
  const removeScenario = useAppStore((s) => s.removeScenario);
  const loadScenarioEphemeris = useAppStore((s) => s.loadScenarioEphemeris);
  const titleId = useId();

  const columns = scenarios.map((scenario) => ({
    scenario,
    state: scenarioEphemeris[scenario.id] ?? { status: 'idle' as const, data: null, error: null },
    isActive: scenarioKey(scenario) === activeKey,
  }));

  return (
    <section aria-labelledby={titleId} className="space-y-3 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-400">
          Comparar escenarios
        </h2>
        {scenarios.length > 0 && (
          <p className="text-sm text-slate-500">
            {scenarios.length} de {MAX_COMPARED_SCENARIOS}
          </p>
        )}
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-400 p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-800 dark:text-slate-400">Agrega el escenario que estás viendo con «Agregar al comparador».</p>
          <p className="mt-1">
            Después elige otro sitio (la fecha se conserva) o cambia la fecha (el sitio se conserva) y agrégalo
            también. Caben hasta {MAX_COMPARED_SCENARIOS}.
          </p>
        </div>
      ) : (
        <>
          <CompareTable
            columns={columns}
            onShow={showScenario}
            onRemove={removeScenario}
            onRetry={(id) => void loadScenarioEphemeris(id)}
          />
          {scenarios.length === 1 && (
            <p className="text-sm text-slate-600">
              Elige otro sitio o cambia la fecha arriba y agrégalo para ver cuál gana en cada métrica.
            </p>
          )}
        </>
      )}
    </section>
  );
}
