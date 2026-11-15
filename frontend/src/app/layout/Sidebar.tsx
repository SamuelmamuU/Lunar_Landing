import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import { SidebarExpandIcon } from '../../shared/ui/icons/SidebarExpandIcon';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';
import { useAppStore } from '../store';

interface Props {
  children: ReactNode;
}

/**
 * Panel lateral. En pantallas grandes es una columna fija de 24rem con scroll propio.
 * Contraido (el boton esta en el contenido, junto a "Nuevo punto") queda un riel angosto con el boton para
 * expandir y el de modo claro / oscuro. El contenido se oculta pero no se desmonta: la busqueda y el catalogo cargado se conservan.
 */
export function Sidebar({ children }: Props) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const contentId = useId();
  const expandRef = useRef<HTMLButtonElement>(null);

  // El boton de contraer desaparece con el contenido: el foco pasa al de expandir para no perderse.
  useEffect(() => {
    if (collapsed) expandRef.current?.focus();
  }, [collapsed]);

  return (
    <aside
      className={`flex flex-col border-b border-slate-200 animate-fade-right animate-duration-500 motion-reduce:animate-none lg:shrink-0 lg:border-r lg:border-b-0 ${
        collapsed ? 'items-start px-4 py-2 lg:w-14 lg:items-center lg:px-0 lg:py-4' : 'max-h-[60vh] gap-6 p-4 sm:px-6 lg:max-h-none lg:w-96'
      }`}
    >
      {collapsed && (
        // En el riel (lg) van uno debajo del otro; en movil, en fila.
        <div className="flex gap-1 lg:flex-col">
          <Button
            ref={expandRef}
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expandir barra lateral"
            aria-controls={contentId}
            aria-expanded={false}
            title="Expandir barra lateral"
          >
            <SidebarExpandIcon />
          </Button>
          <ThemeToggle />
        </div>
      )}
      <div id={contentId} hidden={collapsed} className="flex min-h-0 flex-1 flex-col gap-6">
        {children}
      </div>
    </aside>
  );
}
