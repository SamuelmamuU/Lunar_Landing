import { horizonAt } from '../../shared/lib/ephemeris';
import type { HorizonProfile } from '../../shared/types/lunar';
import type { PanoramaScale } from './panoramaScale';

interface Props {
  /** Azimut bajo el cursor. */
  azimuth: number;
  horizon: HorizonProfile;
  scale: PanoramaScale;
}

/** Linea vertical bajo el cursor y un punto sobre la cresta del terreno. Los datos van en PanoramaTooltip. */
export function PanoramaCrosshair({ azimuth, horizon, scale }: Props) {
  const x = scale.x(azimuth);

  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={scale.top} y2={scale.bottom} className="stroke-slate-400" />
      <circle cx={x} cy={scale.y(horizonAt(horizon, azimuth))} r={4} className="fill-slate-50 stroke-slate-950 stroke-2" />
    </g>
  );
}
