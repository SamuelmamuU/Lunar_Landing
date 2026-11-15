import { MAX_COMPARED_SCENARIOS, useAppStore } from '../../app/store';
import { scenarioKey } from '../../shared/lib/scenario';
import { Button } from '../../shared/ui/Button';
import { CompareIcon } from '../../shared/ui/icons/CompareIcon';

/** Agrega el escenario activo (sitio + fechas) al comparador. Dice por que no se puede cuando no se puede. */
export function AddToCompareButton() {
  const hasScenario = useAppStore((s) => s.activeScenario !== null);
  const isAdded = useAppStore((s) => {
    const active = s.activeScenario;
    if (!active) return false;
    const key = scenarioKey(active);
    return s.scenarios.some((scenario) => scenarioKey(scenario) === key);
  });
  const isFull = useAppStore((s) => s.scenarios.length >= MAX_COMPARED_SCENARIOS);
  const addScenario = useAppStore((s) => s.addScenario);

  if (!hasScenario) return null;

  const label = isAdded ? 'Ya está en el comparador' : isFull ? 'Comparador lleno' : 'Agregar al comparador';

  return (
    <Button size="sm" onClick={addScenario} disabled={isAdded || isFull}>
      <CompareIcon />
      {label}
    </Button>
  );
}
