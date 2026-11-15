import { useId, useState, type PointerEvent } from 'react';
import { BODY_IDS } from '../../shared/lib/bodies';
import type { EphemerisSample, HorizonProfile } from '../../shared/types/lunar';
import { BodyDisc } from './BodyDisc';
import { BodyLabel } from './BodyLabel';
import { BodyTrack } from './BodyTrack';
import { PanoramaAxes } from './PanoramaAxes';
import { PanoramaCrosshair } from './PanoramaCrosshair';
import { TerrainSilhouette } from './TerrainSilhouette';
import { VIEW_HEIGHT, VIEW_WIDTH, type PanoramaScale } from './panoramaScale';

interface Props {
  horizon: HorizonProfile;
  /** Toda la ventana: de aqui sale el recorrido. */
  samples: EphemerisSample[];
  /** Instante que se muestra. */
  current: EphemerisSample;
  scale: PanoramaScale;
  /** Texto para lectores de pantalla (lo mismo que dicen las lineas bajo la grafica). */
  description: string;
}

// La Tierra (mas grande) se pinta primero para que el Sol no quede tapado si coinciden.
const DRAW_ORDER = [...BODY_IDS].reverse();

/** SVG del panorama: cielo, recorridos, discos, terreno encima y rotulos. */
export function PanoramaChart({ horizon, samples, current, scale, description }: Props) {
  const clipId = useId();
  const [hoverAzimuth, setHoverAzimuth] = useState<number | null>(null);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * VIEW_WIDTH;
    setHoverAzimuth(x < scale.left || x > scale.right ? null : scale.azimuthAt(x));
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={description}
      className="block w-full touch-pan-y rounded-lg bg-slate-950"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoverAzimuth(null)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={scale.left} y={scale.top} width={scale.right - scale.left} height={scale.bottom - scale.top} />
        </clipPath>
      </defs>

      <PanoramaAxes scale={scale} />

      <g clipPath={`url(#${clipId})`}>
        {DRAW_ORDER.map((body) => (
          <BodyTrack key={body} body={body} samples={samples} scale={scale} />
        ))}
        {DRAW_ORDER.map((body) => (
          <BodyDisc key={body} body={body} position={current[body]} scale={scale} variant="fill" />
        ))}
        <TerrainSilhouette horizon={horizon} scale={scale} />
        {DRAW_ORDER.map((body) => (
          <BodyDisc key={body} body={body} position={current[body]} scale={scale} variant="outline" />
        ))}
      </g>

      {DRAW_ORDER.map((body) => (
        <BodyLabel key={body} body={body} position={current[body]} scale={scale} />
      ))}

      {hoverAzimuth !== null && <PanoramaCrosshair azimuth={hoverAzimuth} horizon={horizon} scale={scale} />}
    </svg>
  );
}
