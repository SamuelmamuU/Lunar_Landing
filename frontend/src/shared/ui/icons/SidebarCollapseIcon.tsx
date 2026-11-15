interface Props {
  className?: string;
}

/** Icono para contraer la barra lateral (flecha hacia el panel). Decorativo: el boton lleva aria-label. */
export function SidebarCollapseIcon({ className = 'size-4' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
      <path d="M6 2.75v10.5" />
      <polyline points="10.75 5.75 8.75 8 10.75 10.25" />
    </svg>
  );
}
