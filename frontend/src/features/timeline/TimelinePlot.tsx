import { useMemo, useState } from 'react';
import { useElementSize } from '../../shared/lib/useElementSize';
import type { EphemerisSample, SkyEvent } from '../../shared/types/lunar';
import { TimeSlider } from './TimeSlider';
import { TimelineChart } from './TimelineChart';
import { TimelineTooltip } from './TimelineTooltip';
import { createTimelineScale } from './timelineScale';

interface Props {
  samples: EphemerisSample[];
  events: SkyEvent[];
  index: number;
  description: string;
  onSeek: (index: number) => void;
}

/** Mide el ancho disponible y dibuja la grafica, el tooltip del cursor y el slider con la misma escala. */
export function TimelinePlot({ samples, events, index, description, onSeek }: Props) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const scale = useMemo(
    () => (size.width > 0 ? createTimelineScale(samples, size.width) : null),
    [samples, size.width],
  );
  // Si cambian las muestras, un indice viejo podria no existir.
  const hovered = hoverIndex !== null && hoverIndex < samples.length ? hoverIndex : null;

  return (
    <div>
      {/* h-58 = TIMELINE_HEIGHT (232 px). */}
      <div ref={ref} className="relative h-58">
        {scale && (
          <TimelineChart
            samples={samples}
            events={events}
            index={index}
            hoverIndex={hovered}
            scale={scale}
            description={description}
            onHover={setHoverIndex}
            onSeek={onSeek}
          />
        )}
        {scale && hovered !== null && (
          <TimelineTooltip sample={samples[hovered]} x={scale.xAtIndex(hovered)} scale={scale} />
        )}
      </div>
      {scale && (
        <TimeSlider index={index} count={samples.length} time={samples[index].time} scale={scale} onSeek={onSeek} />
      )}
    </div>
  );
}
