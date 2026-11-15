import * as THREE from 'three';
import type { HorizonProfile, LocalDemPatch } from '../../../shared/types/lunar';
import { MOON_RADIUS_M, OBSERVER_EYE_HEIGHT_M } from './lunar3dMath';

const DEG = Math.PI / 180;
export const HORIZON_RIDGE_RADIUS_M = 26000;
export const HORIZON_FOOT_RADIUS_M = 11400;
export const SKY_DOME_RADIUS_M = 44000;

/** Micro-craters y rugosidad determinista coherente con LOLA (nula junto al punto de aterrizaje). */
const MICRO_CRATERS = [
  { x: 950, z: -620, r: 210, d: 14 },
  { x: -1250, z: 880, r: 290, d: 21 },
  { x: 2100, z: 1650, r: 360, d: 24 },
  { x: -2400, z: -1950, r: 410, d: 28 },
  { x: 3400, z: -2600, r: 520, d: 34 },
  { x: -3800, z: 2700, r: 480, d: 30 },
  { x: 650, z: 1350, r: 165, d: 11 },
  { x: -780, z: -1120, r: 185, d: 12 },
];

function microReliefDelta(eastM: number, northM: number): number {
  const dist = Math.hypot(eastM, northM);
  // Preservar altura exacta LOLA en el radio de aterrizaje (< 350 m)
  const mask = THREE.MathUtils.smoothstep(dist, 320, 780);
  if (mask <= 0) return 0;

  let delta =
    Math.sin(eastM * 0.0085) * Math.cos(northM * 0.0079) * 3.8 +
    Math.sin(eastM * 0.021 + northM * 0.017) * 1.4;

  for (const c of MICRO_CRATERS) {
    const dc = Math.hypot(eastM - c.x, northM - c.z);
    if (dc < c.r * 1.35) {
      const u = dc / c.r;
      delta += u <= 1 ? -c.d * (1 - u * u) : c.d * 0.16 * Math.exp(-(((u - 1) / 0.2) ** 2));
    }
  }
  return delta * mask;
}

function createRegolithBumpTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  let seed = 2029;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Grano mineral fino (bajo relieve) + pequeños micro-impactos envolventes
  for (let i = 0; i < 1800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 1.8;
    const shade = Math.floor(102 + rand() * 52);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fillRect(x, y, r, r);
  }

  for (let i = 0; i < 65; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 3 + rand() * 8;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx < -r * 2 || cx > size + r * 2 || cy < -r * 2 || cy > size + r * 2) continue;
        ctx.strokeStyle = 'rgba(218, 218, 218, 0.32)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(54, 54, 54, 0.36)';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 36);
  return tex;
}

/** Elevacion Y local (metros relativos al sitio, con curvatura lunar) en (eastM, northM). */
export function sampleLocalElevationOffset(
  localDem: LocalDemPatch | null,
  eastM: number,
  northM: number,
  verticalScale: number,
): number {
  const curv = (eastM * eastM + northM * northM) / (2 * MOON_RADIUS_M);
  if (!localDem) return -curv;

  const { size, extentMeters, centerElevationMeters, heightsMeters } = localDem;
  const half = extentMeters / 2;
  const colF = THREE.MathUtils.clamp(((eastM + half) / extentMeters) * (size - 1), 0, size - 1);
  const rowF = THREE.MathUtils.clamp(((half - northM) / extentMeters) * (size - 1), 0, size - 1);

  const c0 = Math.floor(colF);
  const r0 = Math.floor(rowF);
  const c1 = Math.min(c0 + 1, size - 1);
  const r1 = Math.min(r0 + 1, size - 1);
  const wc = colF - c0;
  const wr = rowF - r0;

  const z00 = heightsMeters[r0][c0];
  const z01 = heightsMeters[r0][c1];
  const z10 = heightsMeters[r1][c0];
  const z11 = heightsMeters[r1][c1];
  const z = (z00 * (1 - wc) + z01 * wc) * (1 - wr) + (z10 * (1 - wc) + z11 * wc) * wr;

  return (z - centerElevationMeters + microReliefDelta(eastM, northM)) * verticalScale - curv;
}

/** Construye la malla refinada 128x128 del terreno local con micro-relieve y sombreado por pendiente. */
export function buildLocalDemMesh(
  localDem: LocalDemPatch | null,
  verticalScale: number,
): THREE.Mesh {
  const meshRes = localDem ? 128 : 48;
  const extent = localDem?.extentMeters ?? 16000;
  const segs = meshRes - 1;

  const geom = new THREE.PlaneGeometry(extent, extent, segs, segs);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const minZ = localDem?.minElevationMeters ?? -100;
  const maxZ = localDem?.maxElevationMeters ?? 100;
  const spanZ = Math.max(1, maxZ - minZ);
  const centerZ = localDem?.centerElevationMeters ?? 0;

  for (let idx = 0; idx < pos.count; idx++) {
    const eastM = pos.getX(idx);
    const northM = -pos.getZ(idx);
    const y = localDem
      ? sampleLocalElevationOffset(localDem, eastM, northM, verticalScale)
      : -(eastM * eastM + northM * northM) / (2 * MOON_RADIUS_M);
    pos.setY(idx, y);
  }

  geom.computeVertexNormals();
  const normals = geom.getAttribute('normal') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  for (let idx = 0; idx < pos.count; idx++) {
    const y = pos.getY(idx);
    const eastM = pos.getX(idx);
    const northM = -pos.getZ(idx);
    const curv = (eastM * eastM + northM * northM) / (2 * MOON_RADIUS_M);
    const approxAbsZ = centerZ + (y + curv) / Math.max(0.1, verticalScale);

    const hNorm = localDem ? THREE.MathUtils.clamp((approxAbsZ - minZ) / spanZ, 0, 1) : 0.45;
    const slope = THREE.MathUtils.clamp(1 - normals.getY(idx), 0, 0.35) / 0.35;
    // Regolito mineral: planicies neutras, cráteres profundos algo más oscuros, laderas anortosíticas más claras
    const baseShade = 0.22 + hNorm * 0.28 + slope * 0.22;
    const fineNoise = Math.sin(eastM * 0.015) * Math.cos(northM * 0.014) * 0.02;
    const shade = THREE.MathUtils.clamp(baseShade + fineNoise, 0.16, 0.78);

    colors[idx * 3] = shade * 0.96;
    colors[idx * 3 + 1] = shade * 0.97;
    colors[idx * 3 + 2] = shade * 1.01;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const bumpMap = createRegolithBumpTexture();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    bumpMap,
    bumpScale: 2.8,
    roughness: 0.95,
    metalness: 0.02,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** Construye la cordillera 360° lejana acorde a profile_deg para oclusion fisica real. */
export function buildHorizonRidge(
  horizon: HorizonProfile,
  verticalScale: number,
): { wall: THREE.Mesh; crestLine: THREE.Line } {
  const elevs = horizon.elevations;
  const n = Math.max(3, elevs.length);
  const idealDipDeg = -0.09;
  const midRadius = (HORIZON_FOOT_RADIUS_M + HORIZON_RIDGE_RADIUS_M) * 0.52;

  // Malla cilíndrica de 3 anillos (pie, ladera media, cresta exacta) para dar volumen de macizo lunar
  const positions = new Float32Array((n + 1) * 3 * 3);
  const colors = new Float32Array((n + 1) * 3 * 3);
  const uvs = new Float32Array((n + 1) * 3 * 2);
  const indices: number[] = [];
  const linePts: THREE.Vector3[] = [];

  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const uCoord = i / n;
    const azRad = idx * horizon.stepDeg * DEG;
    const dx = Math.sin(azRad);
    const dz = -Math.cos(azRad);

    const hDeg = elevs[idx];
    const scaledDeg =
      verticalScale === 1 ? hDeg : idealDipDeg + (hDeg - idealDipDeg) * verticalScale;
    const crestY = OBSERVER_EYE_HEIGHT_M + HORIZON_RIDGE_RADIUS_M * Math.tan(scaledDeg * DEG);
    const footY = Math.min(-350, crestY - 1250);
    // Variación geológica solo en la ladera intermedia (sin alterar crestY para oclusión exacta)
    const spur = Math.sin(azRad * 9) * 45 + Math.cos(azRad * 23) * 24;
    const midY = footY + (crestY - footY) * 0.54 + spur;

    const vFoot = i * 3;
    const vMid = i * 3 + 1;
    const vCrest = i * 3 + 2;

    positions[vFoot * 3] = dx * HORIZON_FOOT_RADIUS_M;
    positions[vFoot * 3 + 1] = footY;
    positions[vFoot * 3 + 2] = dz * HORIZON_FOOT_RADIUS_M;

    positions[vMid * 3] = dx * midRadius;
    positions[vMid * 3 + 1] = midY;
    positions[vMid * 3 + 2] = dz * midRadius;

    positions[vCrest * 3] = dx * HORIZON_RIDGE_RADIUS_M;
    positions[vCrest * 3 + 1] = crestY;
    positions[vCrest * 3 + 2] = dz * HORIZON_RIDGE_RADIUS_M;

    uvs[vFoot * 2] = uCoord;
    uvs[vFoot * 2 + 1] = 0;
    uvs[vMid * 2] = uCoord;
    uvs[vMid * 2 + 1] = 0.54;
    uvs[vCrest * 2] = uCoord;
    uvs[vCrest * 2 + 1] = 1;

    colors[vFoot * 3] = 0.13;
    colors[vFoot * 3 + 1] = 0.14;
    colors[vFoot * 3 + 2] = 0.17;

    colors[vMid * 3] = 0.24;
    colors[vMid * 3 + 1] = 0.26;
    colors[vMid * 3 + 2] = 0.3;

    colors[vCrest * 3] = 0.36;
    colors[vCrest * 3 + 1] = 0.39;
    colors[vCrest * 3 + 2] = 0.44;

    linePts.push(new THREE.Vector3(dx * (HORIZON_RIDGE_RADIUS_M - 30), crestY + 6, dz * (HORIZON_RIDGE_RADIUS_M - 30)));

    if (i < n) {
      const nFoot = (i + 1) * 3;
      const nMid = (i + 1) * 3 + 1;
      const nCrest = (i + 1) * 3 + 2;

      indices.push(vFoot, vMid, nFoot);
      indices.push(vMid, nMid, nFoot);
      indices.push(vMid, vCrest, nMid);
      indices.push(vCrest, nCrest, nMid);
    }
  }

  const wallGeom = new THREE.BufferGeometry();
  wallGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  wallGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  wallGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  wallGeom.setIndex(indices);
  wallGeom.computeVertexNormals();

  const bumpMap = createRegolithBumpTexture();
  bumpMap.repeat.set(24, 3);
  const wallMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    bumpMap,
    bumpScale: 14,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const wall = new THREE.Mesh(wallGeom, wallMat);

  const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 });
  const crestLine = new THREE.Line(lineGeom, lineMat);

  return { wall, crestLine };
}
