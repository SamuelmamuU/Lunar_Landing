// Placeholder mientras carga el catalogo. Imita la forma real de la lista
// (titulo de grupo + items con nombre, coordenadas y etiqueta de region)
// para que el cambio a los datos reales no "salte".

const GROUPS = [3, 2];

export function SiteListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading sites" className="animate-pulse motion-reduce:animate-none">
      {GROUPS.map((items, g) => (
        <div key={g} className="mb-4">
          <div className="my-1.5 h-3 w-28 rounded bg-slate-200" />
          <ul className="mt-1 space-y-1">
            {Array.from({ length: items }, (_, i) => (
              <li key={i} className="px-3 py-2">
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-3 w-24 rounded bg-teal-100" />
                  <div className="h-4 w-14 rounded-full bg-slate-100" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
