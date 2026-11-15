import { useAppStore } from '../../app/store';
import { compassPoint } from '../../shared/lib/angles';
import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { sampleAt } from '../../shared/lib/ephemeris';
import { BodyStatusPanel } from './BodyStatusPanel';
import { PanoramaPanel } from './PanoramaPanel';
import { TopView } from './TopView';
import { describeVisibility } from './bodyStatus';

/**
 * Slice 3: donde estan el Sol y la Tierra respecto al terreno en el instante elegido (currentTime, o
 * el inicio de la ventana si no se ha movido la linea de tiempo).
 *
 * Bento de 2 x 2 como un tablero de instrumentos: el panorama a la izquierda ocupa las dos filas (el por
 * que: alturas y relieve) y a la derecha la vista desde arriba y el estado de cada cuerpo (el que: hay luz
 * y enlace?). El alto lo pone la columna derecha y el panorama lo llena.
 */
export function SkyPanorama() {
  const data = useAppStore((s) => s.ephemeris.data);
  const isLoading = useAppStore((s) => s.ephemeris.status === 'loading');
  const currentTime = useAppStore((s) => s.currentTime);

  const current = data ? sampleAt(data.samples, currentTime ?? data.start) : null;
  if (!data || !current) return null;

  const status = BODY_IDS.map((id) => `${BODIES[id].label}: ${describeVisibility(current[id])}`).join('. ');
  const directions = BODY_IDS.map(
    (id) => `${BODIES[id].label} al ${compassPoint(current[id].azimuth)}, ${describeVisibility(current[id])}`,
  ).join('. ');

  return (
    // Mientras llega otro escenario se conserva lo anterior, atenuado: nada salta.
    <section
      aria-label="Sol y Tierra sobre el horizonte"
      aria-busy={isLoading}
      className={`space-y-2 transition-opacity ${isLoading ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Sol y Tierra sobre el horizonte</h2>
        <p className="text-sm text-slate-500">{formatUtcDateTime(current.time)} UTC</p>
      </div>

      {/*
        < sm: todo apilado. sm..lg: panorama arriba a lo ancho; mapa y datos lado a lado debajo.
        lg+: panorama a la izquierda en las dos filas; mapa arriba y datos abajo a la derecha.
      */}
      <div className="grid gap-2 sm:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_15rem] lg:grid-rows-[auto_1fr]">
        <PanoramaPanel
          horizon={data.horizon}
          samples={data.samples}
          current={current}
          description={`Panorama del horizonte. ${status}.`}
          className="aspect-[2/1] sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:aspect-auto lg:min-h-96"
        />
        <div className="mx-auto w-full max-w-60 sm:max-w-none">
          <TopView current={current} description={`Vista desde arriba del sitio. ${directions}.`} />
        </div>
        <BodyStatusPanel current={current} />
      </div>

      <p className="max-w-prose text-xs text-slate-500">
        La línea tenue del panorama es el recorrido de cada cuerpo en la ventana elegida. En la vista desde arriba
        solo cuenta la dirección: la distancia al centro no significa nada.
      </p>
    </section>
  );
}
