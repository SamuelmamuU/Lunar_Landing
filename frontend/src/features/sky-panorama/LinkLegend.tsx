import { LinkKey } from './LinkKey';
import { LINK_STATES, LINK_STYLE } from './linkStyle';

/** Leyenda de los enlaces de la vista desde arriba. */
export function LinkLegend() {
  return (
    <ul aria-label="Enlace con el sitio" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
      {LINK_STATES.map((state) => (
        <li key={state} className="flex items-center gap-2">
          <LinkKey state={state} />
          {LINK_STYLE[state].label}
        </li>
      ))}
    </ul>
  );
}
