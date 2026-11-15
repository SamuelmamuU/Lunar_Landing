// Funciones puras para agrupar y buscar sitios.

import type { LandingSite, SiteCategory } from '../../shared/types/lunar';

/** Orden en que se muestran las categorias (lo del polo sur primero). */
export const CATEGORY_ORDER: SiteCategory[] = [
  'custom',
  'artemis',
  'clps',
  'international',
  'apollo',
  'reference',
];

export const CATEGORY_LABEL: Record<SiteCategory, string> = {
  custom: 'Your coordinates',
  artemis: 'Artemis regions',
  clps: 'CLPS missions',
  international: 'International missions',
  apollo: 'Apollo',
  reference: 'Reference',
};

/** Minusculas y sin acentos, para que "chang" encuentre "Chang'e". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function matchesQuery(site: LandingSite, query: string): boolean {
  const q = normalize(query.trim());
  if (q === '') return true;
  const haystack = normalize(
    [site.name, site.mission, site.agency, site.description, CATEGORY_LABEL[site.category]]
      .filter(Boolean)
      .join(' '),
  );
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export interface SiteGroup {
  category: SiteCategory;
  label: string;
  sites: LandingSite[];
}

/** Agrupa por categoria en CATEGORY_ORDER, omitiendo grupos vacios. */
export function groupSites(sites: LandingSite[]): SiteGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    sites: sites.filter((s) => s.category === category),
  })).filter((g) => g.sites.length > 0);
}
