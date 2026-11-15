// Textos del estado de un cuerpo en un instante (sin React). `visible` y la fraccion vienen de backend:
// aqui solo se redactan, con la misma clasificacion que colorea los enlaces de la vista desde arriba.

import { compassPoint, formatDegrees } from '../../shared/lib/angles';
import { clearance, linkState } from '../../shared/lib/visibility';
import type { BodyPosition } from '../../shared/types/lunar';

/** "visible" | "visible por poco" | "parcialmente visible" | "oculto". */
export function visibilityWord(position: BodyPosition): string {
  switch (linkState(position)) {
    case 'blocked':
      return 'oculto';
    case 'marginal':
      return position.visibleFraction < 1 ? 'parcialmente visible' : 'visible por poco';
    case 'clear':
      return 'visible';
  }
}

/**
 * "1.6° sobre el terreno" | "0.6° bajo el terreno" | "asoma el 9% del disco".
 * Con el disco a medias se habla del disco: su centro puede estar ya bajo el cerro.
 */
export function describeMargin(position: BodyPosition): string {
  if (position.visible && position.visibleFraction < 1) {
    return `asoma el ${Math.round(position.visibleFraction * 100)}% del disco`;
  }
  const margin = clearance(position);
  return `${formatDegrees(Math.abs(margin))} ${margin >= 0 ? 'sobre' : 'bajo'} el terreno`;
}

/** "1.6° sobre el terreno, visible" (para lectores de pantalla). */
export function describeVisibility(position: BodyPosition): string {
  return `${describeMargin(position)}, ${visibilityWord(position)}`;
}

/** "elevación 2.5°, azimut 66° (ENE)" */
export function describePosition(position: BodyPosition): string {
  const azimuth = formatDegrees(position.azimuth, 0);
  return `elevación ${formatDegrees(position.elevation)}, azimut ${azimuth} (${compassPoint(position.azimuth)})`;
}
