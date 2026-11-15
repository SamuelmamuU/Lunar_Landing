import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/**
 * Ventana principal: aqui van el panorama, las metricas y el comparador.
 * `relative`: lo que va en position absolute adentro (p. ej. los textos sr-only) se mide contra este scroll y no
 * contra la pagina; si no, alarga el documento y se puede escrollear toda la pagina ademas del main.
 */
export function MainContent({ children }: Props) {
  return (
    <main className="scrollbar-subtle relative min-w-0 flex-1 space-y-2 overflow-y-auto p-4 sm:p-6">{children}</main>
  );
}
