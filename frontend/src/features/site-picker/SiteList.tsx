import type { LandingSite } from '../../shared/types/lunar';
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

/** Lista agrupada por categoria, con estados de carga, error y "sin resultados". */
export function SiteList({ state, groups, query, activeSiteId, onSelect }: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {state.status === 'loading' && <SiteListSkeleton />}

      {state.status === 'error' && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">No se pudo cargar el catalogo de sitios.</p>
          <p className="mt-1 text-red-700">{state.message}</p>
          <button type="button" onClick={state.retry} className="mt-2 font-semibold underline underline-offset-2">
            Reintentar
          </button>
        </div>
      )}

      {state.status === 'ready' && groups.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">Ningun sitio coincide con "{query}".</p>
      )}

      {groups.map((group) => (
        <div key={group.category} className="mb-4">
          <h3 className="sticky top-0 z-10 bg-slate-100 py-1 text-xs font-semibold text-slate-500">
            {group.label} <span className="font-normal">({group.sites.length})</span>
          </h3>
          <ul className="mt-1 space-y-1">
            {group.sites.map((site) => (
              <li key={site.id}>
                <SiteOption site={site} active={site.id === activeSiteId} onSelect={() => onSelect(site)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
