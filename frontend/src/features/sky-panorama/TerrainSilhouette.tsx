import type { HorizonProfile } from '../../shared/types/lunar';
import { terrainAreaPath, terrainLinePath, type PanoramaScale } from './panoramaScale';

interface Props {
  horizon: HorizonProfile;
  scale: PanoramaScale;
}

/** Silueta del terreno: relleno opaco (tapa lo que queda detras) y la cresta mas clara encima. */
export function TerrainSilhouette({ horizon, scale }: Props) {
  return (
    <g>
      <path d={terrainAreaPath(horizon, scale)} className="fill-slate-700" />
      <path d={terrainLinePath(horizon, scale)} fill="none" strokeLinejoin="round" className="stroke-slate-300 stroke-[1.5]" />
    </g>
  );
}
