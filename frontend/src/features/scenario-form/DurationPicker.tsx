import { DURATION_OPTIONS } from '../../shared/lib/scenario';

interface Props {
  value: number;
  onChange: (days: number) => void;
}

/** Botones segmentados para la duracion de la ventana (1, 7, 14 o 30 dias). */
export function DurationPicker({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">Duracion</legend>
      <div className="mt-1 inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
        {DURATION_OPTIONS.map((days) => {
          const active = days === value;
          return (
            <button
              key={days}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(days)}
              className={`rounded px-3 py-1 text-sm tabular-nums whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
                active
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-600'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {days} {days === 1 ? 'dia' : 'dias'}
            </button>
          );
        })}
      </div>
      {/* Pista educativa: el dia lunar dura ~29.5 dias terrestres. */}
      <p className="mt-1.5 text-sm text-slate-500">30 dias ≈ 1 dia lunar</p>
    </fieldset>
  );
}
