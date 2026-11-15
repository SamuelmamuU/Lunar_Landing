// Store global: escenarios, escenario activo, sus efemerides e instante actual.
// Un escenario = sitio + ventana de fechas (ver Scenario en shared/types/lunar.ts).

import { create } from 'zustand';
import { getEphemeris } from '../services/lunarApi';
import { scenarioToRequest } from '../shared/lib/scenario';
import type { EphemerisResponse, LandingSite, Scenario } from '../shared/types/lunar';

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

/**
 * Efemerides del escenario activo. Panorama, metricas y timeline leen de aqui.
 * Mientras carga, `data` conserva la respuesta anterior para no dejar la pantalla en blanco.
 */
export interface EphemerisState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: EphemerisResponse | null;
  /** Mensaje listo para mostrar cuando status === 'error'. */
  error: string | null;
}

/** Peticion de la ultima carga: solo cuenta su respuesta; las que lleguen tarde se descartan. */
let lastRequestKey: string | null = null;

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
  /** Efemerides del escenario activo (las carga loadEphemeris). */
  ephemeris: EphemerisState;

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
  /**
   * Carga las efemerides del escenario activo. selectSite y updateScenario la llaman solas;
   * desde fuera solo hace falta para reintentar despues de un error (`force`).
   */
  loadEphemeris: (options?: { force?: boolean }) => Promise<void>;
}

export const useAppStore = create<AppState>()((set, get) => ({
  customSites: [],
  scenarios: [],
  activeScenario: null,
  currentTime: null,
  ephemeris: { status: 'idle', data: null, error: null },

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
    void get().loadEphemeris();
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
    void get().loadEphemeris();
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  loadEphemeris: async ({ force = false } = {}) => {
    const scenario = get().activeScenario;
    if (!scenario) return;
    const request = scenarioToRequest(scenario);
    const key = JSON.stringify(request);
    // Misma peticion que la ultima (p. ej. volver a elegir el mismo sitio): no se repite.
    if (key === lastRequestKey && !force) return;
    lastRequestKey = key;

    set((state) => ({ ephemeris: { status: 'loading', data: state.ephemeris.data, error: null } }));
    try {
      const data = await getEphemeris(request);
      if (key !== lastRequestKey) return; // llego tarde: ya se pidio otro escenario
      set({ ephemeris: { status: 'ready', data, error: null } });
    } catch (err: unknown) {
      if (key !== lastRequestKey) return;
      const error = err instanceof Error ? err.message : 'Error desconocido';
      set({ ephemeris: { status: 'error', data: null, error } });
    }
  },
}));
