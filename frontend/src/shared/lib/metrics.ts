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
    label: 'Sun visible',
    description: 'of the window time',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'earthVisiblePct',
    label: 'Earth visible',
    description: 'of the time: direct communication',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'sunAndEarthPct',
    label: 'Sun and Earth together',
    description: 'power and communication at once',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'longestDarkHours',
    label: 'Longest night',
    description: 'continuous, without Sun',
    kind: 'duration',
    better: 'lower',
  },
  {
    key: 'longestEarthGapHours',
    label: 'Longest blackout',
    description: 'continuous, Earth out of view',
    kind: 'duration',
    better: 'lower',
  },
  {
    key: 'maxSunElevation',
    label: 'Max Sun elevation',
    description: 'above the flat horizon',
    kind: 'degrees',
    better: 'higher',
  },
];

/** El resto: detalle para quien lo busque. */
export const EXTRA_METRICS: MetricDefinition[] = [
  {
    key: 'sunEnergyPct',
    label: 'Solar energy',
    description: 'time with Sun, weighted by the visible disc',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'longestLightHours',
    label: 'Longest daylight',
    description: 'continuous, with Sun',
    kind: 'duration',
    better: 'higher',
  },
  {
    key: 'minSunElevation',
    label: 'Min Sun elevation',
    description: 'above the flat horizon',
    kind: 'degrees',
    better: 'higher',
  },
  {
    key: 'candidatePct',
    label: 'Time suitable for landing',
    description: 'Sun and Earth clear, with hours ahead',
    kind: 'percent',
    better: 'higher',
  },
  {
    key: 'sunBlockedByTerrainPct',
    label: 'Sun blocked by terrain',
    description: 'of the time, by the relief',
    kind: 'percent',
    better: 'lower',
  },
  {
    key: 'earthBlockedByTerrainPct',
    label: 'Earth blocked by terrain',
    description: 'of the time, by the relief',
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
