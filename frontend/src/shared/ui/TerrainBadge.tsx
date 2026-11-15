import { WarningBadge } from './WarningBadge';

/** Aviso de que el sitio no tiene relieve real: el horizonte se calcula sobre una esfera lisa. */
export function TerrainBadge() {
  return <WarningBadge>No relief: flat horizon</WarningBadge>;
}
