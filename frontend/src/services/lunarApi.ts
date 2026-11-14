import type {
  EphemerisRequest,
  EphemerisResponse,
  LandingSite,
} from '../shared/types/lunar';
import { MOCK_SITES } from '../mocks/sites.mock';
import { generateEphemeris } from '../mocks/ephemeris.mock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const USING_MOCK = USE_MOCK;
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const MOCK_DELAY_MS = 400; // para ver los estados de carga

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(path: string, params?: Record<string, string | number>) {
  const url = new URL(path, API_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function getSites(): Promise<LandingSite[]> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return MOCK_SITES;
  }
  return getJson<LandingSite[]>('/api/sites');
}

export async function getEphemeris(req: EphemerisRequest): Promise<EphemerisResponse> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return generateEphemeris(req);
  }
  return getJson<EphemerisResponse>('/api/ephemeris', {
    lat: req.lat,
    lon: req.lon,
    start: req.start,
    end: req.end,
    step: req.stepMinutes,
    ...(req.siteId ? { siteId: req.siteId } : {}),
  });
}
