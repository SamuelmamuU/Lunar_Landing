import { useAppStore } from '../../app/store';
import { ActiveScenarioSummary } from './ActiveScenarioSummary';
import { ScenarioForm } from './ScenarioForm';

/**
 * Encabezado del escenario: el sitio a la izquierda y sus fechas a la derecha.
 * Sitio y fechas juntos son el escenario, la unidad que se compara en el slice 5.
 */
export function ScenarioHeader() {
  const hasScenario = useAppStore((s) => s.activeScenario !== null);

  // Sin sitio, solo la invitacion a elegir uno (sin linea divisoria).
  if (!hasScenario) return <ActiveScenarioSummary />;

  return (
    <section
      aria-label="Escenario"
      className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 border-b border-slate-200 pb-4"
    >
      <ActiveScenarioSummary />
      <ScenarioForm />
    </section>
  );
}
