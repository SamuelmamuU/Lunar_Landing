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
      name: name.trim() || 'Punto personalizado',
      lat: parseCoordinate(lat)!,
      lon: parseCoordinate(lon)!,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
        <Button type="submit">Usar este punto</Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
