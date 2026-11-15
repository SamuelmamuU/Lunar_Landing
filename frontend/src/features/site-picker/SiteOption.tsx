import { Coordinates } from '../../shared/ui/Coordinates';
import { RegionBadge } from '../../shared/ui/RegionBadge';
import type { LandingSite } from '../../shared/types/lunar';

interface Props {
  site: LandingSite;
  active: boolean;
  onSelect: () => void;
}

/** Un sitio de la lista: nombre, coordenadas y region. */
export function SiteOption({ site, active, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
        active ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-950'
      }`}
    >
      <span className="block text-sm font-medium text-slate-900 dark:text-slate-400">{site.name}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <Coordinates lat={site.lat} lon={site.lon} />
        <RegionBadge lat={site.lat} lon={site.lon} />
      </span>
    </button>
  );
}
