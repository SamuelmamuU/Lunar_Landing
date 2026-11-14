import type { ReactNode } from 'react';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { Sidebar } from './Sidebar';

interface Props {
  /** Contenido del panel lateral (selector de sitio, formulario de escenario...). */
  sidebar: ReactNode;
  /** Contenido de la ventana principal (panorama, metricas, comparador...). */
  children: ReactNode;
}

/**
 * Armazon de la app: header arriba, sidebar a la izquierda y ventana principal.
 * En movil el sidebar queda arriba de la ventana principal.
 */
export function AppLayout({ sidebar, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-200 text-slate-900 lg:h-screen">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <Sidebar>{sidebar}</Sidebar>
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
