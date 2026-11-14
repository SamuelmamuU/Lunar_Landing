import { formatLat, formatLon, lunarRegion, REGION_LABEL } from '../../shared/lib/coords';
import { useAppStore } from '../../app/store';
import { DataField } from '../../shared/ui/DataField';

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/** Muestra el escenario activo. Fecha/duracion/paso se vuelven editables en el slice 2. */
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
    <article className="rounded-lg border border-slate-300 bg-white p-5">
      <p className="text-sm text-slate-500">{REGION_LABEL[lunarRegion(site.lat, site.lon)]}</p>
      <h2 className="mt-0.5 text-2xl font-bold text-slate-900">{site.name}</h2>
      <p className="mt-1 text-sm tabular-nums text-slate-700">
        {formatLat(site.lat, 3)}, {formatLon(site.lon, 3)}
      </p>

      {site.description && <p className="mt-3 max-w-prose text-sm text-slate-700">{site.description}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        {site.mission && <DataField label="Mision" value={site.mission} />}
        {site.agency && <DataField label="Agencia" value={site.agency} />}
        {site.landedAt && <DataField label="Alunizo" value={dateFormatter.format(new Date(site.landedAt))} />}
        <DataField label="Inicio" value={`${dateFormatter.format(new Date(scenario.start))} (UTC)`} />
        <DataField label="Duracion" value={`${scenario.durationDays} dias`} />
        <DataField label="Paso" value={`${scenario.stepMinutes} min`} />
      </dl>
    </article>
  );
}
