// Que metricas se muestran y con que texto (sin React). Los valores los calcula backend.

import { formatDegrees } from '../../shared/lib/angles';
import { formatDuration, formatPercent } from '../../shared/lib/format';
import type { ScenarioMetrics } from '../../shared/types/lunar';

export interface MetricItem {
  label: string;
  value: string;
  description: string;
}

/** Las 6 que pide el slice 4: responden "hay luz?" y "hay comunicacion?" de un vistazo. */
export function mainMetrics(m: ScenarioMetrics): MetricItem[] {
  return [
    { label: 'Sol visible', value: formatPercent(m.sunVisiblePct), description: 'del tiempo de la ventana' },
    { label: 'Tierra visible', value: formatPercent(m.earthVisiblePct), description: 'del tiempo: comunicación directa' },
    { label: 'Sol y Tierra a la vez', value: formatPercent(m.sunAndEarthPct), description: 'energía y comunicación juntas' },
    { label: 'Noche más larga', value: formatDuration(m.longestDarkHours), description: 'seguida, sin Sol' },
    {
      label: 'Apagón más largo',
      value: formatDuration(m.longestEarthGapHours),
      description: 'seguido, sin la Tierra a la vista',
    },
    {
      label: 'Elevación máxima del Sol',
      value: formatDegrees(m.maxSunElevation),
      description: 'sobre el horizonte plano',
    },
  ];
}

/** El resto: detalle para quien lo busque. */
export function extraMetrics(m: ScenarioMetrics): MetricItem[] {
  return [
    {
      label: 'Energía solar',
      value: formatPercent(m.sunEnergyPct),
      description: 'tiempo con Sol, pesado por la parte del disco que se ve',
    },
    { label: 'Luz más larga', value: formatDuration(m.longestLightHours), description: 'seguida, con Sol' },
    {
      label: 'Elevación mínima del Sol',
      value: formatDegrees(m.minSunElevation),
      description: 'sobre el horizonte plano',
    },
    {
      label: 'Tiempo apto para aterrizar',
      value: formatPercent(m.candidatePct),
      description: 'Sol y Tierra despejados y con horas por delante',
    },
    {
      label: 'Sol tapado por el terreno',
      value: formatPercent(m.sunBlockedByTerrainPct),
      description: 'del tiempo, por el relieve',
    },
    {
      label: 'Tierra tapada por el terreno',
      value: formatPercent(m.earthBlockedByTerrainPct),
      description: 'del tiempo, por el relieve',
    },
  ];
}
