// Escalas y trazos de la linea de tiempo (sin React): de tiempo y grados a pixeles del SVG.
// El SVG mide lo mismo que su contenedor (1 unidad = 1 px). Eje X = tiempo de la ventana; eje Y = elevacion
// (un solo eje: Sol y Tierra estan en grados). Debajo de la grafica van dos bandas, una por cuerpo, con su
// estado de visibilidad. Todo sale de `samples` de backend: aqui no se recalcula nada.

import { BODY_IDS, type BodyId } from '../../shared/lib/bodies';
import { formatDuration } from '../../shared/lib/format';
import { linkState, type LinkState } from '../../shared/lib/visibility';
import type { EphemerisSample } from '../../shared/types/lunar';

/** Alto total del SVG en px (igual a la clase h-58 del contenedor). */
export const TIMELINE_HEIGHT = 232;

const MARGIN = { top: 30, right: 16, left: 56 };
const PLOT_BOTTOM = 160;
const BAND_HEIGHT = 10;
const BAND_GAP = 6;
const PLOT_TO_BANDS = 14;
/** Rango minimo del eje Y, para que una ventana casi plana no exagere el ruido. */
const MIN_SPAN_DEG = 2;
const ELEVATION_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 45];
const MAX_ELEVATION_TICKS = 5;
const TIME_STEPS_HOURS = [1, 2, 3, 6, 12, 24, 48, 72, 120, 168, 240];
/** Separacion minima entre rotulos de tiempo, en px. */
const MIN_TICK_SPACING_PX = 72;
const HOUR_MS = 3_600_000;

export interface TimelineScale {
  width: number;
  height: number;
  /** Bordes del area de la grafica de elevacion. */
  left: number;
  right: number;
  top: number;
  plotBottom: number;
  /** Borde superior de la banda de cada cuerpo. */
  bandY: Record<BodyId, number>;
  bandHeight: number;
  bandsBottom: number;
  startMs: number;
  endMs: number;
  minElevation: number;
  maxElevation: number;
  x: (ms: number) => number;
  y: (elevation: number) => number;
  /** Pixel X -> indice de la muestra mas cercana. */
  indexAt: (x: number) => number;
  /** Indice de muestra -> pixel X. */
  xAtIndex: (index: number) => number;
}

export function createTimelineScale(samples: EphemerisSample[], width: number): TimelineScale {
  const startMs = Date.parse(samples[0].time);
  const endMs = Date.parse(samples[samples.length - 1].time);
  const durationMs = Math.max(1, endMs - startMs);
  const lastIndex = samples.length - 1;

  let low = 0;
  let high = 0;
  for (const sample of samples) {
    for (const id of BODY_IDS) {
      low = Math.min(low, sample[id].elevation);
      high = Math.max(high, sample[id].elevation);
    }
  }
  const missing = Math.max(0, MIN_SPAN_DEG - (high - low));
  low -= missing / 2;
  high += missing / 2;
  const pad = (high - low) * 0.08;
  const minElevation = low - pad;
  const maxElevation = high + pad;

  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const plotBottom = PLOT_BOTTOM;
  const sunBand = plotBottom + PLOT_TO_BANDS;
  const earthBand = sunBand + BAND_HEIGHT + BAND_GAP;

  const x = (ms: number) => left + ((ms - startMs) / durationMs) * (right - left);

  return {
    width,
    height: TIMELINE_HEIGHT,
    left,
    right,
    top,
    plotBottom,
    bandY: { sun: sunBand, earth: earthBand },
    bandHeight: BAND_HEIGHT,
    bandsBottom: earthBand + BAND_HEIGHT,
    startMs,
    endMs,
    minElevation,
    maxElevation,
    x,
    y: (elevation) => plotBottom - ((elevation - minElevation) / (maxElevation - minElevation)) * (plotBottom - top),
    indexAt: (px) => {
      const fraction = (px - left) / (right - left);
      return Math.min(lastIndex, Math.max(0, Math.round(fraction * lastIndex)));
    },
    xAtIndex: (index) => left + (lastIndex === 0 ? 0 : (index / lastIndex) * (right - left)),
  };
}

/** Marcas redondas del eje de elevacion (grados). */
export function elevationTicks(scale: TimelineScale): number[] {
  const span = scale.maxElevation - scale.minElevation;
  const step = ELEVATION_STEPS.find((s) => span / s <= MAX_ELEVATION_TICKS) ?? 90;
  const ticks: number[] = [];
  for (let tick = Math.ceil(scale.minElevation / step) * step; tick <= scale.maxElevation; tick += step) {
    ticks.push(Number(tick.toFixed(2)));
  }
  return ticks;
}

export interface TimeTick {
  ms: number;
  label: string;
}

/**
 * Marcas del eje de tiempo, contadas desde el inicio de la ventana ("5 d", "12 h"): es como se habla de una
 * mision ("el Sol se pone en 13 dias") y no hace falta leer fechas.
 */
export function timeTicks(scale: TimelineScale): TimeTick[] {
  const hours = (scale.endMs - scale.startMs) / HOUR_MS;
  const maxTicks = Math.max(1, Math.floor((scale.right - scale.left) / MIN_TICK_SPACING_PX));
  const step = TIME_STEPS_HOURS.find((s) => hours / s <= maxTicks) ?? TIME_STEPS_HOURS[TIME_STEPS_HOURS.length - 1];
  const ticks: TimeTick[] = [];
  for (let offset = 0; offset <= hours + 1e-9; offset += step) {
    ticks.push({ ms: scale.startMs + offset * HOUR_MS, label: offset === 0 ? 'Start' : formatDuration(offset) });
  }
  return ticks;
}

/** "+13 d 4 h desde el inicio" (o "Inicio de la ventana"). */
export function offsetLabel(time: string, startMs: number): string {
  const hours = (Date.parse(time) - startMs) / HOUR_MS;
  return hours < 1 / 60 ? 'Window start' : `+${formatDuration(hours)} from start`;
}

const point = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;

/**
 * Linea de elevacion de un cuerpo. Con `visibleOnly`, solo los tramos en que backend lo da por visible (un
 * tramo por cada vez que aparece); sin el, toda la ventana.
 */
export function elevationPath(
  samples: EphemerisSample[],
  id: BodyId,
  scale: TimelineScale,
  visibleOnly = false,
): string {
  const segments: string[][] = [];
  let current: string[] = [];
  samples.forEach((sample, index) => {
    if (visibleOnly && !sample[id].visible) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push(point(scale.xAtIndex(index), scale.y(sample[id].elevation)));
  });
  segments.push(current);

  return segments
    .filter((segment) => segment.length > 1)
    .map((segment) => `M${segment.join('L')}`)
    .join('');
}

/** Tramo continuo con el mismo estado de visibilidad. */
export interface LinkRun {
  state: LinkState;
  startMs: number;
  endMs: number;
}

/**
 * Tramos de visibilidad de un cuerpo para su banda. Cada muestra cubre medio paso a cada lado (recortado a la
 * ventana) y las seguidas con el mismo estado se juntan.
 */
export function linkRuns(samples: EphemerisSample[], id: BodyId): LinkRun[] {
  if (samples.length === 0) return [];
  const times = samples.map((sample) => Date.parse(sample.time));
  const first = times[0];
  const last = times[times.length - 1];
  const half = times.length > 1 ? (times[1] - times[0]) / 2 : 0;

  const runs: LinkRun[] = [];
  samples.forEach((sample, index) => {
    const state = linkState(sample[id]);
    const startMs = Math.max(first, times[index] - half);
    const endMs = Math.min(last, times[index] + half);
    const previous = runs[runs.length - 1];
    if (previous && previous.state === state) previous.endMs = endMs;
    else runs.push({ state, startMs, endMs });
  });
  return runs;
}
