import { useAppStore } from '../../app/store';
import { EphemerisLoadNotice } from './EphemerisLoadNotice';
import { useEphemeris } from './useEphemeris';

/** Carga las efemerides del escenario activo y avisa si esta cargando o si fallo. */
export function EphemerisStatus() {
  const scenario = useAppStore((s) => s.activeScenario);
  const ephemeris = useEphemeris(scenario);
  return <EphemerisLoadNotice state={ephemeris} />;
}
