import { useEffect, useState, type ReactNode } from 'react';
import { useAppStore } from '../../app/store';
import { compassPoint } from '../../shared/lib/angles';
import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import { formatUtcDateTime } from '../../shared/lib/dates';
import { sampleAt } from '../../shared/lib/ephemeris';
import { BodyStatusPanel } from './BodyStatusPanel';
import { OrbitalView3D } from './OrbitalView3D';
import { PanoramaPanel } from './PanoramaPanel';
import { SurfaceView3D } from './SurfaceView3D';
import { TopView } from './TopView';
import { ViewModeSwitch, type SkyViewMode } from './ViewModeSwitch';
import { describeVisibility } from './bodyStatus';

const DESCENT_DURATION_MS = 14_000;

interface Props {
  /**
   * Contenido de la pestana "Metricas" (las metricas de la ventana). Lo pasa App: un feature no importa a otro.
   * Sin el, la pestana no aparece.
   */
  metrics?: ReactNode;
}

/**
 * Slice 3: donde estan el Sol y la Tierra respecto al terreno en el instante elegido (currentTime, o
 * el inicio de la ventana si no se ha movido la linea de tiempo).
 *
 * Bento de 2 x 2 como un tablero de instrumentos: el panorama a la izquierda ocupa las dos filas (el por
 * que: alturas y relieve) y a la derecha la vista desde arriba y el estado de cada cuerpo (el que: hay luz
 * y enlace?). El alto lo pone la columna derecha y el panorama lo llena.
 */
export function SkyPanorama({ metrics }: Props) {
  const data = useAppStore((s) => s.ephemeris.data);
  const isLoading = useAppStore((s) => s.ephemeris.status === 'loading');
  const currentTime = useAppStore((s) => s.currentTime);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);

  const [viewMode, setViewMode] = useState<SkyViewMode>('2d');
  const [descentProgress, setDescentProgress] = useState(1);
  const [isDescending, setIsDescending] = useState(false);

  useEffect(() => {
    if (!isDescending) return;
    let rafId = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setDescentProgress((prev) => {
        const next = prev + (dt * 1000) / DESCENT_DURATION_MS;
        if (next >= 1) {
          setIsDescending(false);
          return 1;
        }
        return next;
      });
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isDescending]);

  const handleToggleDescent = () => {
    if (isDescending) {
      setIsDescending(false);
      return;
    }
    if (descentProgress >= 0.995) {
      setDescentProgress(0);
    }
    setIsDescending(true);
  };

  const handleResetDescent = () => {
    setIsDescending(false);
    setDescentProgress(1);
  };

  const handleSeekDescent = (progress: number) => {
    setIsDescending(false);
    setDescentProgress(Math.max(0, Math.min(1, progress)));
  };

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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm text-slate-500">Sol y Tierra sobre el horizonte</h2>
          <ViewModeSwitch value={viewMode} onChange={setViewMode} showMetrics={metrics !== undefined} />
        </div>
        <p className="text-sm text-slate-500">{formatUtcDateTime(current.time)} UTC</p>
      </div>

      {/*
        theme-fixed: el bento ya es oscuro por diseno; en modo oscuro conserva sus colores (ver index.css).
      */}
      {viewMode === 'metrics' && metrics !== undefined ? (
        // Las metricas son de toda la ventana, no del instante: van sin el bento oscuro.
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">{metrics}</div>
      ) : viewMode === 'dual3d' ? (
        <div className="theme-fixed space-y-2">
          <div className="grid gap-2 lg:grid-cols-2">
            <OrbitalView3D
              lat={data.lat}
              lon={data.lon}
              sample={current}
              vectors3d={data.vectors3d}
              descentProgress={descentProgress}
              className="min-h-[22rem] lg:min-h-[26rem]"
            />
            <SurfaceView3D
              horizon={data.horizon}
              terrain={data.terrain}
              samples={data.samples}
              current={current}
              descentProgress={descentProgress}
              isDescending={isDescending}
              onToggleDescent={handleToggleDescent}
              onResetDescent={handleResetDescent}
              onSeekDescent={handleSeekDescent}
              className="min-h-[22rem] lg:min-h-[26rem]"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[15rem_minmax(0,1fr)]">
            <div className="mx-auto w-full max-w-60 sm:max-w-none">
              <TopView current={current} description={`Vista desde arriba del sitio. ${directions}.`} />
            </div>
            <BodyStatusPanel current={current} />
          </div>
        </div>
      ) : (
        <div className="theme-fixed grid gap-2 sm:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_15rem] lg:grid-rows-[auto_1fr]">
          {viewMode === '2d' && (
            <PanoramaPanel
              horizon={data.horizon}
              samples={data.samples}
              current={current}
              description={`Panorama del horizonte. ${status}.`}
              onSelectTime={setCurrentTime}
              className="aspect-[2/1] sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:aspect-auto lg:min-h-96"
            />
          )}
          {viewMode === 'surface3d' && (
            <SurfaceView3D
              horizon={data.horizon}
              terrain={data.terrain}
              samples={data.samples}
              current={current}
              descentProgress={descentProgress}
              isDescending={isDescending}
              onToggleDescent={handleToggleDescent}
              onResetDescent={handleResetDescent}
              onSeekDescent={handleSeekDescent}
              className="min-h-[24rem] sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:min-h-[28rem]"
            />
          )}
          {viewMode === 'orbital3d' && (
            <OrbitalView3D
              lat={data.lat}
              lon={data.lon}
              sample={current}
              vectors3d={data.vectors3d}
              descentProgress={descentProgress}
              className="min-h-[24rem] sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:min-h-[28rem]"
            />
          )}
          <div className="mx-auto w-full max-w-60 sm:max-w-none">
            <TopView current={current} description={`Vista desde arriba del sitio. ${directions}.`} />
          </div>
          <BodyStatusPanel current={current} />
        </div>
      )}
    </section>
  );
}
