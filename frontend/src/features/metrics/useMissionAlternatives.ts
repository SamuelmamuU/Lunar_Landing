import { useState } from 'react';
import { getMissionAlternatives } from '../../services/lunarApi';
import { scenarioKey, scenarioToMissionRequest } from '../../shared/lib/scenario';
import type { MissionAlternatives, Scenario } from '../../shared/types/lunar';

export type AlternativesState =
  | { status: 'loading' }
  | { status: 'ready'; data: MissionAlternatives }
  | { status: 'error'; error: string };

/**
 * Fechas alternativas del escenario activo (extra F7a). Solo se piden con `search()`: la busqueda tarda ~1.5 s
 * en backend y ocupa la cola de SPICE. Lo buscado para otro escenario se descarta solo.
 */
export function useMissionAlternatives(scenario: Scenario | null) {
  const [result, setResult] = useState<{ key: string; state: AlternativesState } | null>(null);
  const key = scenario ? scenarioKey(scenario) : null;
  const state = result && result.key === key ? result.state : null;

  async function search() {
    if (!scenario || !key) return;
    // Una respuesta que llega tarde (de un escenario anterior) no pisa la busqueda del actual.
    const settle = (next: AlternativesState) =>
      setResult((prev) => (prev === null || prev.key === key ? { key, state: next } : prev));

    setResult({ key, state: { status: 'loading' } });
    try {
      settle({ status: 'ready', data: await getMissionAlternatives(scenarioToMissionRequest(scenario)) });
    } catch (err: unknown) {
      settle({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return { state, search };
}
