interface Props {
  className?: string;
}

/** Icono de pausa (Bootstrap Icons "pause-fill", licencia MIT). Decorativo: el boton lleva su texto. */
export function PauseIcon({ className = 'size-4' }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5" />
    </svg>
  );
}
