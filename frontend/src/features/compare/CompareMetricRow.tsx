import type { EphemerisState } from '../../app/store';
import { CompareCell } from './CompareCell';
import type { CompareRowData } from './compareRows';

interface Props {
  row: CompareRowData;
  statuses: EphemerisState['status'][];
}

/** Una metrica: su nombre, que valor gana y una celda por escenario. */
export function CompareMetricRow({ row, statuses }: Props) {
  const { label, description, better } = row.definition;

  return (
    <tr className="border-t border-slate-200">
      <th scope="row" className="sticky left-0 bg-white px-3 py-2.5 text-left align-top font-normal">
        <span className="block text-slate-900" title={description}>
          {label}
        </span>
        <span className="block text-xs text-slate-500">{better === 'higher' ? 'más es mejor' : 'menos es mejor'}</span>
      </th>
      {row.cells.map((cell, index) => (
        <CompareCell key={index} cell={cell} status={statuses[index]} />
      ))}
    </tr>
  );
}
