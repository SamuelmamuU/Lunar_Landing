import type { EphemerisState } from '../../app/store';
import type { CompareCellData } from './compareRows';
import { MetricBar } from './MetricBar';

interface Props {
  cell: CompareCellData | null;
  status: EphemerisState['status'];
}

/** Valor de una metrica para un escenario, con su barra y la marca "mejor" (en texto, no solo en tinta). */
export function CompareCell({ cell, status }: Props) {
  if (!cell) {
    return (
      <td className="px-3 py-2.5 align-top">
        {status === 'error' ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className="block h-4 w-16 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        )}
      </td>
    );
  }

  return (
    <td className="px-3 py-2.5 align-top">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`tabular-nums ${cell.isBest ? 'font-semibold text-slate-900 dark:text-slate-400' : 'text-slate-700'}`}>
          {cell.text}
        </span>
        {cell.isBest && <span className="rounded bg-slate-900 px-1.5 text-xs font-medium text-white">mejor</span>}
      </p>
      {cell.barFraction !== null && <MetricBar fraction={cell.barFraction} emphasized={cell.isBest} />}
    </td>
  );
}
