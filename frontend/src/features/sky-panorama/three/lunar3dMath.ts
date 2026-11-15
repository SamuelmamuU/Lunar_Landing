import type { BodyPosition, EphemerisSample, OrbitalVectors3D, Vec3 } from '../../../shared/types/lunar';
import { azElToMoonMe, azElToSkyVector, moonMeBasis, moonMeToThree } from '../../../shared/lib/skyVector';

export { azElToMoonMe, azElToSkyVector, moonMeBasis, moonMeToThree };

export const MOON_RADIUS_KM = 1737.4;
export const MOON_RADIUS_M = 1_737_400;
export const OBSERVER_EYE_HEIGHT_M = 2.0;

export type OcclusionState = 'clear' | 'marginal' | 'interference' | 'below';

export interface OrbitalSampleDirections {
  moonRadiusKm: number;
  siteUnit: Vec3;
  sunDir: Vec3;
  earthDir: Vec3;
}

export interface DescentState {
  progress: number;
  altitudeMeters: number;
  eastOffsetMeters: number;
  northOffsetMeters: number;
  verticalSpeedMs: number;
  horizontalSpeedMs: number;
  pitchDeg: number;
  throttle: number;
  phase: 'aproximacion' | 'frenado' | 'descenso_final' | 'en_superficie';
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function bodyOcclusionState(body: BodyPosition): OcclusionState {
  if (body.clear) return 'clear';
  if (body.visible) return 'marginal';
  if (body.interference) return 'interference';
  return 'below';
}

export function skyPositionAtRadius(azDeg: number, elDeg: number, radius: number): Vec3 {
  const [x, y, z] = azElToSkyVector(azDeg, elDeg);
  return [x * radius, y * radius, z * radius];
}

function normalizeVec3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len > 1e-9 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 1, 0];
}

/** Calcula direcciones Three.js (Y=Norte lunar, Z=Meridiano 0, X=90E) para una muestra temporal. */
export function computeOrbitalDirectionsAtSample(
  latDeg: number,
  lonDeg: number,
  sample: EphemerisSample,
  fallbackVectors: OrbitalVectors3D | null,
): OrbitalSampleDirections {
  const moonRadiusKm = fallbackVectors?.moonRadiusKm ?? MOON_RADIUS_KM;
  const siteMoonMe = fallbackVectors
    ? normalizeVec3(fallbackVectors.sitePositionKm)
    : moonMeBasis(latDeg, lonDeg).up;

  const sunMoonMe = azElToMoonMe(latDeg, lonDeg, sample.sun.azimuth, sample.sun.elevation);
  const earthMoonMe = azElToMoonMe(latDeg, lonDeg, sample.earth.azimuth, sample.earth.elevation);

  return {
    moonRadiusKm,
    siteUnit: moonMeToThree(siteMoonMe),
    sunDir: moonMeToThree(sunMoonMe),
    earthDir: moonMeToThree(earthMoonMe),
  };
}

/** Curva cinematica suave de descenso lunar desde 5000 m hasta 2 m en superficie. */
export function computeDescentState(progress01: number): DescentState {
  const t = clamp01(progress01);
  const rem = 1 - t;
  const altitudeMeters =
    OBSERVER_EYE_HEIGHT_M + 4998 * (0.65 * Math.pow(rem, 2.2) + 0.35 * Math.pow(rem, 3.6));

  // Trayectoria lateral de aproximacion que termina vertical sobre (0, 0) a partir de t=0.82
  const latFactor = t < 0.82 ? Math.pow(1 - t / 0.82, 2.1) : 0;
  const eastOffsetMeters = -1800 * latFactor;
  const northOffsetMeters = -950 * latFactor;

  const verticalSpeedMs = t >= 0.999 ? 0 : 1.4 + 44 * Math.pow(rem, 1.45);
  const horizontalSpeedMs = t < 0.82 ? 68 * Math.pow(1 - t / 0.82, 1.2) : 0;
  const pitchDeg = t < 0.78 ? 36 * Math.pow(1 - t / 0.78, 1.3) : 0;

  let throttle = 0;
  let phase: DescentState['phase'] = 'en_superficie';
  if (t < 0.35) {
    phase = 'aproximacion';
    throttle = 0.45 + 0.35 * (t / 0.35);
  } else if (t < 0.78) {
    phase = 'frenado';
    throttle = 0.85;
  } else if (t < 0.995) {
    phase = 'descenso_final';
    throttle = 0.35 + 0.25 * (1 - (t - 0.78) / 0.22);
  }

  return {
    progress: t,
    altitudeMeters,
    eastOffsetMeters,
    northOffsetMeters,
    verticalSpeedMs,
    horizontalSpeedMs,
    pitchDeg,
    throttle,
    phase,
  };
}
