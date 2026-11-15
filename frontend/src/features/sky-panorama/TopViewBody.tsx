import { formatDegrees } from '../../shared/lib/angles';
import { BODIES, bodyExtent, type BodyId } from '../../shared/lib/bodies';
import { linkState } from '../../shared/lib/visibility';
import type { BodyPosition } from '../../shared/types/lunar';
import { BodyIcon } from '../../shared/ui/BodyIcon';
import { LINK_STYLE } from './linkStyle';
import { DISC_RADIUS, ORBIT_RADIUS, SITE_RADIUS, labelPlacement, polarToPoint } from './topViewGeometry';

interface Props {
  body: BodyId;
  position: BodyPosition;
}

/** Un cuerpo en su orbita: el enlace con el sitio (color y patron segun el estado), su icono y su rotulo. */
export function TopViewBody({ body, position }: Props) {
  const { label } = BODIES[body];
  const style = LINK_STYLE[linkState(position)];
  const orbit = ORBIT_RADIUS[body];
  const disc = DISC_RADIUS[body];
  // Lo que ocupa el icono completo (en el Sol, hasta la punta de los rayos).
  const extent = bodyExtent(body, disc);
  // El enlace va del borde del sitio al borde del icono, sin taparlos.
  const from = polarToPoint(position.azimuth, SITE_RADIUS + 4);
  const to = polarToPoint(position.azimuth, orbit - extent - 2);
  const center = polarToPoint(position.azimuth, orbit);
  const text = `${label} ${formatDegrees(position.elevation)}`;
  const placement = labelPlacement(position.azimuth, center, extent, text);

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
      <BodyIcon body={body} cx={center.x} cy={center.y} radius={disc} />
      <text
        x={placement.x}
        y={placement.y}
        textAnchor={placement.anchor}
        className="fill-slate-50 stroke-slate-950 stroke-[3] text-[11px] font-medium tabular-nums [paint-order:stroke]"
      >
        {text}
      </text>
    </g>
  );
}
