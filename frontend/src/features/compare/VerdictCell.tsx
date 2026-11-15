import type { EphemerisState } from '../../app/store';
import { Button } from '../../shared/ui/Button';

interface Props {
  state: EphemerisState;
  onRetry: () => void;
}

/**
 * Veredicto de un escenario: CANDIDATO o NO CANDIDATO con los motivos de backend. Verde y rojo son el
 * semaforo; el veredicto siempre va tambien en texto. Si la carga fallo, aqui va el error y el reintento.
 */
export function VerdictCell({ state, onRetry }: Props) {
  if (state.status === 'error') {
    return (
      <td className="px-3 py-2.5 align-top">
        <p role="alert" className="text-sm text-red-700">
          No se pudo calcular: {state.error}
        </p>
        <Button variant="link" className="mt-1 text-red-800" onClick={onRetry}>
          Reintentar
        </Button>
      </td>
    );
  }

  if (!state.data) {
    return (
      <td className="px-3 py-2.5 align-top">
        <span className="block h-6 w-28 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        <span className="sr-only">Calculando…</span>
      </td>
    );
  }

  const { isCandidate, reasons } = state.data.verdict;

  return (
    <td className="px-3 py-2.5 align-top">
      <p
        className={`w-fit rounded-md border px-2 py-0.5 text-sm font-bold ${
          isCandidate ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}
      >
        {isCandidate ? 'CANDIDATO' : 'NO CANDIDATO'}
      </p>
      {reasons.length > 0 && (
        <ul className="mt-1.5 max-w-56 space-y-0.5 text-xs text-slate-600">
          {reasons.map((reason, index) => (
            <li key={`${index}-${reason}`}>{reason}</li>
          ))}
        </ul>
      )}
    </td>
  );
}
