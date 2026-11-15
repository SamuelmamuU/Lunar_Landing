import { formatDegrees } from '../../shared/lib/angles';
import { BODIES, type BodyId } from '../../shared/lib/bodies';
import type { BodyPosition } from '../../shared/types/lunar';
import { discRadius, type PanoramaScale } from './panoramaScale';

interface Props {
  body: BodyId;
  position: BodyPosition;
  scale: PanoramaScale;
}

const LABEL_CLASS = 'fill-slate-50 stroke-slate-950 stroke-[3] text-xs font-medium [paint-order:stroke]';

/**
 * Nombre del cuerpo junto a su disco. Si el cuerpo esta por debajo de lo que alcanza a mostrar la
 * grafica, lo senala en el borde inferior con su elevacion.
 */
export function BodyLabel({ body, position, scale }: Props) {
  const { label, color } = BODIES[body];
  const radius = discRadius(body, scale);
  const cx = scale.x(position.azimuth);
  const cy = scale.y(position.elevation);
  // El texto no se sale por los lados.
  const textX = Math.min(scale.right - 24, Math.max(scale.left + 24, cx));

  if (cy - radius > scale.bottom) {
    const tip = scale.bottom - 3;
    return (
      <g>
        <path d={`M${cx - 6},${tip - 9}L${cx + 6},${tip - 9}L${cx},${tip}Z`} fill={color} className="stroke-slate-950" />
        <text x={textX} y={tip - 15} textAnchor="middle" className={LABEL_CLASS}>
          {label}, {formatDegrees(position.elevation)}
        </text>
      </g>
    );
  }

  const above = cy - radius - 7;
  const y = above < scale.top + 10 ? cy + radius + 16 : above;
  return (
    <text x={textX} y={y} textAnchor="middle" className={LABEL_CLASS}>
      {label}
    </text>
  );
}
