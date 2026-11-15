import type { LinkState } from '../../shared/lib/visibility';
import { HIDDEN_DASH } from './bandStyle';

interface Props {
  state: LinkState;
}

/**
 * Muestra del relleno de una banda, en gris (el relleno significa lo mismo para los dos cuerpos). Tapado no
 * tiene barra: se muestra la banda vacia con la linea punteada. Decorativa: va junto a su texto.
 */
export function BandKey({ state }: Props) {
  return (
    <svg viewBox="0 0 20 10" aria-hidden="true" className="h-2.5 w-5 shrink-0">
      {state === 'clear' && <rect width={20} height={10} rx={2} className="fill-slate-300" />}
      {state === 'marginal' && (
        <>
          <rect width={20} height={10} rx={2} className="fill-slate-900" />
          <path d="M-2 10L8 0M4 10L14 0M10 10L20 0M16 10L26 0" strokeWidth={2} className="stroke-slate-300" />
        </>
      )}
      {state === 'blocked' && (
        <>
          <rect width={20} height={10} rx={2} className="fill-slate-900" />
          <line x1={2} x2={18} y1={5} y2={5} strokeWidth={1.5} strokeDasharray={HIDDEN_DASH} className="stroke-slate-300" />
        </>
      )}
    </svg>
  );
}
