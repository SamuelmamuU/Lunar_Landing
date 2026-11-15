import { useMemo } from 'react';
import { useAppStore } from '../../app/store';
import { compassPoint } from '../../shared/lib/angles';
import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { sampleAt } from '../../shared/lib/ephemeris';
import { BodyReadout } from './BodyReadout';
import { LinkLegend } from './LinkLegend';
import { PanoramaChart } from './PanoramaChart';
import { TopView } from './TopView';
import { describeVisibility } from './bodyStatus';
import { createScale } from './panoramaScale';

/**
 * Slice 3: donde estan el Sol y la Tierra respecto al terreno en el instante elegido (currentTime, o
 * el inicio de la ventana si no se ha movido la linea de tiempo). Panorama arriba (explica el por que:
 * alturas y relieve) y vista desde arriba al lado del texto (responde el que: hay luz y enlace?).
 */
export function SkyPanorama() {
  const data = useAppStore((s) => s.ephemeris.data);
  const isLoading = useAppStore((s) => s.ephemeris.status === 'loading');
  const currentTime = useAppStore((s) => s.currentTime);

  const scale = useMemo(() => (data ? createScale(data.horizon, data.samples) : null), [data]);
  const current = data ? sampleAt(data.samples, currentTime ?? data.start) : null;

  if (!data || !scale || !current) return null;

  const status = BODY_IDS.map((id) => `${BODIES[id].label}: ${describeVisibility(current[id])}`).join('. ');
  const directions = BODY_IDS.map(
    (id) => `${BODIES[id].label} al ${compassPoint(current[id].azimuth)}, ${describeVisibility(current[id])}`,
  ).join('. ');

  return (
    // Mientras llega otro escenario se conserva lo anterior, atenuado: nada salta.
    <section
      aria-label="Sol y Tierra sobre el horizonte"
      aria-busy={isLoading}
      className={`space-y-4 transition-opacity ${isLoading ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Sol y Tierra sobre el horizonte</h2>
        <p className="text-sm text-slate-500">{formatUtcDateTime(current.time)} UTC</p>
      </div>

      <PanoramaChart
        horizon={data.horizon}
        samples={data.samples}
        current={current}
        scale={scale}
        description={`Panorama del horizonte. ${status}.`}
      />

      <div className="grid items-start gap-x-6 gap-y-4 sm:grid-cols-[15rem_1fr]">
        <TopView current={current} description={`Vista desde arriba del sitio. ${directions}.`} />

        <div className="space-y-4">
          <ul className="space-y-2">
            {BODY_IDS.map((id) => (
              <BodyReadout key={id} body={id} position={current[id]} />
            ))}
          </ul>
          <LinkLegend />
          <p className="max-w-prose text-sm text-slate-500">
            En el panorama la altura está exagerada {scale.exaggeration.toFixed(scale.exaggeration < 10 ? 1 : 0)} veces
            para que se note el relieve, y la línea tenue es el recorrido de cada cuerpo en la ventana. En la vista desde
            arriba solo cuenta la dirección: la distancia al centro no significa nada.
          </p>
        </div>
      </div>
    </section>
  );
}
