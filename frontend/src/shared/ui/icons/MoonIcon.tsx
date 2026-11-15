interface Props {
  className?: string;
}

/** Icono de luna (forma de Lucide "moon", licencia ISC), relleno. Decorativo: el boton lleva aria-label. */
export function MoonIcon({ className = 'size-4' }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
