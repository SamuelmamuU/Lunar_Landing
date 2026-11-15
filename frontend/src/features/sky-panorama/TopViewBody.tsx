import { formatDegrees } from '../../shared/lib/angles';
import { BODIES, type BodyId } from '../../shared/lib/bodies';
import { linkState } from '../../shared/lib/visibility';
import type { BodyPosition } from '../../shared/types/lunar';
import { LINK_STYLE } from './linkStyle';
import { CENTER, DISC_RADIUS, ORBIT_RADIUS, SITE_RADIUS, polarToPoint } from './topViewGeometry';

interface Props {
  body: BodyId;
  position: BodyPosition;
}

/** Un cuerpo en su orbita: el enlace con el sitio (color y patron segun el estado), el disco y su rotulo. */
export function TopViewBody({ body, position }: Props) {
  const { color, label } = BODIES[body];
  const style = LINK_STYLE[linkState(position)];
  const orbit = ORBIT_RADIUS[body];
  const disc = DISC_RADIUS[body];
  // El enlace va del borde del sitio al borde del disco, sin taparlos.
  const from = polarToPoint(position.azimuth, SITE_RADIUS + 4);
  const to = polarToPoint(position.azimuth, orbit - disc - 3);
  const center = polarToPoint(position.azimuth, orbit);
  const onRight = center.x >= CENTER;
  // Cerca del este y del oeste el rotulo al lado chocaria con la E o la O: va arriba del disco.
  const nearSide = Math.abs(Math.sin((position.azimuth * Math.PI) / 180)) > 0.7;
  const labelX = nearSide ? center.x : center.x + (onRight ? disc + 5 : -disc - 5);
  const labelY = nearSide ? center.y - disc - 6 : center.y + 4;
  const anchor = nearSide ? 'middle' : onRight ? 'start' : 'end';

  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={style.dashArray}
        className={style.strokeClass}
      />
      <circle cx={center.x} cy={center.y} r={disc} fill={color} className="stroke-slate-950 stroke-2" />
      <text
        x={labelX}
        y={labelY}
        textAnchor={anchor}
        className="fill-slate-50 stroke-slate-950 stroke-[3] text-[11px] font-medium tabular-nums [paint-order:stroke]"
      >
        {label} {formatDegrees(position.elevation)}
      </text>
    </g>
  );
}
