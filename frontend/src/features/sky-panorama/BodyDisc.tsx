import { BODIES, type BodyId } from '../../shared/lib/bodies';
import type { BodyPosition } from '../../shared/types/lunar';
import { discRadius, type PanoramaScale } from './panoramaScale';

interface Props {
  body: BodyId;
  position: BodyPosition;
  scale: PanoramaScale;
  /** 'fill' = disco relleno (detras del terreno). 'outline' = solo el contorno (encima del terreno). */
  variant: 'fill' | 'outline';
}

/**
 * Disco del cuerpo a su tamano angular. Se dibuja dos veces: relleno detras del terreno (el cerro lo
 * tapa) y su contorno encima, para que se vea donde esta aunque quede oculto.
 */
export function BodyDisc({ body, position, scale, variant }: Props) {
  const radius = discRadius(body, scale);
  const cx = scale.x(position.azimuth);
  const cy = scale.y(position.elevation);
  const width = scale.right - scale.left;
  // Cerca del norte el disco asoma tambien por el borde opuesto.
  const centers = [cx, cx - width, cx + width].filter((x) => x + radius > scale.left && x - radius < scale.right);
  const { color } = BODIES[body];

  return (
    <g>
      {centers.map((x) =>
        variant === 'fill' ? (
          // El borde del color del cielo separa el disco del recorrido que pasa por detras.
          <circle key={x} cx={x} cy={cy} r={radius} fill={color} className="stroke-slate-950 stroke-2" />
        ) : (
          <circle key={x} cx={x} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={1.5} />
        ),
      )}
    </g>
  );
}
