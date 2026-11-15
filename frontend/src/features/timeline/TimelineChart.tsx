import { useId, useMemo, type PointerEvent } from 'react';
import { BODY_IDS, type BodyId } from '../../shared/lib/bodies';
import type { EphemerisSample, SkyEvent } from '../../shared/types/lunar';
import { ElevationLine } from './ElevationLine';
import { EventMarkers } from './EventMarkers';
import { LinkBands } from './LinkBands';
import { TimeCursor } from './TimeCursor';
import { TimelineAxes } from './TimelineAxes';
import { linkRuns, type LinkRun, type TimelineScale } from './timelineScale';

interface Props {
  samples: EphemerisSample[];
  events: SkyEvent[];
  /** Muestra elegida (la que muestra el panorama). */
  index: number;
  /** Muestra bajo el cursor, o null. */
  hoverIndex: number | null;
  scale: TimelineScale;
  description: string;
  onHover: (index: number | null) => void;
  /** Clic o arrastre sobre la grafica: mueve el instante. */
  onSeek: (index: number) => void;
}

// La Tierra se pinta primero para que el Sol no quede tapado si se cruzan.
const DRAW_ORDER = [...BODY_IDS].reverse();
/** Holgura a los lados del area de dibujo donde el cursor todavia cuenta. */
const HOVER_SLACK_PX = 6;

/** SVG de la linea de tiempo: elevacion de Sol y Tierra, bandas de visibilidad, eventos e instante elegido. */
export function TimelineChart({ samples, events, index, hoverIndex, scale, description, onHover, onSeek }: Props) {
  // Los id de React traen caracteres que no sirven dentro de url(#...).
  const patternId = `hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const runs = useMemo(
    () => Object.fromEntries(BODY_IDS.map((id) => [id, linkRuns(samples, id)])) as Record<BodyId, LinkRun[]>,
    [samples],
  );

  function pointerIndex(event: PointerEvent<SVGSVGElement>): number | null {
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    if (x < scale.left - HOVER_SLACK_PX || x > scale.right + HOVER_SLACK_PX) return null;
    return scale.indexAt(x);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    const target = pointerIndex(event);
    if (target === null) return;
    // Captura: el arrastre sigue aunque el cursor salga de la grafica.
    event.currentTarget.setPointerCapture(event.pointerId);
    onSeek(target);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const dragging = event.currentTarget.hasPointerCapture(event.pointerId);
    const target = dragging
      ? scale.indexAt(event.clientX - event.currentTarget.getBoundingClientRect().left)
      : pointerIndex(event);
    onHover(target);
    if (dragging && target !== null) onSeek(target);
  }

  return (
    <svg
      viewBox={`0 0 ${scale.width} ${scale.height}`}
      width={scale.width}
      height={scale.height}
      role="img"
      aria-label={description}
      className="absolute inset-0 block cursor-crosshair touch-pan-y select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onHover(null)}
    >
      <TimelineAxes scale={scale} />
      <LinkBands runs={runs} scale={scale} patternId={patternId} />
      <EventMarkers events={events} scale={scale} />
      {DRAW_ORDER.map((body) => (
        <ElevationLine key={body} body={body} samples={samples} scale={scale} />
      ))}
      {hoverIndex !== null && hoverIndex !== index && (
        <line
          x1={scale.xAtIndex(hoverIndex)}
          x2={scale.xAtIndex(hoverIndex)}
          y1={scale.top}
          y2={scale.bandsBottom}
          pointerEvents="none"
          className="stroke-slate-400"
        />
      )}
      <TimeCursor sample={samples[index]} index={index} scale={scale} />
    </svg>
  );
}
