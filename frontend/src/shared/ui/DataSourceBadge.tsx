import { WarningBadge } from './WarningBadge';

/** Aviso de que los datos son sinteticos (mock). */
export function DataSourceBadge() {
  return <WarningBadge>Synthetic data: do not use for real decisions</WarningBadge>;
}
