// Store global: escenarios, escenario activo, sus efemerides e instante actual.
// Un escenario = sitio + ventana de fechas (ver Scenario en shared/types/lunar.ts).

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getEphemeris } from '../services/lunarApi';
import { scenarioKey, scenarioToRequest } from '../shared/lib/scenario';
import type { EphemerisResponse, LandingSite, Scenario } from '../shared/types/lunar';

export const DEFAULT_DURATION_DAYS = 30;
export const DEFAULT_STEP_MINUTES = 60;
/** Cuantos escenarios caben en el comparador: mas de 4 columnas ya no se leen de un vistazo. */
export const MAX_COMPARED_SCENARIOS = 4;

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

/**
 * Clave en localStorage de lo que agrega el usuario: sus sitios por coordenadas ("+ Nuevo") y los escenarios del
 * comparador. Se guardan solo definiciones (sitio + fechas, unos cientos de bytes): las efemerides se vuelven a pedir
 * al abrir (~0.3 s cada una), asi nunca quedan viejas ni se mezclan las del mock con las reales. Si cambia la forma
 * de Scenario o LandingSite, subir PERSIST_VERSION: lo guardado con otra version se descarta.
 */
const PERSIST_KEY = 'lunar-landing:compare';
const PERSIST_VERSION = 1;

/** Lo guardado viene de fuera (otra version, alguien lo edito): solo se aceptan sitios con forma valida. */
function isStoredSite(value: unknown): value is LandingSite {
  const site = value as LandingSite | null;
  return (
    typeof site === 'object' &&
    site !== null &&
    typeof site.id === 'string' &&
    typeof site.name === 'string' &&
    typeof site.lat === 'number' &&
    typeof site.lon === 'number'
  );
}

/** Igual que isStoredSite, para escenarios. */
function isStoredScenario(value: unknown): value is Scenario {
  const s = value as Scenario | null;
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    typeof s.start === 'string' &&
    typeof s.durationDays === 'number' &&
    typeof s.stepMinutes === 'number' &&
    isStoredSite(s.site)
  );
}

/** Lista guardada: solo sus elementos validos (vacia si no es una lista). */
function storedList<T>(value: unknown, isValid: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(isValid) : [];
}

/** Peticion de la ultima carga: solo cuenta su respuesta; las que lleguen tarde se descartan. */
let lastRequestKey: string | null = null;

export type ScenarioWindowPatch = Partial<Pick<Scenario, 'start' | 'durationDays' | 'stepMinutes'>>;

interface AppState {
  /** Sitios con coordenadas personalizadas que agrego el usuario. */
  customSites: LandingSite[];
  /** Escenarios del comparador (slice 5), en el orden en que se agregaron. Son copias: no cambian. */
  scenarios: Scenario[];
  /** Efemerides de cada escenario del comparador, por id. */
  scenarioEphemeris: Record<string, EphemerisState>;
  /** Escenario que se esta viendo. */
  activeScenario: Scenario | null;
  /** Instante seleccionado en la linea de tiempo (slice 6), ISO. */
  currentTime: string | null;
  /** Efemerides del escenario activo (las carga loadEphemeris). */
  ephemeris: EphemerisState;
  /** Barra lateral contraida: el boton vive en el selector de sitio y el ancho lo cambia el layout. */
  sidebarCollapsed: boolean;

  /**
   * Cambia el sitio del escenario activo. Conserva fecha, duracion y paso,
   * para que "misma fecha, otro sitio" sea solo elegir otro sitio.
   */
  selectSite: (site: LandingSite) => void;
  /** Agrega un sitio personalizado y lo deja como activo. */
  addCustomSite: (site: Omit<LandingSite, 'id' | 'category'>) => LandingSite;
  /**
   * Quita un sitio personalizado de la lista. Si es el que se esta viendo, la vista vuelve a "elige un sitio".
   * Los escenarios del comparador que lo usan se quedan: llevan su propia copia del sitio.
   */
  removeCustomSite: (id: string) => void;
  /**
   * Cambia la ventana de tiempo del escenario activo (inicio, duracion, paso).
   * Conserva el sitio, para que "mismo sitio, otra fecha" sea solo cambiar la fecha.
   */
  updateScenario: (patch: ScenarioWindowPatch) => void;
  setCurrentTime: (time: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /**
   * Agrega una copia del escenario activo al comparador y carga sus efemerides (si ya estan cargadas para el
   * activo, las reutiliza). No hace nada si ya esta (mismo sitio y ventana) o si el comparador esta lleno.
   */
  addScenario: () => void;
  removeScenario: (id: string) => void;
  /** Lleva un escenario del comparador a la vista principal (panorama y metricas). */
  showScenario: (id: string) => void;
  /** Carga (o reintenta) las efemerides de un escenario del comparador. */
  loadScenarioEphemeris: (id: string) => Promise<void>;
  /**
   * Carga las efemerides del escenario activo. selectSite y updateScenario la llaman solas;
   * desde fuera solo hace falta para reintentar despues de un error (`force`).
   */
  loadEphemeris: (options?: { force?: boolean }) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      customSites: [],
      scenarios: [],
      scenarioEphemeris: {},
      activeScenario: null,
      currentTime: null,
      ephemeris: { status: 'idle', data: null, error: null },
      sidebarCollapsed: false,

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

      removeCustomSite: (id) => {
        const viewing = get().activeScenario?.site.id === id;
        if (viewing) lastRequestKey = null;
        set((state) => ({
          customSites: state.customSites.filter((site) => site.id !== id),
          ...(viewing
            ? { activeScenario: null, currentTime: null, ephemeris: { status: 'idle', data: null, error: null } }
            : {}),
        }));
      },

      updateScenario: (patch) => {
        const prev = get().activeScenario;
        if (!prev) return;
        // El instante elegido puede quedar fuera de la nueva ventana: se reinicia.
        set({ activeScenario: { ...prev, ...patch }, currentTime: null });
        void get().loadEphemeris();
      },

      setCurrentTime: (time) => set({ currentTime: time }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      addScenario: () => {
        const { activeScenario, scenarios, ephemeris } = get();
        if (!activeScenario || scenarios.length >= MAX_COMPARED_SCENARIOS) return;
        const key = scenarioKey(activeScenario);
        if (scenarios.some((s) => scenarioKey(s) === key)) return;

        const scenario: Scenario = { ...activeScenario, id: newId('compare') };
        // Lo que ya se ve en pantalla no se vuelve a pedir.
        const loaded = ephemeris.status === 'ready' && key === lastRequestKey ? ephemeris.data : null;
        set((state) => ({
          scenarios: [...state.scenarios, scenario],
          scenarioEphemeris: {
            ...state.scenarioEphemeris,
            [scenario.id]: { status: loaded ? 'ready' : 'idle', data: loaded, error: null },
          },
        }));
        if (!loaded) void get().loadScenarioEphemeris(scenario.id);
      },

      removeScenario: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.scenarioEphemeris;
          return { scenarios: state.scenarios.filter((s) => s.id !== id), scenarioEphemeris: rest };
        }),

      showScenario: (id) => {
        const scenario = get().scenarios.find((s) => s.id === id);
        if (!scenario) return;
        // Copia con id propio: cambiar la fecha arriba no debe tocar la columna del comparador.
        set({ activeScenario: { ...scenario, id: newId('scenario') }, currentTime: null });
        void get().loadEphemeris();
      },

      loadScenarioEphemeris: async (id) => {
        const scenario = get().scenarios.find((s) => s.id === id);
        if (!scenario) return;
        const setEntry = (entry: EphemerisState) =>
          set((state) =>
            // Si se quito mientras cargaba, la respuesta se descarta.
            state.scenarios.some((s) => s.id === id)
              ? { scenarioEphemeris: { ...state.scenarioEphemeris, [id]: entry } }
              : {},
          );

        setEntry({ status: 'loading', data: null, error: null });
        try {
          // Cada escenario hace su propia llamada (lunarApi las pone en fila: SPICE no aguanta dos a la vez).
          setEntry({ status: 'ready', data: await getEphemeris(scenarioToRequest(scenario)), error: null });
        } catch (err: unknown) {
          setEntry({ status: 'error', data: null, error: err instanceof Error ? err.message : 'Error desconocido' });
        }
      },

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
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ customSites: state.customSites, scenarios: state.scenarios }),
      // Otra version: se empieza vacio en vez de arriesgar datos rotos.
      migrate: () => ({ customSites: [], scenarios: [] }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AppState> | undefined;
        return {
          ...current,
          customSites: storedList(saved?.customSites, isStoredSite).map((site) => ({ ...site, category: 'custom' })),
          scenarios: storedList(saved?.scenarios, isStoredScenario).slice(0, MAX_COMPARED_SCENARIOS),
        };
      },
      // Al abrir la app, cada escenario guardado pide sus efemerides (lunarApi las pone en fila).
      onRehydrateStorage: () => (state) => {
        queueMicrotask(() => state?.scenarios.forEach((s) => void state.loadScenarioEphemeris(s.id)));
      },
    },
  ),
);
