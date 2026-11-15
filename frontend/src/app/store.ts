// Store global: escenarios, escenario activo e instante actual.
// Un escenario = sitio + ventana de fechas (ver Scenario en shared/types/lunar.ts).

import { create } from 'zustand';
import type { LandingSite, Scenario } from '../shared/types/lunar';

export const DEFAULT_DURATION_DAYS = 30;
export const DEFAULT_STEP_MINUTES = 60;

/** Hoy a las 00:00 UTC, en ISO. */
function todayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export type ScenarioWindowPatch = Partial<Pick<Scenario, 'start' | 'durationDays' | 'stepMinutes'>>;

interface AppState {
  /** Sitios con coordenadas personalizadas que agrego el usuario. */
  customSites: LandingSite[];
  /** Escenarios guardados para el comparador (slice 5). */
  scenarios: Scenario[];
  /** Escenario que se esta viendo. */
  activeScenario: Scenario | null;
  /** Instante seleccionado en la linea de tiempo (slice 6), ISO. */
  currentTime: string | null;

  /**
   * Cambia el sitio del escenario activo. Conserva fecha, duracion y paso,
   * para que "misma fecha, otro sitio" sea solo elegir otro sitio.
   */
  selectSite: (site: LandingSite) => void;
  /** Agrega un sitio personalizado y lo deja como activo. */
  addCustomSite: (site: Omit<LandingSite, 'id' | 'category'>) => LandingSite;
  /**
   * Cambia la ventana de tiempo del escenario activo (inicio, duracion, paso).
   * Conserva el sitio, para que "mismo sitio, otra fecha" sea solo cambiar la fecha.
   */
  updateScenario: (patch: ScenarioWindowPatch) => void;
  setCurrentTime: (time: string | null) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  customSites: [],
  scenarios: [],
  activeScenario: null,
  currentTime: null,

  selectSite: (site) => {
    const prev = get().activeScenario;
    set({
      activeScenario: {
        id: prev?.id ?? newId('scenario'),
        site,
        start: prev?.start ?? todayUtcIso(),
        durationDays: prev?.durationDays ?? DEFAULT_DURATION_DAYS,
        stepMinutes: prev?.stepMinutes ?? DEFAULT_STEP_MINUTES,
      },
      currentTime: null,
    });
  },

  addCustomSite: (input) => {
    const site: LandingSite = { ...input, id: newId('custom'), category: 'custom' };
    set((state) => ({ customSites: [...state.customSites, site] }));
    get().selectSite(site);
    return site;
  },

  updateScenario: (patch) => {
    const prev = get().activeScenario;
    if (!prev) return;
    // El instante elegido puede quedar fuera de la nueva ventana: se reinicia.
    set({ activeScenario: { ...prev, ...patch }, currentTime: null });
  },

  setCurrentTime: (time) => set({ currentTime: time }),
}));
