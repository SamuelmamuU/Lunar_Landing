import { formatUtcDate, formatUtcDateTime } from '../../shared/lib/dates';
import { formatDays } from '../../shared/lib/format';
import type { Scenario } from '../../shared/types/lunar';
import { Button } from '../../shared/ui/Button';
import { TerrainBadge } from '../../shared/ui/TerrainBadge';

interface Props {
  scenario: Scenario;
  /** Es el escenario que se ve arriba (panorama y metricas). */
  isActive: boolean;
  /** false = backend no tiene relieve real para este punto. undefined = aun no hay datos. */
  terrain: boolean | undefined;
  onShow: () => void;
  onRemove: () => void;
}

/** Encabezado de una columna: sitio, ventana de fechas y acciones. Sitio + ventana = el escenario. */
export function CompareColumnHeader({ scenario, isActive, terrain, onShow, onRemove }: Props) {
  const { site, start, durationDays } = scenario;
  // Con el mismo sitio en dos columnas, la fecha distingue los botones para el lector de pantalla.
  const name = `${site.name}, ${formatUtcDate(start)}`;

  return (
    <th scope="col" className="px-3 pb-3 text-left align-bottom font-normal">
      <span className="line-clamp-2 font-semibold text-slate-900" title={site.name}>
        {site.name}
      </span>
      <span className="block text-xs text-slate-500">
        {formatUtcDateTime(start)} UTC
        <br />
        {formatDays(durationDays)}
      </span>
      {terrain === false && (
        <div className="mt-1.5">
          <TerrainBadge />
        </div>
      )}
      {/* -ml-3: el texto de los botones queda alineado con el nombre del sitio. */}
      <div className="-ml-3 mt-2 flex items-center gap-1">
        {isActive ? (
          <span className="px-3 py-1 text-sm text-slate-500">En pantalla</span>
        ) : (
          <Button variant="ghost" size="sm" onClick={onShow} aria-label={`Ver ${name} arriba`}>
            Ver
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Quitar ${name} del comparador`}>
          Quitar
        </Button>
      </div>
    </th>
  );
}
