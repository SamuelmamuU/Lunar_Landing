import type { LandingSite } from '../../shared/types/lunar';
import { Button } from '../../shared/ui/Button';
import { SiteListSkeleton } from './SiteListSkeleton';
import { SiteOption } from './SiteOption';
import type { SiteGroup } from './siteFilters';
import type { SitesState } from './useSites';

interface Props {
  state: SitesState & { retry: () => void };
  groups: SiteGroup[];
  query: string;
  activeSiteId: string | undefined;
  onSelect: (site: LandingSite) => void;
}

// Entrada escalonada: cada fila espera STAGGER_MS mas que la anterior, hasta MAX_STAGGERED filas
// (las de abajo entran todas juntas para que la lista completa no tarde mas de ~0.5 s).
const STAGGER_MS = 35;
const MAX_STAGGERED = 10;
const ENTER_CLASS = 'animate-fade-up animate-duration-300 animate-ease-out motion-reduce:animate-none';

function enterDelay(index: number) {
  return { animationDelay: `${Math.min(index, MAX_STAGGERED) * STAGGER_MS}ms` };
}

/** Fila global (titulo + items) donde empieza cada grupo, para escalonar entre grupos. */
function groupStartRows(groups: SiteGroup[]): number[] {
  let acc = 0;
  return groups.map((g) => {
    const start = acc;
    acc += 1 + g.sites.length;
    return start;
  });
}

/** Lista agrupada por categoria, con estados de carga, error y "sin resultados". */
export function SiteList({ state, groups, query, activeSiteId, onSelect }: Props) {
  const startRows = groupStartRows(groups);

  return (
    <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto pr-1">
      {state.status === 'loading' && <SiteListSkeleton />}

      {state.status === 'error' && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">No se pudo cargar el catalogo de sitios.</p>
          <p className="mt-1 text-red-700">{state.message}</p>
          <Button variant="link" onClick={state.retry} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {state.status === 'ready' && groups.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">Ningun sitio coincide con "{query}".</p>
      )}

      {groups.map((group, g) => (
        <div key={group.category} className="mb-4">
          <h3
            className={`sticky top-0 z-10 bg-white dark:bg-slate-900 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 ${ENTER_CLASS}`}
            style={enterDelay(startRows[g])}
          >
            {group.label} <span className="font-normal">({group.sites.length})</span>
          </h3>
          <ul className="mt-1 space-y-1">
            {group.sites.map((site, i) => (
              <li key={site.id} className={ENTER_CLASS} style={enterDelay(startRows[g] + 1 + i)}>
                <SiteOption site={site} active={site.id === activeSiteId} onSelect={() => onSelect(site)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
