import type { EphemerisSample } from '../../shared/types/lunar';
import { PanoramaTooltip } from './PanoramaTooltip';
import { discRadius, type PanoramaScale } from './panoramaScale';
import type { Snap } from './panoramaSnap';

interface Props {
  snap: Snap;
  samples: EphemerisSample[];
  current: EphemerisSample;
  scale: PanoramaScale;
}

/** Tarjeta del cuerpo al que se pego el cursor. Junto a un disco se ancla fuera de el, para no taparlo. */
export function SnapTooltip({ snap, samples, current, scale }: Props) {
  const sample = snap.kind === 'disc' ? current : samples[snap.index];
  const reach = snap.kind === 'disc' ? discRadius(snap.body, scale) : 0;
  const x = snap.x + (snap.x > (scale.left + scale.right) / 2 ? -reach : reach);
  const y = snap.y + (snap.y > (scale.top + scale.bottom) / 2 ? -reach : reach);

  return (
    <PanoramaTooltip
      target={{
        kind: 'body',
        body: snap.body,
        position: sample[snap.body],
        time: snap.kind === 'track' ? sample.time : null,
      }}
      x={x}
      y={y}
      scale={scale}
    />
  );
}
