import { useCallback, useEffect, useState } from 'react';
import { getSites } from '../../services/lunarApi';
import type { LandingSite } from '../../shared/types/lunar';

type SitesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; sites: LandingSite[] };

/** Carga el catalogo de sitios una vez, con estados de carga y error. */
export function useSites() {
  const [state, setState] = useState<SitesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSites()
      .then((sites) => {
        if (!cancelled) setState({ status: 'ready', sites });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
