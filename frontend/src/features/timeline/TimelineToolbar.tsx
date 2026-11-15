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

/** Fila de arriba del panel: reproducir/pausar, el instante elegido y la leyenda. */
export function TimelineToolbar({ playing, onTogglePlay, time, startMs }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button size="sm" onClick={onTogglePlay} aria-pressed={playing} className="focus-visible:ring-offset-black">
        {playing ? <PauseIcon /> : <PlayIcon />}
        {playing ? 'Pausar' : 'Reproducir'}
      </Button>
      <p className="text-sm text-slate-100 tabular-nums">
        {formatUtcDateTime(time)} UTC <span className="text-slate-400">{offsetLabel(time, startMs)}</span>
      </p>
      <TimelineLegend className="lg:ml-auto" />
    </div>
  );
}
