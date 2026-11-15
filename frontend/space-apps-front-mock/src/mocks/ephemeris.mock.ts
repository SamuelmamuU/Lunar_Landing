//DATOS MOCKUP

import type {
  BodyPosition,
  EphemerisRequest,
  EphemerisResponse,
  EphemerisSample,
  HorizonProfile,
} from '../shared/types/lunar';
import { MOCK_TERRAIN, type MockTerrain } from './sites.mock';

const DEG = Math.PI / 180;
const DAY_MS = 86_400_000;

// Sol
const SYNODIC_DAYS = 29.530588853;
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14); // luna nueva de referencia
const SUN_LAT_AMP = 1.54; // inclinacion ecuador lunar vs ecliptica
const ECLIPSE_YEAR_DAYS = 346.62;
const SUN_RADIUS_DEG = 0.267;

// Tierra (libracion optica, fases arbitrarias)
const LIB_LON_AMP = 7.9;
const LIB_LON_PERIOD = 27.554551; // mes anomalistico
const LIB_LAT_AMP = 6.68;
const LIB_LAT_PERIOD = 27.212221; // mes draconitico
const EARTH_RADIUS_DEG = 0.95;

const MAX_SAMPLES = 20_000;

// ---------- utilidades ----------

const norm360 = (deg: number) => ((deg % 360) + 360) % 360;
const norm180 = (deg: number) => norm360(deg + 180) - 180;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- posiciones ----------

/** Punto subsolar (lat, lon selenograficas) en un instante. */
export function subSolarPoint(timeMs: number) {
  const days = (timeMs - REF_NEW_MOON_MS) / DAY_MS;
  const phase = (days / SYNODIC_DAYS) % 1; // 0 = luna nueva, 0.5 = llena
  const lon = norm180(180 - 360 * phase);
  const lat = SUN_LAT_AMP * Math.sin((2 * Math.PI * days) / ECLIPSE_YEAR_DAYS);
  return { lat, lon };
}

/** Punto subterrestre (donde la Tierra esta en el cenit), por libracion. */
export function subEarthPoint(timeMs: number) {
  const days = (timeMs - REF_NEW_MOON_MS) / DAY_MS;
  const lon = LIB_LON_AMP * Math.sin((2 * Math.PI * days) / LIB_LON_PERIOD);
  const lat = LIB_LAT_AMP * Math.sin((2 * Math.PI * days) / LIB_LAT_PERIOD + 1.1);
  return { lat, lon };
}

/** Azimut/elevacion de un cuerpo lejano visto desde (lat, lon). */
export function altAz(siteLat: number, siteLon: number, subLat: number, subLon: number) {
  const phi = siteLat * DEG;
  const beta = subLat * DEG;
  const dL = (subLon - siteLon) * DEG;
  const sinEl =
    Math.sin(phi) * Math.sin(beta) + Math.cos(phi) * Math.cos(beta) * Math.cos(dL);
  const elevation = Math.asin(clamp(sinEl, -1, 1)) / DEG;
  const y = Math.sin(dL) * Math.cos(beta);
  const x = Math.cos(phi) * Math.sin(beta) - Math.sin(phi) * Math.cos(beta) * Math.cos(dL);
  const azimuth = norm360(Math.atan2(y, x) / DEG);
  return { azimuth, elevation };
}

// ---------- horizonte ----------

const TERRAIN_PARAMS: Record<MockTerrain, { base: number; amp: number }> = {
  peak: { base: -1.3, amp: 0.8 }, // desde una cima el horizonte queda por debajo de 0
  ridge: { base: -0.6, amp: 0.8 },
  plain: { base: 0.8, amp: 1.4 },
  crater: { base: 4.0, amp: 2.5 },
};

function terrainFor(siteId?: string): MockTerrain {
  return (siteId && MOCK_TERRAIN[siteId]) || 'plain';
}

export function generateHorizon(
  lat: number,
  lon: number,
  siteId?: string,
  stepDeg = 1,
): HorizonProfile {
  const terrain = terrainFor(siteId);
  const { base, amp } = TERRAIN_PARAMS[terrain];
  // Interior de Shackleton: paredes de ~20 grados.
  const extra = siteId === 'shackleton-floor' ? 15 : 0;
  const rand = mulberry32(hashString(`${lat.toFixed(3)},${lon.toFixed(3)}`));

  const harmonics = Array.from({ length: 7 }, (_, i) => ({
    k: i + 1,
    a: (amp / (i + 1)) * (0.5 + rand()),
    p: rand() * 2 * Math.PI,
  }));

  const n = Math.round(360 / stepDeg);
  const elevations = Array.from({ length: n }, (_, i) => {
    const az = i * stepDeg * DEG;
    let h = base + extra;
    for (const { k, a, p } of harmonics) h += a * Math.sin(k * az + p);
    h += (rand() - 0.5) * 0.15 * amp; // ruido fino
    return round(h, 2);
  });

  return { stepDeg, elevations };
}

/** Elevacion del terreno en un azimut cualquiera (interpolacion lineal). */
export function horizonAt(profile: HorizonProfile, azimuth: number): number {
  const { stepDeg, elevations } = profile;
  const x = norm360(azimuth) / stepDeg;
  const i0 = Math.floor(x) % elevations.length;
  const i1 = (i0 + 1) % elevations.length;
  const t = x - Math.floor(x);
  return elevations[i0] * (1 - t) + elevations[i1] * t;
}

function bodyPosition(
  pos: { azimuth: number; elevation: number },
  horizon: HorizonProfile,
  radiusDeg: number,
): BodyPosition {
  const h = horizonAt(horizon, pos.azimuth);
  const visibleFraction = clamp((pos.elevation - h + radiusDeg) / (2 * radiusDeg), 0, 1);
  return {
    azimuth: round(pos.azimuth),
    elevation: round(pos.elevation),
    horizonElevation: round(h),
    visible: pos.elevation > h,
    visibleFraction: round(visibleFraction),
  };
}

// ---------- API publica del mock ----------

export function sampleAt(
  lat: number,
  lon: number,
  timeMs: number,
  horizon: HorizonProfile,
): EphemerisSample {
  const s = subSolarPoint(timeMs);
  const e = subEarthPoint(timeMs);
  return {
    time: new Date(timeMs).toISOString(),
    sun: bodyPosition(altAz(lat, lon, s.lat, s.lon), horizon, SUN_RADIUS_DEG),
    earth: bodyPosition(altAz(lat, lon, e.lat, e.lon), horizon, EARTH_RADIUS_DEG),
  };
}

export function generateEphemeris(req: EphemerisRequest): EphemerisResponse {
  const startMs = Date.parse(req.start);
  const endMs = Date.parse(req.end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    throw new Error('Rango de fechas invalido');
  }
  if (req.lat < -90 || req.lat > 90 || req.lon < -180 || req.lon > 180) {
    throw new Error('Coordenadas fuera de rango');
  }
  const stepMs = Math.max(1, req.stepMinutes) * 60_000;
  const count = Math.floor((endMs - startMs) / stepMs) + 1;
  if (count > MAX_SAMPLES) {
    throw new Error(`Demasiadas muestras (${count}). Sube stepMinutes o reduce el rango.`);
  }

  const horizon = generateHorizon(req.lat, req.lon, req.siteId);
  const samples: EphemerisSample[] = [];
  for (let i = 0; i < count; i++) {
    samples.push(sampleAt(req.lat, req.lon, startMs + i * stepMs, horizon));
  }

  return {
    lat: req.lat,
    lon: req.lon,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    stepMinutes: req.stepMinutes,
    horizon,
    samples,
    source: 'mock',
  };
}
