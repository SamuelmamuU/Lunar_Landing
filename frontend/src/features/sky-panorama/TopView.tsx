import { BODY_IDS } from '../../shared/lib/bodies';
import type { EphemerisSample } from '../../shared/types/lunar';
import { StarField } from './StarField';
import { TopViewBody } from './TopViewBody';
import { CARDINAL_RADIUS, CENTER, ORBIT_RADIUS, SITE_RADIUS, TOP_VIEW_SIZE, polarToPoint } from './topViewGeometry';

interface Props {
  /** Instante que se muestra (el mismo que el panorama). */
  current: EphemerisSample;
  /** Texto para lectores de pantalla. */
  description: string;
}

const CARDINALS = [
  { azimuth: 0, label: 'N' },
  { azimuth: 90, label: 'E' },
  { azimuth: 180, label: 'S' },
  { azimuth: 270, label: 'W' },
];

/**
 * Vista desde arriba: el sitio al centro, Sol y Tierra en su direccion, cada uno en una orbita fija,
 * y el enlace de cada uno con el sitio. Responde de un vistazo "tengo luz?" y "tengo comunicacion?".
 */
export function TopView({ current, description }: Props) {
  return (
    <svg
      viewBox={`0 0 ${TOP_VIEW_SIZE} ${TOP_VIEW_SIZE}`}
      role="img"
      aria-label={description}
      className="block aspect-square w-full rounded-lg bg-black"
    >
      {/* Mas tenues que en el panorama: aqui manda el panorama. */}
      <StarField x={0} y={0} width={TOP_VIEW_SIZE} height={TOP_VIEW_SIZE} intensity={0.6} />

      {BODY_IDS.map((body) => (
        <circle key={body} cx={CENTER} cy={CENTER} r={ORBIT_RADIUS[body]} fill="none" className="stroke-white/30" />
      ))}

      {CARDINALS.map(({ azimuth, label }) => {
        const { x, y } = polarToPoint(azimuth, CARDINAL_RADIUS);
        return (
          <text key={label} x={x} y={y + 4} textAnchor="middle" className="fill-slate-300 text-xs font-semibold">
            {label}
          </text>
        );
      })}

      {BODY_IDS.map((body) => (
        <TopViewBody key={body} body={body} position={current[body]} />
      ))}

      <circle cx={CENTER} cy={CENTER} r={SITE_RADIUS} className="fill-slate-50 stroke-slate-950 stroke-2" />
    </svg>
  );
}
