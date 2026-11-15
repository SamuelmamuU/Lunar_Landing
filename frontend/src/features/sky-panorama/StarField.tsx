import { useId } from 'react';
import { STARS, STAR_TILE } from './stars';

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Multiplica la opacidad de todas las estrellas (1 = normal). */
  intensity?: number;
}

/**
 * Cielo estrellado de fondo, decorativo: va debajo de todo y no responde al cursor. Se dibuja dentro de un
 * <svg>; lo que se pinte despues (el terreno) lo tapa.
 */
export function StarField({ x, y, width, height, intensity = 1 }: Props) {
  // Los id de React traen caracteres que no sirven dentro de url(#...).
  const patternId = `stars-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <g aria-hidden="true" pointerEvents="none">
      <defs>
        <pattern id={patternId} x={x} y={y} width={STAR_TILE.width} height={STAR_TILE.height} patternUnits="userSpaceOnUse">
          {STARS.map((star, i) => (
            <circle key={i} cx={star.x} cy={star.y} r={star.r} fillOpacity={star.opacity * intensity} className="fill-white" />
          ))}
        </pattern>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${patternId})`} />
    </g>
  );
}
