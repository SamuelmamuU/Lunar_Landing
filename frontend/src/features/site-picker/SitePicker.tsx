import { useId, useMemo, useState } from 'react';
import { useAppStore } from '../../app/store';
import { formatLat, formatLon, lunarRegion, REGION_LABEL } from '../../shared/lib/coords';
import type { LandingSite } from '../../shared/types/lunar';
import { CustomSiteForm } from './CustomSiteForm';
import { groupSites, matchesQuery } from './siteFilters';
import { useSites } from './useSites';

const NO_SITES: LandingSite[] = [];

/** Slice 1: catalogo por categoria + buscador + coordenadas personalizadas. */
export function SitePicker() {
  const sitesState = useSites();
  const customSites = useAppStore((s) => s.customSites);
  const activeSiteId = useAppStore((s) => s.activeScenario?.site.id);
  const selectSite = useAppStore((s) => s.selectSite);
  const [query, setQuery] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const searchId = useId();

  const catalog = sitesState.status === 'ready' ? sitesState.sites : NO_SITES;
  const groups = useMemo(
    () => groupSites([...customSites, ...catalog].filter((s) => matchesQuery(s, query))),
    [catalog, customSites, query],
  );

  return (
    <section aria-labelledby={`${searchId}-title`} className="flex min-h-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`${searchId}-title`} className="text-lg font-semibold text-slate-900">
          Sitio de alunizaje
        </h2>
        {!showCustomForm && (
          <button
            type="button"
            onClick={() => setShowCustomForm(true)}
            className="text-sm font-medium text-orange-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600/40"
          >
            + Coordenadas propias
          </button>
        )}
      </div>

      {showCustomForm && <CustomSiteForm onDone={() => setShowCustomForm(false)} />}

      <div>
        <label htmlFor={searchId} className="sr-only">
          Buscar sitio
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, mision o agencia"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600/40"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {sitesState.status === 'loading' && <SiteListSkeleton />}

        {sitesState.status === 'error' && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">No se pudo cargar el catalogo de sitios.</p>
            <p className="mt-1 text-red-700">{sitesState.message}</p>
            <button
              type="button"
              onClick={sitesState.retry}
              className="mt-2 font-semibold underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        )}

        {sitesState.status === 'ready' && groups.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">
            Ningun sitio coincide con "{query}".
          </p>
        )}

        {groups.map((group) => (
          <div key={group.category} className="mb-4">
            <h3 className="sticky top-0 z-10 bg-slate-100 py-1 text-xs font-semibold text-slate-500">
              {group.label} <span className="font-normal">({group.sites.length})</span>
            </h3>
            <ul className="mt-1 space-y-1">
              {group.sites.map((site) => (
                <li key={site.id}>
                  <SiteOption
                    site={site}
                    active={site.id === activeSiteId}
                    onSelect={() => selectSite(site)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

interface SiteOptionProps {
  site: LandingSite;
  active: boolean;
  onSelect: () => void;
}

function SiteOption({ site, active, onSelect }: SiteOptionProps) {
  const region = REGION_LABEL[lunarRegion(site.lat, site.lon)];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600/40 ${
        active
          ? 'border-orange-600 bg-orange-50'
          : 'border-transparent hover:border-slate-300 hover:bg-white'
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

function SiteListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando sitios" className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-slate-200/70 motion-reduce:animate-none" />
      ))}
    </div>
  );
}
