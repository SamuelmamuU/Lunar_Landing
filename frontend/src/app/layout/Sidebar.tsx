import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/** Panel lateral. En pantallas grandes es una columna fija de 24rem con scroll propio. */
export function Sidebar({ children }: Props) {
  return (
    <aside className="flex max-h-[60vh] flex-col gap-6 border-b border-slate-300 bg-slate-100 p-4 sm:px-6 lg:max-h-none lg:w-96 lg:shrink-0 lg:border-r lg:border-b-0">
      {children}
    </aside>
  );
}
