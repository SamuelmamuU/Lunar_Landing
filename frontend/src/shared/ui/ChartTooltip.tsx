import type { ReactNode } from 'react';

interface Props {
  /** Punto al que se ancla la tarjeta, en px dentro de su contenedor (que debe ser `relative`). */
  x: number;
  y: number;
  /** true = se abre hacia la izquierda del punto (para no salirse por la derecha). */
  flipX: boolean;
  /** true = se abre hacia arriba del punto (para no salirse por abajo). */
  flipY?: boolean;
  children: ReactNode;
}

const GAP_PX = 12;

/**
 * Tarjeta de datos junto al cursor para las graficas oscuras (panorama y linea de tiempo). Solo visual: los
 * mismos datos estan en texto en otra parte, por eso va con aria-hidden.
 */
export function ChartTooltip({ x, y, flipX, flipY = false, children }: Props) {
  const dx = flipX ? `calc(-100% - ${GAP_PX}px)` : `${GAP_PX}px`;
  const dy = flipY ? `calc(-100% - ${GAP_PX}px)` : `${GAP_PX}px`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 w-max max-w-72 rounded-md border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-xs text-slate-100 tabular-nums"
      style={{ left: x, top: y, transform: `translate(${dx}, ${dy})` }}
    >
      {children}
    </div>
  );
}
