import { useAppStore } from '../../app/store';
import { TerrainBadge } from '../../shared/ui/TerrainBadge';
import { EphemerisLoadNotice } from './EphemerisLoadNotice';

/**
 * Estado de las efemerides del escenario activo (el store las carga): cargando, error y los avisos
 * sobre los datos (sinteticos, sin relieve).
 */
export function EphemerisStatus() {
  const status = useAppStore((s) => s.ephemeris.status);
  const error = useAppStore((s) => s.ephemeris.error);
  const isSynthetic = useAppStore((s) => s.ephemeris.data?.source === 'mock');
  const hasNoTerrain = useAppStore((s) => s.ephemeris.data?.terrain === false);
  const loadEphemeris = useAppStore((s) => s.loadEphemeris);

  return (
    <div className="space-y-2">
      {(isSynthetic || hasNoTerrain) && (
        // Una sola region viva para los avisos: se anuncian al cambiar de sitio.
        <div role="status" className="flex flex-wrap gap-2">
          {hasNoTerrain && <TerrainBadge />}
        </div>
      )}
      <EphemerisLoadNotice status={status} error={error} onRetry={() => void loadEphemeris({ force: true })} />
    </div>
  );
}
