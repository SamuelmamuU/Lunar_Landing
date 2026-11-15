import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import type { LandingSite } from '../../shared/types/lunar';
import { Button } from '../../shared/ui/Button';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';
import { AddIcon } from '../../shared/ui/icons/AddIcon';
import { SidebarCollapseIcon } from '../../shared/ui/icons/SidebarCollapseIcon';
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
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const wasCollapsed = useRef(sidebarCollapsed);
  const [query, setQuery] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const titleId = useId();

  // Al expandir, el boton de expandir desaparece: el foco vuelve al de contraer para no perderse.
  useEffect(() => {
    if (wasCollapsed.current && !sidebarCollapsed) collapseRef.current?.focus();
    wasCollapsed.current = sidebarCollapsed;
  }, [sidebarCollapsed]);

  const catalog = sitesState.status === 'ready' ? sitesState.sites : NO_SITES;
  const groups = useMemo(
    () => groupSites([...customSites, ...catalog].filter((s) => matchesQuery(s, query))),
    [catalog, customSites, query],
  );

  return (
    <section aria-labelledby={titleId} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id={titleId} className="whitespace-nowrap text-lg font-semibold text-slate-900">
          Escenarios
        </h2>
        <div className="flex items-center gap-1">
          {!showCustomForm && (
            <Button size="sm" onClick={() => setShowCustomForm(true)} aria-label="Nuevo punto por coordenadas">
              <AddIcon />
              Nuevo
            </Button>
          )}
          {/* Solo iconos, para que quepan junto a "Nuevo punto". */}
          <ThemeToggle />
          <Button
            ref={collapseRef}
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Contraer barra lateral"
            title="Contraer barra lateral"
          >
            <SidebarCollapseIcon />
          </Button>
        </div>
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
