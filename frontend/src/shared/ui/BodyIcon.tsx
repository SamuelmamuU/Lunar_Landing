import { BODIES, bodyExtent, type BodyId } from '../lib/bodies';
import { EarthIcon } from './icons/EarthIcon';
import { SunIcon } from './icons/SunIcon';

interface Props {
  body: BodyId;
  cx: number;
  cy: number;
  /** Radio del disco (en el panorama, su tamano angular). Los rayos del Sol quedan por fuera. */
  radius: number;
  /** Fondo negro bajo el disco, para separarlo de las lineas que pasan por detras (en graficas oscuras). */
  halo?: boolean;
}

/**
 * Sol o Tierra con su icono y su color fijo, para dibujar DENTRO de un <svg>. El disco mide exactamente
 * `radius`, asi lo que tape el terreno sigue siendo correcto. La Tierra lleva un oceano tenue detras porque
 * su icono es hueco.
 */
export function BodyIcon({ body, cx, cy, radius, halo = true }: Props) {
  const { color } = BODIES[body];
  const extent = bodyExtent(body, radius);
  const Icon = body === 'sun' ? SunIcon : EarthIcon;

  return (
    <g>
      {halo && <circle cx={cx} cy={cy} r={radius + 1} className="fill-black" />}
      {body === 'earth' && <circle cx={cx} cy={cy} r={radius} fill={color} fillOpacity={0.3} />}
      {/* className vacio: dentro de otro SVG el tamano lo dan width y height. */}
      <Icon x={cx - extent} y={cy - extent} width={extent * 2} height={extent * 2} fill={color} className="" />
    </g>
  );
}
