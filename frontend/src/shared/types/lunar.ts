// Modelo de datos del front. El contrato con backend esta en docs/contrato-api.md (raiz del repo);
// services/lunarApi.ts traduce la respuesta del backend (snake_case) a estos tipos.
// Convenciones (las mismas que backend):
//   - Angulos en grados.
//   - lat: -90..90 (sur negativo). lon: -180..180 (este positivo).
//   - azimuth: 0..360, medido desde el norte local en sentido horario (0=N, 90=E).
//   - elevation: angulo sobre el horizonte matematico (plano tangente). Puede ser negativo.
//   - Tiempos en ISO 8601 UTC ("2026-11-14T18:00:00.000Z").

export type SiteCategory =
  | 'apollo'
  | 'clps'
  | 'artemis'
  | 'international'
  | 'reference'
  | 'custom';

export interface LandingSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: SiteCategory;
  mission?: string;
  agency?: string;
  /** Fecha de alunizaje real (si ya ocurrio), ISO. */
  landedAt?: string;
  description?: string;
}

/** Perfil del horizonte por terreno: que tan alto se ve el terreno en cada direccion. */
export interface HorizonProfile {
  /** Separacion entre muestras en grados de azimut (ej. 1 => 360 valores). */
  stepDeg: number;
  /** elevations[i] = elevacion del terreno (grados) en azimut i * stepDeg. */
  elevations: number[];
}

export interface BodyPosition {
  azimuth: number;
  elevation: number;
  /** Elevacion del terreno en el azimut de este cuerpo. */
  horizonElevation: number;
  /** Sol: asoma alguna parte del disco. Tierra: el centro del disco esta sobre el terreno. */
  visible: boolean;
  /** 0..1, porcion del disco por encima del terreno (util para el Sol y potencia). */
  visibleFraction: number;
  /**
   * Despejado segun backend (sun_clear / earth_clear): visible con margen de seguridad sobre el relieve.
   * Lo decide backend mirando cuanto del disco tapa el terreno; el front no lo recalcula.
   */
  clear: boolean;
}

export interface EphemerisSample {
  time: string;
  sun: BodyPosition;
  earth: BodyPosition;
}

export interface EphemerisRequest {
  lat: number;
  lon: number;
  start: string;
  end: string;
  stepMinutes: number;
  /** Opcional: si el sitio es del catalogo. */
  siteId?: string;
}

export type SkyEventType = 'sunrise' | 'sunset' | 'earthrise' | 'earthset';

/** Salida o puesta del Sol o de la Tierra dentro de la ventana. */
export interface SkyEvent {
  time: string;
  type: SkyEventType;
}

/** Proximo cambio desde el inicio de la ventana. null = no cambia en los proximos 60 dias. */
export interface NextEvents {
  sunEvent: 'sunset' | 'sunrise' | null;
  sunEventTime: string | null;
  hoursToSunEvent: number | null;
  earthEvent: 'earthset' | 'earthrise' | null;
  earthEventTime: string | null;
  hoursToEarthEvent: number | null;
}

/** Metricas de toda la ventana. Porcentajes 0..100, duraciones en horas, elevaciones en grados. */
export interface ScenarioMetrics {
  sunVisiblePct: number;
  /** Como sunVisiblePct, pero pesado por la fraccion de disco visible (energia). */
  sunEnergyPct: number;
  earthVisiblePct: number;
  sunAndEarthPct: number;
  longestLightHours: number;
  longestDarkHours: number;
  longestEarthGapHours: number;
  sunBlockedByTerrainPct: number;
  earthBlockedByTerrainPct: number;
  maxSunElevation: number;
  minSunElevation: number;
  /** % del tiempo en que se podria aterrizar (Sol y Tierra despejados y con horas por delante). */
  candidatePct: number;
}

export interface LandingWindow {
  start: string;
  end: string;
  durationHours: number;
}

/** Veredicto de la ventana: hay al menos un tramo donde se puede aterrizar? */
export interface Verdict {
  isCandidate: boolean;
  /** Motivos cuando no es candidato (texto listo para mostrar). */
  reasons: string[];
  landingWindows: LandingWindow[];
  bestWindow: LandingWindow | null;
}

export interface EphemerisResponse {
  lat: number;
  lon: number;
  start: string;
  end: string;
  stepMinutes: number;
  horizon: HorizonProfile;
  samples: EphemerisSample[];
  metrics: ScenarioMetrics;
  events: SkyEvent[];
  next: NextEvents;
  verdict: Verdict;
  /** false = sin relieve real para este punto (esfera lisa): avisar en la UI. */
  terrain: boolean;
  /** De donde salen los datos. 'mock' = sinteticos, NO usar para decisiones reales. */
  source: 'mock' | 'spice';
}

/** Un escenario = sitio + ventana de fechas. Es la unidad que se compara. */
export interface Scenario {
  id: string;
  site: LandingSite;
  start: string;
  durationDays: number;
  stepMinutes: number;
}
