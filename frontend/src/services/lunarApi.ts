// Unica puerta a los datos. Con VITE_USE_MOCK=false habla con el backend real y traduce su
// respuesta (snake_case, ver docs/contrato-api.md) al modelo del front (shared/types/lunar.ts).

import type {
  BodyPosition,
  EphemerisRequest,
  EphemerisResponse,
  EphemerisSample,
  LandingSite,
  LandingWindow,
  LocalDemPatch,
  OrbitalVectors3D,
  MissionAlternative,
  MissionAlternatives,
  MissionRequest,
  SiteCategory,
  SkyEventType,
  Vec3,
} from '../shared/types/lunar';
import { azElToSkyVector } from '../shared/lib/skyVector';
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
  // Opcionales (slice B2): un sitio sin el dato no trae el campo.
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

interface ApiLocalDem {
  size: number;
  extent_m: number;
  step_m: number;
  center_z_m: number;
  min_z_m: number;
  max_z_m: number;
  heights_m: number[][];
}

interface ApiVectors3D {
  frame: string;
  moon_radius_km: number;
  positions_km: { site: Vec3; earth: Vec3; sun: Vec3 };
  unit_directions: { site: Vec3; earth: Vec3; sun: Vec3; site_to_earth: Vec3; site_to_sun: Vec3 };
}

interface ApiEvaluate {
  input: { x_lon: number; y_lat: number; start_utc: string; end_utc: string; step_min: number };
  horizon: {
    terrain: boolean;
    z_m?: number | null;
    az_step_deg: number;
    profile_deg: number[];
    local_dem?: ApiLocalDem | null;
  };
  result: {
    is_candidate: boolean;
    reasons: string[];
    landing_windows: ApiWindow[];
    best_window: ApiWindow | null;
  };
  at_start: {
    vectors_3d?: ApiVectors3D | null;
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
    sun_interference?: boolean[];
    sun_clear: boolean[];
    earth_az: number[];
    earth_el: number[];
    earth_clearance: number[];
    earth_visible: boolean[];
    earth_frac: number[];
    earth_interference?: boolean[];
    earth_clear: boolean[];
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

function toLocalDem(raw?: ApiLocalDem | null): LocalDemPatch | null {
  if (!raw) return null;
  return {
    size: raw.size,
    extentMeters: raw.extent_m,
    stepMeters: raw.step_m,
    centerElevationMeters: raw.center_z_m,
    minElevationMeters: raw.min_z_m,
    maxElevationMeters: raw.max_z_m,
    heightsMeters: raw.heights_m,
  };
}

function toVectors3D(raw?: ApiVectors3D | null): OrbitalVectors3D | null {
  if (!raw) return null;
  return {
    frame: raw.frame,
    moonRadiusKm: raw.moon_radius_km,
    sitePositionKm: raw.positions_km.site,
    sunDirection: raw.unit_directions.sun,
    earthDirection: raw.unit_directions.earth,
  };
}

function toSamples(series: ApiEvaluate['series']): EphemerisSample[] {
  return series.t_utc.map((time, i) => {
    const sunAz = series.sun_az[i];
    const sunEl = series.sun_el[i];
    const sunVisible = series.sun_frac[i] > 0;
    const sun: BodyPosition = {
      azimuth: sunAz,
      elevation: sunEl,
      horizonElevation: sunEl - series.sun_clearance[i],
      visible: sunVisible,
      visibleFraction: series.sun_frac[i],
      clear: series.sun_clear[i],
      interference: series.sun_interference ? Boolean(series.sun_interference[i]) : !sunVisible && sunEl > -0.1,
      skyVector: azElToSkyVector(sunAz, sunEl),
    };
    const earthAz = series.earth_az[i];
    const earthEl = series.earth_el[i];
    const earthVisible = series.earth_visible[i];
    const earth: BodyPosition = {
      azimuth: earthAz,
      elevation: earthEl,
      horizonElevation: earthEl - series.earth_clearance[i],
      visible: earthVisible,
      visibleFraction: series.earth_frac[i],
      clear: series.earth_clear[i],
      interference: series.earth_interference ? Boolean(series.earth_interference[i]) : !earthVisible && earthEl > -0.1,
      skyVector: azElToSkyVector(earthAz, earthEl),
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
    horizon: {
      stepDeg: api.horizon.az_step_deg,
      elevations: api.horizon.profile_deg,
      altitudeMeters: api.horizon.z_m ?? null,
      localDem: toLocalDem(api.horizon.local_dem),
    },
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
    vectors3d: toVectors3D(api.at_start.vectors_3d),
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

/**
 * Cola de calculos con SPICE (/api/evaluate y /api/mission): una peticion a la vez. SPICE no es thread-safe y
 * backend atiende cada peticion en un hilo: dos calculos simultaneos (p. ej. el comparador cargando 3
 * escenarios) tumban el proceso con SPICE(BADSUBSCRIPT). Cada calculo tarda ~0.3 s, asi que en serie apenas
 * se nota (la busqueda de fechas alternativas, ~1.5 s: por eso solo se pide con un boton).
 */
let evaluateQueue: Promise<unknown> = Promise.resolve();

function enqueueEvaluate<T>(task: () => Promise<T>): Promise<T> {
  const result = evaluateQueue.then(task);
  // Un error no debe frenar a las siguientes: la cola sigue con o sin exito.
  evaluateQueue = result.catch(() => undefined);
  return result;
}

export async function getEphemeris(req: EphemerisRequest): Promise<EphemerisResponse> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return generateEphemeris(req);
  }
  const api = await enqueueEvaluate(() => request<ApiEvaluate>('/api/evaluate', {
    // Sitio del catalogo: solo site_id (asi el backend usa su horizonte precalculado con relieve real).
    // Si se mandan tambien las coordenadas, el backend ignora el site_id.
    ...(req.siteId ? { site_id: req.siteId } : { x: req.lon, y: req.lat }),
    start: req.start,
    end: req.end,
    step_min: req.stepMinutes,
    include_series: true,
  }));
  return toEphemeris(api);
}

/** Cuantos dias antes y despues se buscan fechas alternativas: un dia lunar (el maximo de backend es 60). */
const MISSION_SEARCH_DAYS = 30;

interface ApiMissionAlternative {
  landing_utc: string;
  departure_utc: string;
  shift_days: number;
}

interface ApiMission {
  result: {
    is_candidate: boolean;
    alternatives: {
      before: ApiMissionAlternative | null;
      after: ApiMissionAlternative | null;
      search_days: number;
    };
  };
}

function toAlternative(api: ApiMissionAlternative | null): MissionAlternative | null {
  return api && { landing: api.landing_utc, departure: api.departure_utc, shiftDays: api.shift_days };
}

/**
 * Mock: prueba fechas cada medio dia hacia atras y hacia adelante con el generador sintetico y se queda con la
 * primera que sale CANDIDATO. Las reglas de mision de backend (bateria, hueco sin Tierra) no existen aqui.
 */
function mockMissionAlternatives(req: MissionRequest): MissionAlternatives {
  const durationMs = Date.parse(req.departure) - Date.parse(req.landing);
  const tryShift = (days: number): MissionAlternative | null => {
    const landing = new Date(Date.parse(req.landing) + days * 86_400_000).toISOString();
    const departure = new Date(Date.parse(landing) + durationMs).toISOString();
    const { verdict } = generateEphemeris({ ...req, start: landing, end: departure, stepMinutes: 60 });
    return verdict.isCandidate ? { landing, departure, shiftDays: days } : null;
  };
  const search = (sign: 1 | -1) => {
    for (let days = 0.5; days <= MISSION_SEARCH_DAYS; days += 0.5) {
      const found = tryShift(sign * days);
      if (found) return found;
    }
    return null;
  };
  return {
    isCandidate: tryShift(0) !== null,
    before: search(-1),
    after: search(1),
    searchDays: MISSION_SEARCH_DAYS,
  };
}

/**
 * Fechas cercanas (antes y despues) en que una mision con la misma duracion si cumple. Para "se retraso el
 * lanzamiento: que fecha cercana sirve?". Va por la misma cola que /api/evaluate.
 */
export async function getMissionAlternatives(req: MissionRequest): Promise<MissionAlternatives> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return mockMissionAlternatives(req);
  }
  const api = await enqueueEvaluate(() =>
    request<ApiMission>('/api/mission', {
      ...(req.siteId ? { site_id: req.siteId } : { x: req.lon, y: req.lat }),
      landing: req.landing,
      departure: req.departure,
      search_days: MISSION_SEARCH_DAYS,
    }),
  );
  const { is_candidate, alternatives } = api.result;
  return {
    isCandidate: is_candidate,
    before: toAlternative(alternatives.before),
    after: toAlternative(alternatives.after),
    searchDays: alternatives.search_days,
  };
}
