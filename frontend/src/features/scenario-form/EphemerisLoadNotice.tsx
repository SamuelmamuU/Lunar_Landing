import { Button } from '../../shared/ui/Button';
import type { EphemerisState } from './useEphemeris';

interface Props {
  state: EphemerisState & { retry: () => void };
}

/**
 * Aviso de carga de efemerides: "Calculando..." mientras carga y el error con "Reintentar".
 * Cuando los datos estan listos no muestra nada (la grafica del slice 3 es la que los usa).
 */
export function EphemerisLoadNotice({ state }: Props) {
  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">No se pudieron calcular las posiciones del Sol y la Tierra.</p>
        <p className="mt-1 text-red-700">{state.message}</p>
        <Button variant="link" onClick={state.retry} className="mt-2">
          Reintentar
        </Button>
      </div>
    );
  }

  // La region viva existe siempre (para lectores de pantalla) y reserva su alto para que nada salte.
  return (
    <p role="status" className="min-h-5 text-sm text-slate-500">
      {state.status === 'loading' && 'Calculando posiciones del Sol y la Tierra...'}
    </p>
  );
}
