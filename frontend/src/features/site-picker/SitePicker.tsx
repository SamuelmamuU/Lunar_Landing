import { useId, useMemo, useState } from 'react';
import { useAppStore } from '../../app/store';
import type { LandingSite } from '../../shared/types/lunar';
import { CustomSiteForm } from './CustomSiteForm';
import { SiteList } from './SiteList';
import { SiteSearch } from './SiteSearch';
import { groupSites, matchesQuery } from './siteFilters';
import { useSites } from './useSites';

const NO_SITES: LandingSite[] = [];

/**
 * Slice 1: catalogo por categoria + buscador + coordenadas personalizadas.
 * Este componente solo orquesta: estado local, datos y store. La UI vive en los hijos.
 */
export function SitePicker() {
  const sitesState = useSites();
  const customSites = useAppStore((s) => s.customSites);
  const activeSiteId = useAppStore((s) => s.activeScenario?.site.id);
  const selectSite = useAppStore((s) => s.selectSite);
  const [query, setQuery] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const titleId = useId();

  const catalog = sitesState.status === 'ready' ? sitesState.sites : NO_SITES;
  const groups = useMemo(
    () => groupSites([...customSites, ...catalog].filter((s) => matchesQuery(s, query))),
    [catalog, customSites, query],
  );

  return (
    <section aria-labelledby={titleId} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
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

      <SiteSearch value={query} onChange={setQuery} />

      <SiteList
        state={sitesState}
        groups={groups}
        query={query}
        activeSiteId={activeSiteId}
        onSelect={selectSite}
      />
    </section>
  );
}
