import { useAppStore } from '../../app/store';
import { Coordinates } from '../../shared/ui/Coordinates';
import { DataField } from '../../shared/ui/DataField';
import { RegionBadge } from '../../shared/ui/RegionBadge';

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
  const hasMissionData = Boolean(site.mission || site.agency || site.landedAt);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <RegionBadge lat={site.lat} lon={site.lon} size="md" />
      <h2 className="mt-2 text-2xl text-slate-900">{site.name}</h2>
      <div className="mt-2">
        <Coordinates lat={site.lat} lon={site.lon} digits={3} variant="chip" />
      </div>

      {site.description && <p className="mt-3 max-w-prose text-sm text-slate-700">{site.description}</p>}

      {hasMissionData && (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border-l-4 border-teal-500 bg-teal-50/60 px-4 py-3 text-sm sm:grid-cols-3">
          {site.mission && <DataField label="Mision" value={site.mission} tone="accent" />}
          {site.agency && <DataField label="Agencia" value={site.agency} tone="accent" />}
          {site.landedAt && (
            <DataField label="Alunizo" value={dateFormatter.format(new Date(site.landedAt))} tone="accent" />
          )}
        </dl>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <DataField label="Inicio (UTC)" value={dateFormatter.format(new Date(scenario.start))} />
        <DataField label="Duracion" value={`${scenario.durationDays} dias`} />
        <DataField label="Paso" value={`${scenario.stepMinutes} min`} />
      </dl>
    </article>
  );
}
