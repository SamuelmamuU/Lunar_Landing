interface Props {
  className?: string;
}

/**
 * Sol para el boton de modo claro: disco relleno y rayos gruesos, legible a 16 px. No es el icono del Sol de los
 * datos (SunIcon, con su color fijo): ese tiene rayos de punto y a este tamano se ve como un puntito.
 */
export function LightModeIcon({ className = 'size-4' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="3" stroke="none" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  );
}
