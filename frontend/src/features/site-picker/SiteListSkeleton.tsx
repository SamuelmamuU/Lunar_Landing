/** Placeholder mientras carga el catalogo. */
export function SiteListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando sitios" className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-slate-200/70 motion-reduce:animate-none" />
      ))}
    </div>
  );
}
