import type { ReactNode } from 'react';
import { useAppStore } from '../../app/store';
import { ActiveScenarioSummary } from './ActiveScenarioSummary';
import { ScenarioForm } from './ScenarioForm';

interface Props {
  /** Acciones sobre el escenario (p. ej. agregarlo al comparador). Las pone App: este feature no las conoce. */
  actions?: ReactNode;
}

/**
 * Encabezado del escenario: el sitio a la izquierda y sus fechas a la derecha.
 * Sitio y fechas juntos son el escenario, la unidad que se compara en el slice 5.
 */
export function ScenarioHeader({ actions }: Props) {
  const hasScenario = useAppStore((s) => s.activeScenario !== null);

  // Sin sitio, solo la invitacion a elegir uno (sin linea divisoria).
  if (!hasScenario) return <ActiveScenarioSummary />;

  return (
    <section
      aria-label="Escenario"
      // En pantallas grandes, sitio y fechas en una sola fila: las fechas no se encogen y el nombre se recorta.
      className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 border-b border-slate-200 pb-4 lg:flex-nowrap"
    >
      <ActiveScenarioSummary />
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3">
        <ScenarioForm />
        {actions}
      </div>
    </section>
  );
}
