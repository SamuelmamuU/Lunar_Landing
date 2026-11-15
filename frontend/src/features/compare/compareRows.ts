// Filas de la tabla del comparador (sin React): valor formateado, si es el mejor y largo de su barra.
// Los numeros vienen de backend; aqui solo se comparan.

import { formatMetric, type MetricDefinition } from '../../shared/lib/metrics';
import type { ScenarioMetrics } from '../../shared/types/lunar';

export interface CompareCellData {
  text: string;
  isBest: boolean;
  /** 0..1, largo de la barra. null = la metrica no lleva barra (grados: pueden ser negativos). */
  barFraction: number | null;
}

export interface CompareRowData {
  definition: MetricDefinition;
  /** Una celda por escenario, en orden. null = ese escenario aun no tiene datos. */
  cells: (CompareCellData | null)[];
}

/**
 * Indices de los escenarios con el mejor valor. Se compara lo que se muestra (texto redondeado): dos "47%"
 * empatan aunque backend mande 47.04 y 46.98. Sin ganador si hay menos de 2 con datos o si todos empatan.
 */
function bestIndices(definition: MetricDefinition, list: (ScenarioMetrics | null)[]): Set<number> {
  const loaded = list.flatMap((metrics, index) => (metrics ? [{ index, metrics }] : []));
  if (loaded.length < 2) return new Set();

  const sign = definition.better === 'higher' ? 1 : -1;
  const best = loaded.reduce((a, b) =>
    sign * b.metrics[definition.key] > sign * a.metrics[definition.key] ? b : a,
  );
  const bestText = formatMetric(definition, best.metrics);
  const winners = loaded.filter(({ metrics }) => formatMetric(definition, metrics) === bestText);
  return winners.length === loaded.length ? new Set() : new Set(winners.map(({ index }) => index));
}

/**
 * Largo de la barra. Porcentajes sobre 0..100 (la misma escala en toda la app); duraciones sobre la mayor de
 * la fila, para que las barras de una fila compartan escala.
 */
function barFractions(definition: MetricDefinition, list: (ScenarioMetrics | null)[]): (number | null)[] {
  const values = list.map((metrics) => (metrics ? metrics[definition.key] : 0));
  switch (definition.kind) {
    case 'percent':
      return values.map((v) => Math.min(1, Math.max(0, v / 100)));
    case 'duration': {
      const max = Math.max(...values);
      return values.map((v) => (max > 0 ? v / max : 0));
    }
    case 'degrees':
      return values.map(() => null);
  }
}

/** Una fila por metrica; cada fila con una celda por escenario. */
export function buildCompareRows(
  definitions: MetricDefinition[],
  list: (ScenarioMetrics | null)[],
): CompareRowData[] {
  return definitions.map((definition) => {
    const best = bestIndices(definition, list);
    const bars = barFractions(definition, list);
    return {
      definition,
      cells: list.map((metrics, index) =>
        metrics
          ? { text: formatMetric(definition, metrics), isBest: best.has(index), barFraction: bars[index] }
          : null,
      ),
    };
  });
}
