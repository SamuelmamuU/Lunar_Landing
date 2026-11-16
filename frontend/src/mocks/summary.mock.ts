// Solo para el mock: calcula metricas, eventos y veredicto a partir de las muestras sinteticas,
// con las mismas reglas que el backend (docs/contrato-api.md, seccion 2), para que el mock devuelva
// el mismo modelo que la API real. Con backend real nada de esto se usa: esos datos llegan calculados.

import type {
  EphemerisResponse,
  EphemerisSample,
  LandingWindow,
  NextEvents,
  SkyEvent,
} from '../shared/types/lunar';

const EPSILON_DEG = 0.5;
const MIN_LIGHT_HOURS = 72;
const MIN_COMM_HOURS = 24;

type Summary = Pick<EphemerisResponse, 'metrics' | 'events' | 'next' | 'verdict'>;

const pct = (flags: boolean[]) =>
  flags.length === 0 ? 0 : Math.round((flags.filter(Boolean).length / flags.length) * 10000) / 100;

function longestRun(flags: boolean[], want: boolean): number {
  let best = 0;
  let run = 0;
  for (const f of flags) {
    run = f === want ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Para cada muestra: cuantas muestras seguidas sigue siendo true desde ahi. */
function runsAhead(flags: boolean[]): number[] {
  const out = new Array<number>(flags.length).fill(0);
  let run = 0;
  for (let i = flags.length - 1; i >= 0; i--) {
    run = flags[i] ? run + 1 : 0;
    out[i] = run;
  }
  return out;
}

function firstChange(flags: boolean[]): number | null {
  const i = flags.findIndex((f) => f !== flags[0]);
  return i === -1 ? null : i;
}

export function summarize(samples: EphemerisSample[], stepMinutes: number): Summary {
  const stepHours = stepMinutes / 60;
  const lit = samples.map((s) => s.sun.visibleFraction > 0);
  const earth = samples.map((s) => s.earth.visible);
  const sunClear = samples.map((s) => s.sun.elevation - s.sun.horizonElevation >= EPSILON_DEG);
  const earthClear = samples.map((s) => s.earth.elevation - s.earth.horizonElevation >= EPSILON_DEG);
  const sunElevations = samples.map((s) => s.sun.elevation);

  // Eventos: cambio de estado entre muestras consecutivas (precision = un paso; el backend da ~1 s).
  const events: SkyEvent[] = [];
  for (let i = 1; i < samples.length; i++) {
    if (lit[i] !== lit[i - 1]) events.push({ time: samples[i].time, type: lit[i] ? 'sunrise' : 'sunset' });
    if (earth[i] !== earth[i - 1]) {
      events.push({ time: samples[i].time, type: earth[i] ? 'earthrise' : 'earthset' });
    }
  }

  const sunChange = firstChange(lit);
  const earthChange = firstChange(earth);
  const next: NextEvents = {
    sunEvent: sunChange === null ? null : lit[0] ? 'sunset' : 'sunrise',
    sunEventTime: sunChange === null ? null : samples[sunChange].time,
    hoursToSunEvent: sunChange === null ? null : sunChange * stepHours,
    earthEvent: earthChange === null ? null : earth[0] ? 'earthset' : 'earthrise',
    earthEventTime: earthChange === null ? null : samples[earthChange].time,
    hoursToEarthEvent: earthChange === null ? null : earthChange * stepHours,
  };

  // Candidato: Sol y Tierra despejados y con horas suficientes por delante
  // (si la racha llega al final de la ventana, se da por cumplida).
  const sunAhead = runsAhead(lit);
  const earthAhead = runsAhead(earth);
  const last = samples.length - 1;
  const candidate = samples.map((_, i) => {
    const lightOk = sunAhead[i] * stepHours >= MIN_LIGHT_HOURS || i + sunAhead[i] > last;
    const commOk = earthAhead[i] * stepHours >= MIN_COMM_HOURS || i + earthAhead[i] > last;
    return sunClear[i] && earthClear[i] && lightOk && commOk;
  });

  const landingWindows: LandingWindow[] = [];
  let startIndex: number | null = null;
  candidate.forEach((ok, i) => {
    if (ok && startIndex === null) startIndex = i;
    if (startIndex !== null && (!ok || i === last)) {
      const endIndex = ok ? i : i - 1;
      landingWindows.push({
        start: samples[startIndex].time,
        end: samples[endIndex].time,
        durationHours: (endIndex - startIndex + 1) * stepHours,
      });
      startIndex = null;
    }
  });

  const reasons: string[] = [];
  if (landingWindows.length === 0) {
    if (!sunClear.some(Boolean)) reasons.push('The Sun is never clear (≥ ε) in the range');
    if (!earthClear.some(Boolean)) reasons.push('The Earth is never clear (≥ ε) in the range');
    if (reasons.length === 0) {
      reasons.push('The Sun and Earth are not both clear with sufficient light and communication ahead');
    }
  }

  const energy = samples.reduce((sum, s) => sum + s.sun.visibleFraction, 0);
  return {
    metrics: {
      sunVisiblePct: pct(lit),
      sunEnergyPct: samples.length === 0 ? 0 : Math.round((energy / samples.length) * 10000) / 100,
      earthVisiblePct: pct(earth),
      sunAndEarthPct: pct(lit.map((l, i) => l && earth[i])),
      longestLightHours: longestRun(lit, true) * stepHours,
      longestDarkHours: longestRun(lit, false) * stepHours,
      longestEarthGapHours: longestRun(earth, false) * stepHours,
      // El mock no distingue "bajo el horizonte liso" de "tapado por una montana".
      sunBlockedByTerrainPct: 0,
      earthBlockedByTerrainPct: 0,
      maxSunElevation: Math.max(...sunElevations),
      minSunElevation: Math.min(...sunElevations),
      candidatePct: pct(candidate),
    },
    events,
    next,
    verdict: {
      isCandidate: landingWindows.length > 0,
      reasons,
      landingWindows,
      bestWindow: landingWindows.reduce<LandingWindow | null>(
        (best, w) => (best === null || w.durationHours > best.durationHours ? w : best),
        null,
      ),
    },
  };
}
