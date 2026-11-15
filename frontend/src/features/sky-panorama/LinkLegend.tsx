import { LinkKey } from './LinkKey';
import { LINK_STATES, LINK_STYLE } from './linkStyle';

/** Leyenda de los enlaces (vista desde arriba y textos del panel). Va sobre fondo oscuro. */
export function LinkLegend() {
  return (
    <ul aria-label="Line to the site" className="space-y-1 text-xs text-slate-200">
      {LINK_STATES.map((state) => (
        <li key={state} className="flex items-center gap-2">
          <LinkKey state={state} />
          {LINK_STYLE[state].label}
        </li>
      ))}
    </ul>
  );
}
