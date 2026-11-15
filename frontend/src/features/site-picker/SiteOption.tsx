import { Button } from '../../shared/ui/Button';
import { Coordinates } from '../../shared/ui/Coordinates';
import { RegionBadge } from '../../shared/ui/RegionBadge';
import { CloseIcon } from '../../shared/ui/icons/CloseIcon';
import type { LandingSite } from '../../shared/types/lunar';

interface Props {
  site: LandingSite;
  active: boolean;
  onSelect: () => void;
  /** Solo los sitios propios se pueden quitar. Sin esto no hay boton. */
  onRemove?: () => void;
}

/**
 * Un sitio de la lista: nombre, coordenadas y region. Los propios llevan una X para quitarlos, junto al boton del
 * sitio y no adentro (un boton no puede contener otro).
 */
export function SiteOption({ site, active, onSelect, onRemove }: Props) {
  return (
    <div className="flex items-start gap-1">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
          active ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
        }`}
      >
        <span className="block text-sm font-medium text-slate-900">{site.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <Coordinates lat={site.lat} lon={site.lon} />
          <RegionBadge lat={site.lat} lon={site.lon} />
        </span>
      </button>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="mt-1.5"
          onClick={onRemove}
          aria-label={`Quitar ${site.name}`}
          title="Quitar este sitio"
        >
          <CloseIcon />
        </Button>
      )}
    </div>
  );
}
