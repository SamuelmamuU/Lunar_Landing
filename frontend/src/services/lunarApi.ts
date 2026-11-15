// Unica puerta a los datos. Con VITE_USE_MOCK=false habla con el backend real y traduce su
// respuesta (snake_case, ver docs/contrato-api.md) al modelo del front (shared/types/lunar.ts).

import type {
  BodyPosition,
  EphemerisRequest,
  EphemerisResponse,
  EphemerisSample,
  LandingSite,
  LandingWindow,
  SiteCategory,
  SkyEventType,
} from '../shared/types/lunar';
import { MOCK_SITES } from '../mocks/sites.mock';
import { generateEphemeris } from '../mocks/ephemeris.mock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const USING_MOCK = USE_MOCK;
/** Vacio = mismo origen: en desarrollo Vite reenvia /api al backend (vite.config.ts). */
const API_URL = import.meta.env.VITE_API_URL ?? '';
const MOCK_DELAY_MS = 400; // para ver los estados de carga

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- transporte ----------

/** El backend manda { detail: "texto" } o { detail: [{ msg | mensaje }] }. */
function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: string; mensaje?: string }) => d.msg ?? d.mensaje ?? '')
      .filter(Boolean)
      .join('. ');
  }
  return `El servidor respondio con un error (${status}).`;
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor de calculos.');
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(res.status, json));
  return json as T;
}

// ---------- forma de las respuestas del backend (solo lo que usa el front) ----------

interface ApiSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string;
  note?: string;
  // Pendientes en backend (slice B3); se leen si existen.
  category_id?: SiteCategory;
  agency?: string;
  mission?: string;
  landed_utc?: string;
}

interface ApiWindow {
  start_utc: string;
  end_utc: string;
  duration_h: number;
}

interface ApiEvaluate {
  input: { x_lon: number; y_lat: number; start_utc: string; end_utc: string; step_min: number };
  horizon: { terrain: boolean; az_step_deg: number; profile_deg: number[] };
  result: {
    is_candidate: boolean;
    reasons: string[];
    landing_windows: ApiWindow[];
    best_window: ApiWindow | null;
  };
  at_start: {
    next: {
      sun_event: 'sunset' | 'sunrise' | null;
      sun_event_utc: string | null;
      hours_to_sun_event: number | null;
      earth_event: 'earthset' | 'earthrise' | null;
      earth_event_utc: string | null;
      hours_to_earth_event: number | null;
    };
  };
  metrics: {
    pct_sun_visible: number;
    pct_sun_energy: number;
    pct_earth_visible: number;
    pct_sun_and_earth: number;
    longest_light_h: number;
    longest_dark_h: number;
    longest_earth_gap_h: number;
    pct_sun_blocked_by_terrain: number;
    pct_earth_blocked_by_terrain: number;
    max_sun_elevation_deg: number;
    min_sun_elevation_deg: number;
    pct_time_candidate: number;
  };
  events: { utc: string; type: SkyEventType }[];
  series: {
    t_utc: string[];
    sun_az: number[];
    sun_el: number[];
    sun_frac: number[];
    sun_clearance: number[];
    earth_az: number[];
    earth_el: number[];
    earth_clearance: number[];
    earth_visible: boolean[];
    /** Pendiente en backend (slice B2). */
    earth_frac?: number[];
  };
}

// ---------- backend -> modelo del front ----------

/** Categoria del backend (texto libre) -> categoria del front. */
function toCategory(site: ApiSite): SiteCategory {
  if (site.category_id) return site.category_id;
  const c = site.category.toLowerCase();
  if (c.includes('apollo')) return 'apollo';
  if (c.includes('clps')) return 'clps';
  if (c.includes('artemis')) return 'artemis';
  if (c.includes('polo')) return 'reference';
  return 'international';
}

function toSite(site: ApiSite): LandingSite {
  const category = toCategory(site);
  return {
    id: site.id,
    name: site.name,
    lat: site.lat,
    lon: site.lon,
    category,
    // Para las misiones internacionales el backend guarda la agencia como categoria (ISRO, CNSA, JAXA).
    agency: site.agency ?? (category === 'international' ? site.category : undefined),
    mission: site.mission,
    landedAt: site.landed_utc,
    description: site.note || undefined,
  };
}

const toWindow = (w: ApiWindow): LandingWindow => ({
  start: w.start_utc,
  end: w.end_utc,
  durationHours: w.duration_h,
});

function toSamples(series: ApiEvaluate['series']): EphemerisSample[] {
  return series.t_utc.map((time, i) => {
    const sun: BodyPosition = {
      azimuth: series.sun_az[i],
      elevation: series.sun_el[i],
      horizonElevation: series.sun_el[i] - series.sun_clearance[i],
      visible: series.sun_frac[i] > 0,
      visibleFraction: series.sun_frac[i],
    };
    const earth: BodyPosition = {
      azimuth: series.earth_az[i],
      elevation: series.earth_el[i],
      horizonElevation: series.earth_el[i] - series.earth_clearance[i],
      visible: series.earth_visible[i],
      visibleFraction: series.earth_frac?.[i] ?? (series.earth_visible[i] ? 1 : 0),
    };
    return { time, sun, earth };
  });
}

function toEphemeris(api: ApiEvaluate): EphemerisResponse {
  const { next } = api.at_start;
  const m = api.metrics;
  return {
    lat: api.input.y_lat,
    lon: api.input.x_lon,
    start: api.input.start_utc,
    end: api.input.end_utc,
    stepMinutes: api.input.step_min,
    horizon: { stepDeg: api.horizon.az_step_deg, elevations: api.horizon.profile_deg },
    samples: toSamples(api.series),
    metrics: {
      sunVisiblePct: m.pct_sun_visible,
      sunEnergyPct: m.pct_sun_energy,
      earthVisiblePct: m.pct_earth_visible,
      sunAndEarthPct: m.pct_sun_and_earth,
      longestLightHours: m.longest_light_h,
      longestDarkHours: m.longest_dark_h,
      longestEarthGapHours: m.longest_earth_gap_h,
      sunBlockedByTerrainPct: m.pct_sun_blocked_by_terrain,
      earthBlockedByTerrainPct: m.pct_earth_blocked_by_terrain,
      maxSunElevation: m.max_sun_elevation_deg,
      minSunElevation: m.min_sun_elevation_deg,
      candidatePct: m.pct_time_candidate,
    },
    events: api.events.map((e) => ({ time: e.utc, type: e.type })),
    next: {
      sunEvent: next.sun_event,
      sunEventTime: next.sun_event_utc,
      hoursToSunEvent: next.hours_to_sun_event,
      earthEvent: next.earth_event,
      earthEventTime: next.earth_event_utc,
      hoursToEarthEvent: next.hours_to_earth_event,
    },
    verdict: {
      isCandidate: api.result.is_candidate,
      reasons: api.result.reasons,
      landingWindows: api.result.landing_windows.map(toWindow),
      bestWindow: api.result.best_window ? toWindow(api.result.best_window) : null,
    },
    terrain: api.horizon.terrain,
    source: 'spice',
  };
}

// ---------- API publica ----------

export async function getSites(): Promise<LandingSite[]> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return MOCK_SITES;
  }
  const { sites } = await request<{ sites: ApiSite[] }>('/api/sites');
  return sites.map(toSite);
}

export async function getEphemeris(req: EphemerisRequest): Promise<EphemerisResponse> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return generateEphemeris(req);
  }
  const api = await request<ApiEvaluate>('/api/evaluate', {
    // Sitio del catalogo: solo site_id (asi el backend usa su horizonte precalculado con relieve real).
    // Si se mandan tambien las coordenadas, el backend ignora el site_id.
    ...(req.siteId ? { site_id: req.siteId } : { x: req.lon, y: req.lat }),
    start: req.start,
    end: req.end,
    step_min: req.stepMinutes,
    include_series: true,
  });
  return toEphemeris(api);
}
