import { BODIES, type BodyId } from '../../shared/lib/bodies';
import type { EphemerisSample } from '../../shared/types/lunar';
import { trackPath, type PanoramaScale } from './panoramaScale';

interface Props {
  body: BodyId;
  samples: EphemerisSample[];
  scale: PanoramaScale;
}

/** Recorrido tenue del cuerpo durante toda la ventana. Va detras del terreno. */
export function BodyTrack({ body, samples, scale }: Props) {
  return (
    <path
      d={trackPath(samples, body, scale)}
      fill="none"
      stroke={BODIES[body].color}
      strokeWidth={1.5}
      strokeOpacity={0.55}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}
