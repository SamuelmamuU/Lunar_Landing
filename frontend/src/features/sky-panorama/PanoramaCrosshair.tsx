import { compassPoint, formatDegrees } from '../../shared/lib/angles';
import { horizonAt } from '../../shared/lib/ephemeris';
import type { HorizonProfile } from '../../shared/types/lunar';
import type { PanoramaScale } from './panoramaScale';

interface Props {
  /** Azimut bajo el cursor. */
  azimuth: number;
  horizon: HorizonProfile;
  scale: PanoramaScale;
}

/** Linea vertical bajo el cursor con la direccion y la altura del terreno en ese punto. */
export function PanoramaCrosshair({ azimuth, horizon, scale }: Props) {
  const x = scale.x(azimuth);
  const terrain = horizonAt(horizon, azimuth);
  const onRightHalf = x > (scale.left + scale.right) / 2;

  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={scale.top} y2={scale.bottom} className="stroke-slate-400" />
      <circle cx={x} cy={scale.y(terrain)} r={4} className="fill-slate-50 stroke-slate-950 stroke-2" />
      <text
        x={onRightHalf ? x - 8 : x + 8}
        y={scale.top + 13}
        textAnchor={onRightHalf ? 'end' : 'start'}
        className="fill-slate-50 stroke-slate-950 stroke-[3] text-xs tabular-nums [paint-order:stroke]"
      >
        {formatDegrees(azimuth, 0)} {compassPoint(azimuth)}, terreno {formatDegrees(terrain)}
      </text>
    </g>
  );
}
