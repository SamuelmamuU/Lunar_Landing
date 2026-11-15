import { useState, type FormEvent } from 'react';
import { useAppStore } from '../../app/store';
import { parseCoordinate, validateLat, validateLon } from '../../shared/lib/coords';
import { Button } from '../../shared/ui/Button';
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
    addCustomSite({
      // Sin nombre: generico. Las coordenadas ya se muestran debajo del nombre en la lista y el encabezado.
      name: name.trim() || 'Custom point',
      lat: parseCoordinate(lat)!,
      lon: parseCoordinate(lon)!,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-lg border border-blue-600 bg-blue-50 p-3">
      <TextField label="Name" hint="optional" value={name} onChange={setName} placeholder="My candidate site" />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Latitude"
          hint="-90 to 90"
          value={lat}
          onChange={setLat}
          onBlur={() => setTouched((t) => ({ ...t, lat: true }))}
          error={touched.lat ? latError : null}
          placeholder="-89.45"
          inputMode="decimal"
          autoComplete="off"
        />
        <TextField
          label="Longitude"
          hint="-180 to 180"
          value={lon}
          onChange={setLon}
          onBlur={() => setTouched((t) => ({ ...t, lon: true }))}
          error={touched.lon ? lonError : null}
          placeholder="-137.3"
          inputMode="decimal"
          autoComplete="off"
        />
      </div>

      <p className="text-xs text-slate-500">South and west are negative.</p>

      <div className="flex gap-2">
        <Button type="submit">Use this point</Button>
        {/* Sobre el fondo azul del formulario, ghost sin fondo parece texto suelto: blanco con borde, como los inputs. */}
        <Button variant="ghost" className="border border-slate-300 bg-white" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
