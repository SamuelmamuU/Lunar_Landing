import { BODIES, bodyExtent, type BodyId } from '../../shared/lib/bodies';
import type { BodyPosition } from '../../shared/types/lunar';
import { BodyIcon } from '../../shared/ui/BodyIcon';
import { discRadius, type PanoramaScale } from './panoramaScale';

interface Props {
  body: BodyId;
  position: BodyPosition;
  scale: PanoramaScale;
  /** 'fill' = icono del cuerpo (detras del terreno). 'outline' = solo el contorno del disco (encima del terreno). */
  variant: 'fill' | 'outline';
}

/**
 * Cuerpo con su icono; el disco mide su tamano angular. Se dibuja dos veces: el icono detras del terreno (el
 * cerro lo tapa) y el contorno del disco encima, para que se vea donde esta aunque quede oculto.
 */
export function BodyDisc({ body, position, scale, variant }: Props) {
  const radius = discRadius(body, scale);
  const extent = bodyExtent(body, radius);
  const cx = scale.x(position.azimuth);
  const cy = scale.y(position.elevation);
  const width = scale.right - scale.left;
  // Cerca del norte el cuerpo asoma tambien por el borde opuesto.
  const centers = [cx, cx - width, cx + width].filter((x) => x + extent > scale.left && x - extent < scale.right);

  return (
    <g>
      {centers.map((x) =>
        variant === 'fill' ? (
          <BodyIcon key={x} body={body} cx={x} cy={cy} radius={radius} />
        ) : (
          <circle key={x} cx={x} cy={cy} r={radius} fill="none" stroke={BODIES[body].color} strokeWidth={1.5} />
        ),
      )}
    </g>
  );
}
