import { BODIES } from '../../shared/lib/bodies';
import { discRadius, type PanoramaScale } from './panoramaScale';
import type { Snap } from './panoramaSnap';

interface Props {
  snap: Snap;
  scale: PanoramaScale;
}

/** Marca de a que se pego el cursor: un anillo alrededor del disco, o un punto sobre el recorrido. */
export function SnapHighlight({ snap, scale }: Props) {
  if (snap.kind === 'disc') {
    const r = discRadius(snap.body, scale) + 5;
    return (
      <g pointerEvents="none" fill="none">
        <circle cx={snap.x} cy={snap.y} r={r} strokeWidth={4} className="stroke-black" />
        <circle cx={snap.x} cy={snap.y} r={r} strokeWidth={2} className="stroke-slate-50" />
      </g>
    );
  }
  return (
    <circle
      cx={snap.x}
      cy={snap.y}
      r={5}
      fill={BODIES[snap.body].color}
      strokeWidth={2}
      pointerEvents="none"
      className="stroke-slate-50"
    />
  );
}
