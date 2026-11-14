import { lunarRegion, REGION_LABEL, type LunarRegion } from '../lib/coords';

// Un color por region. Siempre va con texto, nunca solo color.
// No usar rojo/ambar/verde: estan reservados para estados (ver CLAUDE.md).
const REGION_STYLE: Record<LunarRegion, string> = {
  'south-pole': 'bg-sky-100 text-sky-800 ring-sky-200',
  'far-side': 'bg-violet-100 text-violet-800 ring-violet-200',
  'near-side': 'bg-slate-100 text-slate-700 ring-slate-200',
};

interface Props {
  lat: number;
  lon: number;
  size?: 'sm' | 'md';
}

/** Etiqueta de region lunar (Polo sur, Lado oculto, Lado visible). */
export function RegionBadge({ lat, lon, size = 'sm' }: Props) {
  const region = lunarRegion(lat, lon);
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${sizeClass} ${REGION_STYLE[region]}`}>
      {REGION_LABEL[region]}
    </span>
  );
}
