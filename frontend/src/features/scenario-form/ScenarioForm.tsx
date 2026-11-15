import { useAppStore } from '../../app/store';
import { dateTimeInputToIso, formatUtcDate, isoToDateTimeInput, sameMinute } from '../../shared/lib/dates';
import { validateStart } from '../../shared/lib/scenario';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { DurationPicker } from './DurationPicker';
import { useSyncedDraft } from './useSyncedDraft';

/**
 * Slice 2: fechas del escenario activo. Controles arriba (inicio, duracion) y ayudas abajo.
 * El paso entre muestras queda fijo (DEFAULT_STEP_MINUTES en el store): es un detalle tecnico.
 * Cada cambio valido se aplica al store al instante y dispara la carga de efemerides.
 */
export function ScenarioForm() {
  const scenario = useAppStore((s) => s.activeScenario);
  const updateScenario = useAppStore((s) => s.updateScenario);

  const [startDraft, setStartDraft] = useSyncedDraft(scenario ? isoToDateTimeInput(scenario.start) : '');

  if (!scenario) return null;

  const startError = validateStart(startDraft);
  const { landedAt } = scenario.site;

  function handleStartChange(raw: string) {
    setStartDraft(raw);
    if (!validateStart(raw)) updateScenario({ start: dateTimeInputToIso(raw)! });
  }

  return (
    <div role="group" aria-label="Fechas del escenario" className="flex shrink-0 flex-wrap items-start gap-x-6 gap-y-3">
      <div className="w-56">
        <TextField
          type="datetime-local"
          label="Inicio"
          hint="UTC"
          value={startDraft}
          onChange={handleStartChange}
          error={startError}
        />
        {/* Con fecha de alunizaje: boton para usarla, o confirmacion si ya es el inicio (mismo alto, nada salta). */}
        {landedAt &&
          (sameMinute(landedAt, scenario.start) ? (
            <p className="mt-1.5 text-xs text-slate-500">Es la fecha de alunizaje</p>
          ) : (
            <Button variant="link" className="mt-1.5 text-blue-700" onClick={() => updateScenario({ start: landedAt })}>
              Usar alunizaje ({formatUtcDate(landedAt)})
            </Button>
          ))}
      </div>

      <DurationPicker value={scenario.durationDays} onChange={(days) => updateScenario({ durationDays: days })} />
    </div>
  );
}
