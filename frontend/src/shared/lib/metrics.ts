// Que metricas se muestran, con que texto y cual valor es mejor (sin React). Los valores los calcula backend;
// aqui solo se nombran y se formatean. Lo usan el panel de metricas y el comparador.

import type { ScenarioMetrics } from '../types/lunar';
import { formatDegrees } from './angles';
import { formatDuration, formatPercent } from './format';

export type MetricKey = keyof ScenarioMetrics;

/** percent: 0..100. duration: horas. degrees: grados. */
export type MetricKind = 'percent' | 'duration' | 'degrees';

/** Para el comparador: que valor gana. Mas Sol y mas Tierra es mejor; noches y apagones, cuanto mas cortos mejor. */
export type BetterWhen = 'higher' | 'lower';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  /** A que se refiere el numero. */
  description: string;
  kind: MetricKind;
  better: BetterWhen;
}

/** Las 6 principales: responden "hay luz?" y "hay comunicacion?" de un vistazo. */
export const MAIN_METRICS: MetricDefinition[] = [
  {
    key: 'sunVisiblePct',
    label: 'Sol visible',
    description: 'del tiempo de la ventana',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'earthVisiblePct',
    label: 'Tierra visible',
    description: 'del tiempo: comunicación directa',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'sunAndEarthPct',
    label: 'Sol y Tierra a la vez',
    description: 'energía y comunicación juntas',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'longestDarkHours',
    label: 'Noche más larga',
    description: 'seguida, sin Sol',
    kind: 'duration',
    better: 'lower',
  },
  {
    key: 'longestEarthGapHours',
    label: 'Apagón más largo',
    description: 'seguido, sin la Tierra a la vista',
    kind: 'duration',
    better: 'lower',
  },
  {
    key: 'maxSunElevation',
    label: 'Elevación máxima del Sol',
    description: 'sobre el horizonte plano',
    kind: 'degrees',
    better: 'higher',
  },
];

/** El resto: detalle para quien lo busque. */
export const EXTRA_METRICS: MetricDefinition[] = [
  {
    key: 'sunEnergyPct',
    label: 'Energía solar',
    description: 'tiempo con Sol, pesado por la parte del disco que se ve',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'longestLightHours',
    label: 'Luz más larga',
    description: 'seguida, con Sol',
    kind: 'duration',
    better: 'higher',
  },
  {
    key: 'minSunElevation',
    label: 'Elevación mínima del Sol',
    description: 'sobre el horizonte plano',
    kind: 'degrees',
    better: 'higher',
  },
  {
    key: 'candidatePct',
    label: 'Tiempo apto para aterrizar',
    description: 'Sol y Tierra despejados y con horas por delante',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'sunBlockedByTerrainPct',
    label: 'Sol tapado por el terreno',
    description: 'del tiempo, por el relieve',
    kind: 'percent',
    better: 'lower',
  },
  {
    key: 'earthBlockedByTerrainPct',
    label: 'Tierra tapada por el terreno',
    description: 'del tiempo, por el relieve',
    kind: 'percent',
    better: 'lower',
  },
];

/** Valor de una metrica listo para mostrar: "47.3%", "13 d 5 h", "2.5°". */
export function formatMetric(definition: MetricDefinition, metrics: ScenarioMetrics): string {
  const value = metrics[definition.key];
  switch (definition.kind) {
    case 'percent':
      return formatPercent(value);
    case 'duration':
      return formatDuration(value);
    case 'degrees':
      return formatDegrees(value);
  }
}

export interface MetricItem {
  label: string;
  value: string;
  description: string;
}

/** Definiciones + valores -> lo que pinta una tarjeta. */
export function metricItems(definitions: MetricDefinition[], metrics: ScenarioMetrics): MetricItem[] {
  return definitions.map((definition) => ({
    label: definition.label,
    value: formatMetric(definition, metrics),
    description: definition.description,
  }));
}
