// Contrato de datos entre front y back.
// Convenciones (acordarlas con backend):
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
  /** true si el centro del disco esta sobre el horizonte del terreno. */
  visible: boolean;
  /** 0..1, porcion del disco por encima del terreno (util para el Sol y potencia). */
  visibleFraction: number;
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

export interface EphemerisResponse {
  lat: number;
  lon: number;
  start: string;
  end: string;
  stepMinutes: number;
  horizon: HorizonProfile;
  samples: EphemerisSample[];
  /** De donde salen los datos. 'mock' = sinteticos, NO usar para decisiones reales. */
  source: 'mock' | 'horizons' | 'spice' | 'other';
}

/** Un escenario = sitio + ventana de fechas. Es la unidad que se compara. */
export interface Scenario {
  id: string;
  site: LandingSite;
  start: string;
  durationDays: number;
  stepMinutes: number;
}
