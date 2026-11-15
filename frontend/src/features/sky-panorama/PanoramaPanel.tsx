import { useMemo } from 'react';
import type { EphemerisSample, HorizonProfile } from '../../shared/types/lunar';
import { PanoramaChart } from './PanoramaChart';
import { createScale } from './panoramaScale';
import { useElementSize } from './useElementSize';

interface Props {
  horizon: HorizonProfile;
  samples: EphemerisSample[];
  current: EphemerisSample;
  description: string;
  className?: string;
}

/**
 * Panel del panorama: mide su espacio (en el bento lo decide la columna derecha) y dibuja la grafica a
 * ese tamano exacto.
 */
export function PanoramaPanel({ horizon, samples, current, description, className = '' }: Props) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const scale = useMemo(
    () => (size.width > 0 && size.height > 0 ? createScale(horizon, samples, size.width, size.height) : null),
    [horizon, samples, size.width, size.height],
  );

  return (
    <div ref={ref} className={`relative overflow-hidden rounded-lg bg-black ${className}`}>
      {scale && (
        <PanoramaChart horizon={horizon} samples={samples} current={current} scale={scale} description={description} />
      )}
    </div>
  );
}
