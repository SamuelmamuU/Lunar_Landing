import { useAppStore } from '../../app/store';
import { regionSummary } from '../../shared/lib/coords';
import { Coordinates } from '../../shared/ui/Coordinates';

/**
 * Sitio seleccionado: nombre, coordenadas y agencia, y que significa su region para Sol y Tierra.
 * Es contexto, no el foco: el protagonista del main es la grafica del horizonte (slice 3).
 */
export function ActiveScenarioSummary() {
  const scenario = useAppStore((s) => s.activeScenario);

  if (!scenario) {
    return (
      <div className="rounded-lg border border-dashed border-slate-400 p-6 text-slate-600">
        <p className="font-medium text-slate-800">Elige un sitio para empezar.</p>
        <p className="mt-1 text-sm">
          Toma uno del catalogo o escribe coordenadas propias. Despues vas a ver donde estan el Sol y
          la Tierra respecto al horizonte de ese lugar.
        </p>
      </div>
    );
  }

  const { site } = scenario;

  return (
    <section aria-label="Sitio seleccionado" className="min-w-0">
      {/* La descripcion queda como tooltip: es contexto para quien la busque. */}
      <h2 className="truncate text-xl font-bold text-blue-600" title={site.description ?? site.name}>
        {site.name}
      </h2>
      <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
        <Coordinates lat={site.lat} lon={site.lon} />
        {/* La agencia es contexto: gris, para que el ojo vaya primero a las coordenadas. */}
        {site.agency && <span className="text-slate-500">{site.agency}</span>}
      </p>
      <p className="mt-1 text-xs text-slate-500">{regionSummary(site.lat, site.lon)}</p>
    </section>
  );
}
