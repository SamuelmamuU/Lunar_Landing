import { formatLat, formatLon, lunarRegion, REGION_LABEL } from '../../shared/lib/coords';
import type { LandingSite } from '../../shared/types/lunar';

interface Props {
  site: LandingSite;
  active: boolean;
  onSelect: () => void;
}

/** Un sitio de la lista: nombre, coordenadas y region. */
export function SiteOption({ site, active, onSelect }: Props) {
  const region = REGION_LABEL[lunarRegion(site.lat, site.lon)];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600/40 ${
        active ? 'border-orange-600 bg-orange-50' : 'border-transparent hover:border-slate-300 hover:bg-white'
      }`}
    >
      <span className="block text-sm font-medium text-slate-900">{site.name}</span>
      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-600">
        <span className="tabular-nums">
          {formatLat(site.lat)}, {formatLon(site.lon)}
        </span>
        <span className="text-slate-500">{region}</span>
      </span>
    </button>
  );
}
