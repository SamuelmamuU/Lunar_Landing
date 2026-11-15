// Textos del estado de un cuerpo en un instante (sin React). `visible` y la fraccion vienen de backend:
// aqui solo se redactan, con la misma clasificacion que colorea los enlaces de la vista cenital.

import { compassPoint, formatDegrees } from '../../shared/lib/angles';
import { clearance, linkState } from '../../shared/lib/visibility';
import type { BodyPosition } from '../../shared/types/lunar';

/**
 * "1.6° sobre el terreno, visible" | "... visible por poco" | "... oculto" |
 * "asoma el 9% del disco sobre el terreno, parcialmente visible" (el centro puede estar ya bajo el cerro).
 */
export function describeVisibility(position: BodyPosition): string {
  const margin = clearance(position);
  const marginText = `${formatDegrees(Math.abs(margin))} ${margin >= 0 ? 'sobre' : 'bajo'} el terreno`;

  switch (linkState(position)) {
    case 'blocked':
      return `${marginText}, oculto`;
    case 'marginal':
      if (position.visibleFraction < 1) {
        const percent = Math.round(position.visibleFraction * 100);
        return `asoma el ${percent}% del disco sobre el terreno, parcialmente visible`;
      }
      return `${marginText}, visible por poco`;
    case 'clear':
      return `${marginText}, visible`;
  }
}

/** "elevación 2.5°, azimut 66° (ENE)" */
export function describePosition(position: BodyPosition): string {
  const azimuth = formatDegrees(position.azimuth, 0);
  return `elevación ${formatDegrees(position.elevation)}, azimut ${azimuth} (${compassPoint(position.azimuth)})`;
}
