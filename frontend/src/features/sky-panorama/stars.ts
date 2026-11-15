// Estrellas de fondo (decorativas, sin React). En la Luna no hay atmosfera: el cielo es negro y con
// estrellas tambien de dia. Son un mosaico que se repite; las posiciones salen de una semilla fija, asi no
// cambian entre renders ni al redimensionar.

export interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

/** Tamano del mosaico que se repite, en pixeles. */
export const STAR_TILE = { width: 180, height: 140 };
const STAR_COUNT = 16;

/** Generador pseudoaleatorio con semilla (mulberry32): siempre da la misma secuencia. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seededRandom(7);

/** Casi todas chiquitas y tenues; unas pocas un poco mas brillantes para que no se vea una rejilla pareja. */
export const STARS: Star[] = Array.from({ length: STAR_COUNT }, () => {
  const x = random() * STAR_TILE.width;
  const y = random() * STAR_TILE.height;
  const bright = random() > 0.85;
  return {
    x,
    y,
    r: bright ? 1.1 : 0.4 + random() * 0.5,
    opacity: bright ? 0.45 : 0.15 + random() * 0.2,
  };
});
