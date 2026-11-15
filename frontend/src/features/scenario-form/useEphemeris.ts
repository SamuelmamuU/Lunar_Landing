import { useCallback, useEffect, useState } from 'react';
import { getEphemeris } from '../../services/lunarApi';
import { scenarioToRequest } from '../../shared/lib/scenario';
import type { EphemerisRequest, EphemerisResponse, Scenario } from '../../shared/types/lunar';

export type EphemerisState =
  | { status: 'idle' }
  /** `previous` = ultima respuesta lista, para no dejar la pantalla en blanco mientras carga. */
  | { status: 'loading'; previous: EphemerisResponse | null }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: EphemerisResponse };

type Settled =
  | { key: string; attempt: number; status: 'ready'; data: EphemerisResponse }
  | { key: string; attempt: number; status: 'error'; message: string };

/**
 * Carga las efemerides del escenario. Si el escenario cambia antes de que llegue la respuesta,
 * la respuesta vieja se descarta: solo cuenta la de la ultima peticion.
 */
export function useEphemeris(scenario: Scenario | null) {
  // La clave identifica la peticion; cambiar de sitio, fecha, duracion o paso dispara otra carga.
  const key = scenario ? JSON.stringify(scenarioToRequest(scenario)) : null;
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [lastData, setLastData] = useState<EphemerisResponse | null>(null);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    const request = JSON.parse(key) as EphemerisRequest;
    getEphemeris(request)
      .then((data) => {
        if (cancelled) return;
        setSettled({ key, attempt, status: 'ready', data });
        setLastData(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setSettled({ key, attempt, status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  let state: EphemerisState;
  if (key === null) state = { status: 'idle' };
  else if (settled && settled.key === key && settled.attempt === attempt) {
    state =
      settled.status === 'ready'
        ? { status: 'ready', data: settled.data }
        : { status: 'error', message: settled.message };
  } else state = { status: 'loading', previous: lastData };

  return { ...state, retry };
}
