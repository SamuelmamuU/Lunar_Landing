import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/** Ventana principal: aqui van el panorama, las metricas y el comparador. */
export function MainContent({ children }: Props) {
  return <main className="scrollbar-subtle min-w-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">{children}</main>;
}
