import type { Vec3 } from '../types/lunar';

const DEG = Math.PI / 180;

/** Convierte (azimut, elevacion) grados a vector unitario topocentrico Three.js (+X=Este, +Y=Zenit, -Z=Norte). */
export function azElToSkyVector(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  const cosEl = Math.cos(el);
  return [
    Number((cosEl * Math.sin(az)).toFixed(6)),
    Number(Math.sin(el).toFixed(6)),
    Number((-cosEl * Math.cos(az)).toFixed(6)),
  ];
}

/** Calcula la base local (east, north, up) en coordenadas MOON_ME a partir de lat/lon en grados. */
export function moonMeBasis(latDeg: number, lonDeg: number): { east: Vec3; north: Vec3; up: Vec3 } {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const cosLat = Math.cos(lat);
  const up: Vec3 = [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];

  if (Math.abs(cosLat) < 1e-7) {
    return {
      east: [0, 1, 0],
      north: [up[2] * 1, 0, 0],
      up,
    };
  }

  const east: Vec3 = [-Math.sin(lon), Math.cos(lon), 0];
  // north = up x east (producto cruz en mano derecha)
  const north: Vec3 = [
    up[1] * east[2] - up[2] * east[1],
    up[2] * east[0] - up[0] * east[2],
    up[0] * east[1] - up[1] * east[0],
  ];
  return { east, north, up };
}

/** Convierte (az, el) topocentricos de un sitio a vector unitario en marco MOON_ME. */
export function azElToMoonMe(latDeg: number, lonDeg: number, azDeg: number, elDeg: number): Vec3 {
  const { east, north, up } = moonMeBasis(latDeg, lonDeg);
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  const cEl = Math.cos(el);
  const sEl = Math.sin(el);
  const sAz = Math.sin(az);
  const cAz = Math.cos(az);

  return [
    cEl * sAz * east[0] + cEl * cAz * north[0] + sEl * up[0],
    cEl * sAz * east[1] + cEl * cAz * north[1] + sEl * up[1],
    cEl * sAz * east[2] + cEl * cAz * north[2] + sEl * up[2],
  ];
}

/** Rota un vector MOON_ME [X=meridiano0, Y=90E, Z=poloN] a Three.js [X=90E, Y=poloN, Z=meridiano0]. */
export function moonMeToThree(v: Vec3): Vec3 {
  return [v[1], v[2], v[0]];
}
