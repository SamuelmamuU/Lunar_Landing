import type { EphemerisState } from '../../app/store';
import { Button } from '../../shared/ui/Button';

interface Props {
  status: EphemerisState['status'];
  error: string | null;
  onRetry: () => void;
}

/**
 * Aviso de carga de efemerides: "Calculando..." mientras carga y el error con "Reintentar".
 * Cuando los datos estan listos no muestra nada (la grafica del slice 3 es la que los usa).
 */
export function EphemerisLoadNotice({ status, error, onRetry }: Props) {
  if (status === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 text-sm text-red-800">
        <p className="font-medium">Could not calculate the Sun and Earth positions.</p>
        <p className="mt-1 text-red-700">{error}</p>
        <Button variant="link" onClick={onRetry} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  // La region viva existe siempre (para lectores de pantalla) y reserva su alto para que nada salte.
  return (
    <p role="status" className="min-h-1 text-sm text-slate-500">
      {status === 'loading' && 'Calculating Sun and Earth positions...'}
    </p>
  );
}
