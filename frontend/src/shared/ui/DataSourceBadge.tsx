import { WarningBadge } from './WarningBadge';

/** Aviso de que los datos son sinteticos (mock). */
export function DataSourceBadge() {
  return <WarningBadge>Datos sinteticos: no usar para decisiones reales</WarningBadge>;
}
