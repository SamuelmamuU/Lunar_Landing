import type { EphemerisState } from '../../app/store';
import { MAIN_METRICS } from '../../shared/lib/metrics';
import type { Scenario } from '../../shared/types/lunar';
import { CompareColumnHeader } from './CompareColumnHeader';
import { CompareMetricRow } from './CompareMetricRow';
import { buildCompareRows } from './compareRows';
import { VerdictCell } from './VerdictCell';

export interface CompareColumn {
  scenario: Scenario;
  state: EphemerisState;
  isActive: boolean;
}

interface Props {
  columns: CompareColumn[];
  onShow: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

/**
 * Tabla del comparador: una columna por escenario y una fila por metrica, para leer el trade-off en
 * horizontal. Es una <table> real: el lector de pantalla anuncia metrica y escenario de cada celda.
 */
export function CompareTable({ columns, onShow, onRemove, onRetry }: Props) {
  const rows = buildCompareRows(
    MAIN_METRICS,
    columns.map((c) => c.state.data?.metrics ?? null),
  );
  const statuses = columns.map((c) => c.state.status);

  return (
    // Con 4 escenarios en pantallas angostas la tabla se desplaza; la columna de metricas queda fija.
    <div className="scrollbar-subtle overflow-x-auto">
      {/* table-fixed: columnas de escenario del mismo ancho, sin importar el largo del nombre del sitio. */}
      <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <td className="sticky left-0 w-52 bg-white" />
            {columns.map(({ scenario, state, isActive }) => (
              <CompareColumnHeader
                key={scenario.id}
                scenario={scenario}
                isActive={isActive}
                terrain={state.data?.terrain}
                onShow={() => onShow(scenario.id)}
                onRemove={() => onRemove(scenario.id)}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-300">
            <th scope="row" className="sticky left-0 bg-white px-3 py-2.5 text-left align-top font-normal text-slate-900 dark:text-slate-400">
              Veredicto
            </th>
            {columns.map(({ scenario, state }) => (
              <VerdictCell key={scenario.id} state={state} onRetry={() => onRetry(scenario.id)} />
            ))}
          </tr>
          {rows.map((row) => (
            <CompareMetricRow key={row.definition.key} row={row} statuses={statuses} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
