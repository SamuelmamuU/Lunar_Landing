/** Aviso de que los datos son sinteticos (mock). */
export function DataSourceBadge() {
  return (
    <p
      role="status"
      className="rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
    >
      Datos sinteticos: no usar para decisiones reales
    </p>
  );
}
