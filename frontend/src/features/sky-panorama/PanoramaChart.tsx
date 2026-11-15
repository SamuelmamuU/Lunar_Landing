import { useId, useMemo, useState, type MouseEvent } from 'react';
import { BODY_IDS } from '../../shared/lib/bodies';
import { horizonAt } from '../../shared/lib/ephemeris';
import type { EphemerisSample, HorizonProfile } from '../../shared/types/lunar';
import { BodyDisc } from './BodyDisc';
import { BodyLabel } from './BodyLabel';
import { BodyTrack } from './BodyTrack';
import { PanoramaAxes } from './PanoramaAxes';
import { PanoramaCrosshair } from './PanoramaCrosshair';
import { PanoramaTooltip } from './PanoramaTooltip';
import { SnapTooltip } from './SnapTooltip';
import { SnapHighlight } from './SnapHighlight';
import { StarField } from './StarField';
import { TerrainSilhouette } from './TerrainSilhouette';
import type { PanoramaScale } from './panoramaScale';
import { findSnap, trackPoints } from './panoramaSnap';

interface Props {
  horizon: HorizonProfile;
  /** Toda la ventana: de aqui sale el recorrido. */
  samples: EphemerisSample[];
  /** Instante que se muestra. */
  current: EphemerisSample;
  /** Trae tambien el tamano del SVG (el de su contenedor). */
  scale: PanoramaScale;
  /** Texto para lectores de pantalla (lo mismo que dicen los textos del panel). */
  description: string;
  /** Clic en un punto del recorrido: lleva el panorama (y la linea de tiempo) a ese instante. */
  onSelectTime: (time: string) => void;
}

// La Tierra (mas grande) se pinta primero para que el Sol no quede tapado si coinciden.
const DRAW_ORDER = [...BODY_IDS].reverse();

interface Pointer {
  x: number;
  y: number;
}

/** Posicion del cursor en px del SVG (mide lo mismo que su contenedor). PointerEvent tambien es MouseEvent. */
function pointerIn(event: MouseEvent<SVGSVGElement>): Pointer {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/**
 * SVG del panorama: cielo, recorridos, discos, terreno encima y rotulos. Llena su contenedor.
 * Al pasar el cursor: cerca de un cuerpo o de su recorrido se pega ahi y muestra sus datos; si no, muestra
 * la direccion y la altura del terreno.
 */
export function PanoramaChart({ horizon, samples, current, scale, description, onSelectTime }: Props) {
  // Los id de React traen caracteres que no sirven dentro de url(#...).
  const clipId = `clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const points = useMemo(() => trackPoints(samples, scale), [samples, scale]);

  const snap = pointer ? findSnap(pointer.x, pointer.y, current, points, scale) : null;
  const inPlot = pointer !== null && pointer.x >= scale.left && pointer.x <= scale.right;

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    // Se calcula aqui y no con el estado: en pantallas tactiles no hay hover antes del toque.
    const { x, y } = pointerIn(event);
    const target = findSnap(x, y, current, points, scale);
    if (target?.kind === 'track') onSelectTime(samples[target.index].time);
  }

  return (
    <>
      <svg
        viewBox={`0 0 ${scale.width} ${scale.height}`}
        width={scale.width}
        height={scale.height}
        role="img"
        aria-label={description}
        className={`absolute inset-0 block touch-pan-y ${snap?.kind === 'track' ? 'cursor-pointer' : ''}`}
        onPointerMove={(event) => setPointer(pointerIn(event))}
        onPointerLeave={() => setPointer(null)}
        onClick={handleClick}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={scale.left} y={scale.top} width={scale.right - scale.left} height={scale.bottom - scale.top} />
          </clipPath>
        </defs>

        {/* Solo en el area del cielo; el terreno, que se pinta despues, tapa las de abajo. */}
        <StarField
          x={scale.left}
          y={scale.top}
          width={scale.right - scale.left}
          height={scale.bottom - scale.top}
        />
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

        {snap ? (
          <SnapHighlight snap={snap} scale={scale} />
        ) : (
          inPlot && <PanoramaCrosshair azimuth={scale.azimuthAt(pointer.x)} horizon={horizon} scale={scale} />
        )}
      </svg>

      {snap ? (
        <SnapTooltip snap={snap} samples={samples} current={current} scale={scale} />
      ) : (
        inPlot && (
          <PanoramaTooltip
            target={{
              kind: 'ground',
              azimuth: scale.azimuthAt(pointer.x),
              terrain: horizonAt(horizon, scale.azimuthAt(pointer.x)),
            }}
            x={pointer.x}
            y={pointer.y}
            scale={scale}
          />
        )
      )}
    </>
  );
}
