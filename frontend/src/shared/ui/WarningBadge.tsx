import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/** Aviso corto en ambar: algo que el usuario debe saber antes de confiar en lo que ve. */
export function WarningBadge({ children }: Props) {
  return (
    <p className="w-fit rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
      {children}
    </p>
  );
}
