import { useAppStore } from '../../app/store';
import { BODIES, BODY_IDS } from '../../shared/lib/bodies';
import { sampleIndexAt } from '../../shared/lib/ephemeris';
import type { EphemerisSample, SkyEvent } from '../../shared/types/lunar';
import { EventList } from './EventList';
import { TimelinePlot } from './TimelinePlot';
import { TimelineToolbar } from './TimelineToolbar';
import { usePlayback } from './usePlayback';

const NO_SAMPLES: EphemerisSample[] = [];

/**
 * Slice 6: elevacion de Sol y Tierra a lo largo de la ventana, con bandas de visibilidad y salidas/puestas.
 * Contenedor: el slider, la grafica, el play y la lista de eventos mueven `currentTime` del store, y el
 * panorama de arriba se redibuja en ese instante.
 */
export function Timeline() {
  const data = useAppStore((s) => s.ephemeris.data);
  const isLoading = useAppStore((s) => s.ephemeris.status === 'loading');
  const currentTime = useAppStore((s) => s.currentTime);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);

  const samples = data?.samples ?? NO_SAMPLES;
  const index = Math.max(0, currentTime ? sampleIndexAt(samples, currentTime) : 0);
  const playback = usePlayback({
    session: data,
    count: samples.length,
    index,
    paused: isLoading,
    onStep: (next) => setCurrentTime(samples[next].time),
  });

  if (!data || samples.length === 0) return null;

  const startMs = Date.parse(samples[0].time);
  const current = samples[index];

  // Mover el instante a mano detiene el play: si no, el siguiente cuadro lo regresaria.
  function seek(next: number) {
    playback.pause();
    setCurrentTime(samples[next].time);
  }

  // Las muestras van cada hora y el evento cae entre dos: se va a la primera despues, para que el panorama
  // ya muestre el cambio (el Sol ya oculto tras una puesta, ya visible tras una salida).
  function goToEvent(event: SkyEvent) {
    const nearest = sampleIndexAt(samples, event.time);
    const after = Date.parse(samples[nearest].time) < Date.parse(event.time) ? nearest + 1 : nearest;
    seek(Math.min(samples.length - 1, after));
  }

  const description = `Sun and Earth elevation over the window, with ${data.events.length} rises and sets. ${BODY_IDS.map(
    (id) => `${BODIES[id].label} visible ${Math.round(id === 'sun' ? data.metrics.sunVisiblePct : data.metrics.earthVisiblePct)}% of the time`,
  ).join('. ')}.`;

  return (
    // Mientras llega otro escenario se conserva lo anterior, atenuado, igual que el panorama.
    <section
      aria-label="Timeline"
      aria-busy={isLoading}
      className={`space-y-2 transition-opacity ${isLoading ? 'opacity-50' : ''}`}
    >
      <h2 className="text-sm text-slate-500">Timeline: drag to move the panorama</h2>

      {/* theme-fixed: oscuro por diseno, como el bento del panorama (ver index.css). */}
      <div className="theme-fixed space-y-3 rounded-lg bg-black p-3">
        <TimelineToolbar
          playing={playback.playing}
          onTogglePlay={playback.toggle}
          time={current.time}
          startMs={startMs}
        />
        <TimelinePlot
          samples={samples}
          events={data.events}
          index={index}
          description={description}
          onSeek={seek}
        />
      </div>

      <EventList events={data.events} startMs={startMs} onSelect={goToEvent} />
    </section>
  );
}
