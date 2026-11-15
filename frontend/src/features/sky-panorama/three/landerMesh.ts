import * as THREE from 'three';
import type { Vec3 } from '../../../shared/types/lunar';
import { BODIES } from '../../../shared/lib/bodies';

export interface LanderController {
  group: THREE.Group;
  updateTracking: (
    sunSkyVec: Vec3,
    earthSkyVec: Vec3,
    sunVisible: boolean,
    earthVisible: boolean,
    throttle: number,
    timeSec: number,
  ) => void;
}

function createKaptonBumpTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  let seed = 5153;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Arrugas metálicas de aislamiento térmico MLI
  for (let i = 0; i < 240; i++) {
    const x0 = rand() * size;
    const y0 = rand() * size;
    const x1 = x0 + (rand() - 0.5) * 28;
    const y1 = y0 + (rand() - 0.5) * 28;
    const v = rand() > 0.5 ? 210 : 50;
    ctx.strokeStyle = `rgba(${v}, ${v}, ${v}, 0.42)`;
    ctx.lineWidth = 0.8 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createSolarCellTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#172554';
  ctx.fillRect(0, 0, w, h);

  // Celdas fotovoltaicas y pistas plateadas
  ctx.fillStyle = '#1e3a8a';
  const cols = 8;
  const rows = 4;
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillRect(c * cw + 1.5, r * ch + 1.5, cw - 3, ch - 3);
    }
  }
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  for (let c = 1; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cw, 0);
    ctx.lineTo(c * cw, h);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * ch);
    ctx.lineTo(w, r * ch);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addStrutBetween(
  parent: THREE.Group,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
): void {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), mat);
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(mesh);
}

/** Construye un modulo de aterrizaje lunar detallado tipo CLPS/Artemis (~3.8 m). */
export function createLanderMesh(): LanderController {
  const group = new THREE.Group();

  const kaptonBump = createKaptonBumpTexture();
  const solarTex = createSolarCellTexture();

  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xe0a124,
    bumpMap: kaptonBump,
    bumpScale: 0.035,
    metalness: 0.82,
    roughness: 0.28,
  });
  const silverFoilMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    bumpMap: kaptonBump,
    bumpScale: 0.02,
    metalness: 0.72,
    roughness: 0.34,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.58,
    roughness: 0.38,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.55,
    roughness: 0.45,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.62,
  });

  // Etapa de descenso octogonal envuelta en aislamiento MLI dorado
  const descentStage = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.42, 1.18, 8), goldFoilMat);
  descentStage.position.y = 1.56;
  group.add(descentStage);

  // Anillos estructurales superior e inferior
  const lowerCollar = new THREE.Mesh(new THREE.CylinderGeometry(1.44, 1.44, 0.1, 8), titaniumMat);
  lowerCollar.position.y = 0.98;
  const upperCollar = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.1, 8), titaniumMat);
  upperCollar.position.y = 2.16;
  group.add(lowerCollar, upperCollar);

  // Tanques esfericos de propelente alrededor del bus
  const tankGeom = new THREE.SphereGeometry(0.32, 14, 12);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const tank = new THREE.Mesh(tankGeom, silverFoilMat);
    tank.position.set(Math.sin(a) * 1.18, 1.56, Math.cos(a) * 1.18);
    group.add(tank);
  }

  // Cubierta de avionica y radiadores blancos superiores
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.06, 0.88, 8), alloyMat);
  cabin.position.y = 2.64;
  group.add(cabin);

  const upperDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.08, 8), darkMetalMat);
  upperDeck.position.y = 3.1;
  group.add(upperDeck);

  // Mastil optico / camaras de navegacion (por debajo del nivel de ojo 3.85 m)
  const navSensor = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.24, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.85, roughness: 0.15 }),
  );
  navSensor.position.set(0, 2.74, -0.96);
  group.add(navSensor);

  // Bloques de propulsores RCS en 4 esquinas
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const rcs = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.22), darkMetalMat);
    rcs.position.set(Math.sin(a) * 1.12, 2.68, Math.cos(a) * 1.12);
    rcs.rotation.y = a;
    group.add(rcs);
  }

  // 4 patas articuladas en A con amortiguadores, zapatas y sensores de contacto
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tangentX = -sin;
    const tangentZ = cos;

    const legGroup = new THREE.Group();
    const padCenter = new THREE.Vector3(cos * 2.18, 0.09, sin * 2.18);
    const upperAnchor = new THREE.Vector3(cos * 1.24, 2.02, sin * 1.24);
    const lowerLeft = new THREE.Vector3(cos * 1.24 + tangentX * 0.42, 1.02, sin * 1.24 + tangentZ * 0.42);
    const lowerRight = new THREE.Vector3(cos * 1.24 - tangentX * 0.42, 1.02, sin * 1.24 - tangentZ * 0.42);
    const knee = padCenter.clone().lerp(upperAnchor, 0.34);

    // Amortiguador telescopico primario
    addStrutBetween(legGroup, padCenter, upperAnchor, 0.055, alloyMat);
    // Puntales diagonales en A
    addStrutBetween(legGroup, knee, lowerLeft, 0.036, titaniumMat);
    addStrutBetween(legGroup, knee, lowerRight, 0.036, titaniumMat);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.1, 16), goldFoilMat);
    pad.position.set(padCenter.x, 0.05, padCenter.z);
    legGroup.add(pad);

    group.add(legGroup);
  }

  // Tobera principal campana bajo el centro
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.56, 0.68, 20, 1, true), darkMetalMat);
  nozzle.position.y = 0.66;
  group.add(nozzle);

  // Pluma de motor doble (nucleo brillante + halo de expansion)
  const corePlumeMat = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const outerPlumeMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const corePlume = new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.1, 14), corePlumeMat);
  corePlume.rotation.x = Math.PI;
  const outerPlume = new THREE.Mesh(new THREE.ConeGeometry(0.68, 3.2, 16), outerPlumeMat);
  outerPlume.rotation.x = Math.PI;
  corePlume.visible = false;
  outerPlume.visible = false;
  group.add(corePlume, outerPlume);

  // Paneles solares articulados orientados al Sol
  const solarPivot = new THREE.Group();
  solarPivot.position.set(1.22, 2.86, 0);
  const solarPanelMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    emissive: new THREE.Color(BODIES.sun.color),
    emissiveIntensity: 0.18,
    metalness: 0.72,
    roughness: 0.22,
  });
  const solarWing = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.04, 0.88), solarPanelMat);
  const solarRim = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.025, 0.92), titaniumMat);
  solarPivot.add(solarRim, solarWing);
  group.add(solarPivot);

  // Antena parabolica de alta ganancia orientada a la Tierra
  const dishPivot = new THREE.Group();
  dishPivot.position.set(-1.12, 2.98, 0);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    emissive: new THREE.Color(BODIES.earth.color),
    emissiveIntensity: 0.16,
    roughness: 0.3,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const dishGeom = new THREE.SphereGeometry(0.52, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.44);
  dishGeom.rotateX(Math.PI / 2);
  const dish = new THREE.Mesh(dishGeom, dishMat);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.44, 8), darkMetalMat);
  feed.rotation.x = Math.PI / 2;
  feed.position.z = 0.24;
  const subReflector = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.04, 12), goldFoilMat);
  subReflector.rotation.x = Math.PI / 2;
  subReflector.position.z = 0.46;
  dishPivot.add(dish, feed, subReflector);
  group.add(dishPivot);

  const worldUp = new THREE.Vector3(0, 1, 0);
  const targetSun = new THREE.Vector3();
  const targetEarth = new THREE.Vector3();
  const invParentQuat = new THREE.Quaternion();

  const updateTracking = (
    sunSkyVec: Vec3,
    earthSkyVec: Vec3,
    sunVisible: boolean,
    earthVisible: boolean,
    throttle: number,
    timeSec: number,
  ) => {
    group.updateMatrixWorld();
    invParentQuat.copy(group.quaternion).invert();

    // Orientar normal (+Y local) del panel solar al vector del Sol en espacio de la nave
    targetSun.set(sunSkyVec[0], Math.max(0.05, sunSkyVec[1]), sunSkyVec[2]).normalize().applyQuaternion(invParentQuat);
    solarPivot.quaternion.setFromUnitVectors(worldUp, targetSun);
    solarPanelMat.emissiveIntensity = sunVisible ? 0.22 : 0.02;

    // Orientar eje (+Z local) de la parabolica a la Tierra
    targetEarth.set(earthSkyVec[0], Math.max(0.05, earthSkyVec[1]), earthSkyVec[2]).normalize().applyQuaternion(invParentQuat);
    const lookTarget = dishPivot.position.clone().add(targetEarth);
    dishPivot.lookAt(group.localToWorld(lookTarget));
    dishMat.emissiveIntensity = earthVisible ? 0.22 : 0.02;

    // Pluma de descenso pulsante
    if (throttle > 0.02) {
      corePlume.visible = true;
      outerPlume.visible = true;
      const flicker = 0.88 + 0.14 * Math.sin(timeSec * 42);
      const scaleY = (0.45 + throttle * 1.05) * flicker;
      corePlume.scale.set(0.75 + throttle * 0.25, scaleY, 0.75 + throttle * 0.25);
      corePlume.position.y = 0.34 - 1.02 * scaleY;
      outerPlume.scale.set(0.8 + throttle * 0.35, scaleY, 0.8 + throttle * 0.35);
      outerPlume.position.y = 0.34 - 1.56 * scaleY;
      corePlumeMat.opacity = 0.65 + throttle * 0.32;
      outerPlumeMat.opacity = 0.28 + throttle * 0.36;
    } else {
      corePlume.visible = false;
      outerPlume.visible = false;
    }
  };

  return { group, updateTracking };
}
