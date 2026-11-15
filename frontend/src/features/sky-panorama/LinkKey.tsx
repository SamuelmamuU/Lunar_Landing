import type { LinkState } from '../../shared/lib/visibility';
import { LINK_STYLE } from './linkStyle';

interface Props {
  state: LinkState;
}

/** Muestra corta del trazo de un estado del enlace, para la leyenda. Decorativa: va junto a su texto. */
export function LinkKey({ state }: Props) {
  const { strokeClass, dashArray } = LINK_STYLE[state];
  return (
    <svg viewBox="0 0 24 6" aria-hidden="true" className="h-1.5 w-6 shrink-0 overflow-visible">
      <line
        x1={1.5}
        y1={3}
        x2={22.5}
        y2={3}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={dashArray}
        className={strokeClass}
      />
    </svg>
  );
}
