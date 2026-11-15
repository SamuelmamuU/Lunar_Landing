import { useId } from 'react';
import { formatUtcDateTime } from '../../shared/lib/dates';
import type { TimelineScale } from './timelineScale';

interface Props {
  index: number;
  count: number;
  /** Instante de la muestra elegida (ISO), para lectores de pantalla. */
  time: string;
  scale: TimelineScale;
  onSeek: (index: number) => void;
}

/** Medio ancho del pulgar nativo: el slider se ensancha eso a cada lado para que su centro caiga sobre el eje. */
const THUMB_HALF_PX = 8;

/**
 * Slider del instante. Es un <input type="range"> nativo (teclado y lector de pantalla gratis), alineado con
 * el eje de tiempo de la grafica de arriba.
 */
export function TimeSlider({ index, count, time, scale, onSeek }: Props) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Instante dentro de la ventana
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={count - 1}
        step={1}
        value={index}
        onChange={(event) => onSeek(Number(event.target.value))}
        aria-valuetext={`${formatUtcDateTime(time)} UTC`}
        className="block h-6 cursor-pointer accent-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
        style={{ marginLeft: scale.left - THUMB_HALF_PX, width: scale.right - scale.left + THUMB_HALF_PX * 2 }}
      />
    </div>
  );
}
