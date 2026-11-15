import * as THREE from 'three';
import type { HorizonProfile, LocalDemPatch } from '../../../shared/types/lunar';
import { MOON_RADIUS_M, OBSERVER_EYE_HEIGHT_M } from './lunar3dMath';

const DEG = Math.PI / 180;
export const HORIZON_RIDGE_RADIUS_M = 26000;
export const HORIZON_FOOT_RADIUS_M = 11400;
export const SKY_DOME_RADIUS_M = 44000;

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

  return (z - centerElevationMeters) * verticalScale - curv;
}

/** Construye la malla del terreno local 64x64 (o casquete liso si terrain=false). */
export function buildLocalDemMesh(
  localDem: LocalDemPatch | null,
  verticalScale: number,
): THREE.Mesh {
  const size = localDem?.size ?? 48;
  const extent = localDem?.extentMeters ?? 16000;
  const segs = size - 1;

  const geom = new THREE.PlaneGeometry(extent, extent, segs, segs);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  const minZ = localDem?.minElevationMeters ?? -100;
  const maxZ = localDem?.maxElevationMeters ?? 100;
  const spanZ = Math.max(1, maxZ - minZ);
  const centerZ = localDem?.centerElevationMeters ?? 0;

  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const idx = iy * size + ix;
      const x = pos.getX(idx);
      const z = pos.getZ(idx);
      const curv = (x * x + z * z) / (2 * MOON_RADIUS_M);

      const absZ = localDem ? localDem.heightsMeters[iy][ix] : 0;
      const y = localDem ? (absZ - centerZ) * verticalScale - curv : -curv;
      pos.setY(idx, y);

      // Coloreado mineral por elevacion relativa + desvanecimiento suave hacia los bordes
      const t = localDem ? THREE.MathUtils.clamp((absZ - minZ) / spanZ, 0, 1) : 0.45;
      const shade = 0.24 + t * 0.38;
      colors[idx * 3] = shade * 0.96;
      colors[idx * 3 + 1] = shade * 0.98;
      colors[idx * 3 + 2] = shade * 1.03;
    }
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.02,
    flatShading: false,
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

  // Malla cilíndrica entre radio interior (pie) y radio exterior (cresta del horizonte)
  const positions = new Float32Array((n + 1) * 2 * 3);
  const colors = new Float32Array((n + 1) * 2 * 3);
  const indices: number[] = [];
  const linePts: THREE.Vector3[] = [];

  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const azRad = idx * horizon.stepDeg * DEG;
    const dx = Math.sin(azRad);
    const dz = -Math.cos(azRad);

    const hDeg = elevs[idx];
    const scaledDeg =
      verticalScale === 1 ? hDeg : idealDipDeg + (hDeg - idealDipDeg) * verticalScale;
    const crestY = OBSERVER_EYE_HEIGHT_M + HORIZON_RIDGE_RADIUS_M * Math.tan(scaledDeg * DEG);
    const footY = Math.min(-350, crestY - 1200);

    const vFoot = i * 2;
    const vCrest = i * 2 + 1;

    positions[vFoot * 3] = dx * HORIZON_FOOT_RADIUS_M;
    positions[vFoot * 3 + 1] = footY;
    positions[vFoot * 3 + 2] = dz * HORIZON_FOOT_RADIUS_M;

    positions[vCrest * 3] = dx * HORIZON_RIDGE_RADIUS_M;
    positions[vCrest * 3 + 1] = crestY;
    positions[vCrest * 3 + 2] = dz * HORIZON_RIDGE_RADIUS_M;

    // Gradiente oscuro desde base hacia la cresta iluminada
    colors[vFoot * 3] = 0.14;
    colors[vFoot * 3 + 1] = 0.16;
    colors[vFoot * 3 + 2] = 0.2;

    colors[vCrest * 3] = 0.34;
    colors[vCrest * 3 + 1] = 0.38;
    colors[vCrest * 3 + 2] = 0.45;

    linePts.push(new THREE.Vector3(dx * (HORIZON_RIDGE_RADIUS_M - 30), crestY + 6, dz * (HORIZON_RIDGE_RADIUS_M - 30)));

    if (i < n) {
      const nextFoot = (i + 1) * 2;
      const nextCrest = (i + 1) * 2 + 1;
      indices.push(vFoot, vCrest, nextFoot);
      indices.push(vCrest, nextCrest, nextFoot);
    }
  }

  const wallGeom = new THREE.BufferGeometry();
  wallGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  wallGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  wallGeom.setIndex(indices);
  wallGeom.computeVertexNormals();

  const wallMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const wall = new THREE.Mesh(wallGeom, wallMat);

  const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.65 });
  const crestLine = new THREE.Line(lineGeom, lineMat);

  return { wall, crestLine };
}
