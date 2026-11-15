import { formatUtcDateTime } from '../../shared/lib/dates';
import { Button } from '../../shared/ui/Button';
import { PauseIcon } from '../../shared/ui/icons/PauseIcon';
import { PlayIcon } from '../../shared/ui/icons/PlayIcon';
import { TimelineLegend } from './TimelineLegend';
import { offsetLabel } from './timelineScale';

interface Props {
  playing: boolean;
  onTogglePlay: () => void;
  /** Instante elegido (ISO). */
  time: string;
  startMs: number;
}

/**
 * Fila de arriba del panel: reproducir/pausar, el instante elegido y la leyenda.
 *
 * El boton y el texto del instante tienen ancho fijo (el del texto mas largo posible): si cambiaran con el
 * instante, la leyenda bajaria de linea a ciertos anchos de pantalla y toda la pagina brincaria al arrastrar.
 */
export function TimelineToolbar({ playing, onTogglePlay, time, startMs }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button
        size="sm"
        onClick={onTogglePlay}
        aria-pressed={playing}
        // 10ch = "Reproducir"; 3rem = icono + separacion + relleno.
        className="min-w-[calc(10ch+3rem)] justify-center focus-visible:ring-offset-black"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
        {playing ? 'Pause' : 'Play'}
      </Button>
      {/* 52ch = "28 sept 2025, 23:28 UTC +23 h 30 min desde el inicio". */}
      <p className="w-[52ch] max-w-full text-sm text-slate-100 tabular-nums">
        {formatUtcDateTime(time)} UTC <span className="text-slate-400">{offsetLabel(time, startMs)}</span>
      </p>
      <TimelineLegend className="lg:ml-auto" />
    </div>
  );
}
