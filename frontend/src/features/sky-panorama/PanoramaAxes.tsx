import { formatDegrees } from '../../shared/lib/angles';
import { elevationTicks, type PanoramaScale } from './panoramaScale';

interface Props {
  scale: PanoramaScale;
}

const AZIMUTH_TICKS = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N' };

/** Rejilla y rotulos: azimut abajo (N/E/S/O y grados) y elevacion a la izquierda. */
export function PanoramaAxes({ scale }: Props) {
  const ticks = elevationTicks(scale);
  const digits = ticks.some((tick) => !Number.isInteger(tick)) ? 1 : 0;

  return (
    <g className="text-[11px] tabular-nums">
      <text x={scale.left} y={scale.top - 10} className="fill-slate-400">
        Elevation, exaggerated ×{scale.exaggeration.toFixed(scale.exaggeration < 10 ? 1 : 0)} so the relief shows
      </text>

      {AZIMUTH_TICKS.map((azimuth) => (
        <g key={azimuth}>
          <line
            x1={scale.x(azimuth)}
            x2={scale.x(azimuth)}
            y1={scale.top}
            y2={scale.bottom}
            className="stroke-slate-800"
          />
          {CARDINALS[azimuth] && (
            <text x={scale.x(azimuth)} y={scale.bottom + 17} textAnchor="middle" className="fill-slate-100 text-[13px] font-semibold">
              {CARDINALS[azimuth]}
            </text>
          )}
          <text x={scale.x(azimuth)} y={scale.bottom + 32} textAnchor="middle" className="fill-slate-400">
            {azimuth}°
          </text>
        </g>
      ))}

      {ticks.map((tick) => (
        <g key={tick}>
          {/* El 0 es el horizonte plano (sin relieve): va mas marcado que el resto. */}
          <line
            x1={scale.left}
            x2={scale.right}
            y1={scale.y(tick)}
            y2={scale.y(tick)}
            className={tick === 0 ? 'stroke-slate-500' : 'stroke-slate-800'}
          />
          <text x={scale.left - 8} y={scale.y(tick) + 4} textAnchor="end" className="fill-slate-400">
            {formatDegrees(tick, digits)}
          </text>
        </g>
      ))}
    </g>
  );
}
