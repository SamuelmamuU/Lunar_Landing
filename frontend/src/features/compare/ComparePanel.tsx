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
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          Compare scenarios
        </h2>
        {scenarios.length > 0 && (
          <p className="text-sm text-slate-500">
            {scenarios.length} of {MAX_COMPARED_SCENARIOS}
          </p>
        )}
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-400 p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Add the scenario you are viewing with “Add to comparison”.</p>
          <p className="mt-1">
            Then pick another site (the dates stay) or change the dates (the site stays) and add it too. Up to{' '}
            {MAX_COMPARED_SCENARIOS} fit.
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
              Pick another site or change the dates above and add it to see which one wins on each metric.
            </p>
          )}
        </>
      )}
    </section>
  );
}
