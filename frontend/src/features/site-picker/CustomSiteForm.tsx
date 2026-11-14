import { useId, useState, type FormEvent } from 'react';
import { useAppStore } from '../../app/store';
import {
  formatLat,
  formatLon,
  parseCoordinate,
  validateLat,
  validateLon,
} from '../../shared/lib/coords';

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
  const ids = { name: useId(), lat: useId(), lon: useId(), latErr: useId(), lonErr: useId() };

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
    setName('');
    setLat('');
    setLon('');
    setTouched({ lat: false, lon: false });
    onDone();
  }

  const showLatError = touched.lat && latError;
  const showLonError = touched.lon && lonError;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <div>
        <label htmlFor={ids.name} className="block text-sm font-medium text-slate-700">
          Nombre <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <input
          id={ids.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mi sitio candidato"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CoordinateInput
          id={ids.lat}
          errorId={ids.latErr}
          label="Latitud"
          hint="-90 a 90"
          placeholder="-89.45"
          value={lat}
          error={showLatError || null}
          onChange={setLat}
          onBlur={() => setTouched((t) => ({ ...t, lat: true }))}
        />
        <CoordinateInput
          id={ids.lon}
          errorId={ids.lonErr}
          label="Longitud"
          hint="-180 a 180"
          placeholder="-137.3"
          value={lon}
          error={showLonError || null}
          onChange={setLon}
          onBlur={() => setTouched((t) => ({ ...t, lon: true }))}
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

interface CoordinateInputProps {
  id: string;
  errorId: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function CoordinateInput({ id, errorId, label, hint, placeholder, value, error, onChange, onBlur }: CoordinateInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label} <span className="font-normal text-slate-500">({hint})</span>
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1 w-full rounded-md border bg-white px-2.5 py-1.5 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 ${
          error
            ? 'border-red-600 focus-visible:ring-red-600/40'
            : 'border-slate-300 focus:border-orange-600 focus-visible:ring-orange-600/40'
        }`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
