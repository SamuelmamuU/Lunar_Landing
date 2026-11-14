import { useState, type FormEvent } from 'react';
import { useAppStore } from '../../app/store';
import { formatLat, formatLon, parseCoordinate, validateLat, validateLon } from '../../shared/lib/coords';
import { TextField } from '../../shared/ui/TextField';

interface Props {
  onDone: () => void;
}

/** Formulario para elegir un punto cualquiera por latitud y longitud. */
export function CustomSiteForm({ onDone }: Props) {
  const addCustomSite = useAppStore((s) => s.addCustomSite);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [touched, setTouched] = useState({ lat: false, lon: false });

  const latError = validateLat(lat);
  const lonError = validateLon(lon);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ lat: true, lon: true });
    if (latError || lonError) return;
    const latValue = parseCoordinate(lat)!;
    const lonValue = parseCoordinate(lon)!;
    addCustomSite({
      name: name.trim() || `Punto ${formatLat(latValue)}, ${formatLon(lonValue)}`,
      lat: latValue,
      lon: lonValue,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <TextField label="Nombre" hint="opcional" value={name} onChange={setName} placeholder="Mi sitio candidato" />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Latitud"
          hint="-90 a 90"
          value={lat}
          onChange={setLat}
          onBlur={() => setTouched((t) => ({ ...t, lat: true }))}
          error={touched.lat ? latError : null}
          placeholder="-89.45"
          inputMode="decimal"
          autoComplete="off"
        />
        <TextField
          label="Longitud"
          hint="-180 a 180"
          value={lon}
          onChange={setLon}
          onBlur={() => setTouched((t) => ({ ...t, lon: true }))}
          error={touched.lon ? lonError : null}
          placeholder="-137.3"
          inputMode="decimal"
          autoComplete="off"
        />
      </div>

      <p className="text-xs text-slate-500">Sur y oeste son negativos.</p>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600/40 focus-visible:ring-offset-2"
        >
          Usar este punto
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600/40"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
