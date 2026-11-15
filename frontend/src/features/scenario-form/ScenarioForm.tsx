import { useAppStore } from '../../app/store';
import { addDays, dateTimeInputToIso, formatUtcDate, isoToDateTimeInput, sameMinute } from '../../shared/lib/dates';
import { formatDays } from '../../shared/lib/format';
import {
  COVERAGE_END_INPUT,
  COVERAGE_START_INPUT,
  MAX_DURATION_DAYS,
  durationDaysBetween,
  scenarioEnd,
  validateEnd,
  validateStart,
} from '../../shared/lib/scenario';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { useSyncedDraft } from './useSyncedDraft';

/** Un dia lunar dura ~29.5 dias terrestres: desde ahi la ventana cubre un ciclo completo de luz. */
const LUNAR_DAY_DAYS = 29.5;

const addMinutes = (iso: string, minutes: number) => addDays(iso, minutes / 1440);
/** El menor de dos valores de datetime-local (mismo formato: se comparan como texto). */
const minInput = (a: string, b: string) => (a < b ? a : b);

/**
 * Slice 2: fechas del escenario activo, inicio y fin. Controles arriba y ayudas abajo.
 * El escenario guarda inicio + duracion: al mover el inicio la duracion se conserva y el fin se recorre (asi
 * "se retraso el lanzamiento" y las fechas alternativas mantienen la misma mision). Mover el fin cambia la
 * duracion. El paso entre muestras queda fijo (DEFAULT_STEP_MINUTES en el store): es un detalle tecnico.
 * Cada cambio valido se aplica al store al instante y dispara la carga de efemerides.
 */
export function ScenarioForm() {
  const scenario = useAppStore((s) => s.activeScenario);
  const updateScenario = useAppStore((s) => s.updateScenario);

  const [startDraft, setStartDraft] = useSyncedDraft(scenario ? isoToDateTimeInput(scenario.start) : '');
  const [endDraft, setEndDraft] = useSyncedDraft(scenario ? isoToDateTimeInput(scenarioEnd(scenario)) : '');

  if (!scenario) return null;

  const startError = validateStart(startDraft, scenario.durationDays);
  const endError = validateEnd(endDraft, scenario.start);
  const { landedAt } = scenario.site;

  function handleStartChange(raw: string) {
    setStartDraft(raw);
    if (scenario && !validateStart(raw, scenario.durationDays)) updateScenario({ start: dateTimeInputToIso(raw)! });
  }

  function handleEndChange(raw: string) {
    setEndDraft(raw);
    if (scenario && !validateEnd(raw, scenario.start)) {
      updateScenario({ durationDays: durationDaysBetween(scenario.start, dateTimeInputToIso(raw)!) });
    }
  }

  return (
    <div role="group" aria-label="Fechas del escenario" className="flex shrink-0 flex-wrap items-start gap-x-6 gap-y-3">
      <div className="w-56">
        <TextField
          type="datetime-local"
          label="Inicio"
          hint="UTC"
          // El calendario solo ofrece lo que cubren los datos, dejando lugar para la duracion actual.
          min={COVERAGE_START_INPUT}
          max={isoToDateTimeInput(addDays(`${COVERAGE_END_INPUT}:00Z`, -scenario.durationDays))}
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

      <div className="w-56">
        <TextField
          type="datetime-local"
          label="Fin"
          hint="UTC"
          // El calendario solo ofrece fechas validas: de 1 h despues del inicio hasta el maximo. Escribiendo a mano
          // se puede salir del rango; para eso esta validateEnd.
          min={isoToDateTimeInput(addMinutes(scenario.start, 60))}
          max={minInput(isoToDateTimeInput(addDays(scenario.start, MAX_DURATION_DAYS)), COVERAGE_END_INPUT)}
          value={endDraft}
          onChange={handleEndChange}
          error={endError}
        />
        {/* Duracion que resulta (la del escenario aplicado, no la del borrador si es invalido). */}
        {!endError && (
          <p className="mt-1.5 text-xs text-slate-500">
            Dura {formatDays(scenario.durationDays)}
            {scenario.durationDays >= LUNAR_DAY_DAYS && ': un día lunar completo'}
          </p>
        )}
      </div>
    </div>
  );
}
