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

/** Construye un modulo de aterrizaje lunar procedural a escala real (~4 m). */
export function createLanderMesh(): LanderController {
  const group = new THREE.Group();

  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xd99b26,
    metalness: 0.72,
    roughness: 0.34,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.55,
    roughness: 0.42,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.4,
    roughness: 0.6,
  });

  // Etapa de descenso octogonal (centro a y = 1.6 m)
  const descentStage = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 1.3, 8), goldFoilMat);
  descentStage.position.y = 1.65;
  group.add(descentStage);

  // Modulo superior / cabina de instrumentacion
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.05, 1.05, 8), alloyMat);
  cabin.position.y = 2.75;
  group.add(cabin);

  // Ventana / visera frontal hacia Norte (-Z)
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.34, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.85, roughness: 0.15 }),
  );
  visor.position.set(0, 2.85, -0.95);
  group.add(visor);

  // 4 patas de aterrizaje con zapatas en y = 0
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const legGroup = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.05, 8), darkMetalMat);
    strut.position.set(cos * 1.6, 0.82, sin * 1.6);
    strut.lookAt(cos * 1.0, 1.65, sin * 1.0);
    strut.rotateX(Math.PI / 2);
    legGroup.add(strut);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.1, 12), alloyMat);
    pad.position.set(cos * 2.1, 0.05, sin * 2.1);
    legGroup.add(pad);

    group.add(legGroup);
  }

  // Tobera inferior
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.52, 0.65, 16, 1, true), darkMetalMat);
  nozzle.position.y = 0.72;
  group.add(nozzle);

  // Pluma de motor (visible solo durante descenso / encendido)
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0xfdba74,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.58, 2.8, 14), plumeMat);
  plume.rotation.x = Math.PI;
  plume.position.y = -0.95;
  plume.visible = false;
  group.add(plume);

  // Panel solar articulado orientado hacia el Sol
  const solarPivot = new THREE.Group();
  solarPivot.position.set(1.2, 3.05, 0);
  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    emissive: new THREE.Color(BODIES.sun.color),
    emissiveIntensity: 0.25,
    metalness: 0.6,
    roughness: 0.25,
  });
  const panelFrame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.05, 0.85), solarPanelMat);
  solarPivot.add(panelFrame);
  group.add(solarPivot);

  // Antena parabolica orientada hacia la Tierra
  const dishPivot = new THREE.Group();
  dishPivot.position.set(-1.1, 3.15, 0);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: new THREE.Color(BODIES.earth.color),
    emissiveIntensity: 0.2,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const dishGeom = new THREE.SphereGeometry(0.48, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45);
  dishGeom.rotateX(Math.PI / 2);
  const dish = new THREE.Mesh(dishGeom, dishMat);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), darkMetalMat);
  feed.rotation.x = Math.PI / 2;
  feed.position.z = 0.24;
  dishPivot.add(dish, feed);
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
    solarPanelMat.emissiveIntensity = sunVisible ? 0.35 : 0.03;

    // Orientar eje (+Z local) de la parabolica a la Tierra
    targetEarth.set(earthSkyVec[0], Math.max(0.05, earthSkyVec[1]), earthSkyVec[2]).normalize().applyQuaternion(invParentQuat);
    const lookTarget = dishPivot.position.clone().add(targetEarth);
    dishPivot.lookAt(group.localToWorld(lookTarget));
    dishMat.emissiveIntensity = earthVisible ? 0.28 : 0.03;

    // Pluma de descenso pulsante
    if (throttle > 0.02) {
      plume.visible = true;
      const flicker = 0.88 + 0.16 * Math.sin(timeSec * 38);
      const scaleY = (0.45 + throttle * 1.1) * flicker;
      plume.scale.set(0.75 + throttle * 0.35, scaleY, 0.75 + throttle * 0.35);
      plume.position.y = 0.38 - 1.4 * scaleY;
      plumeMat.opacity = 0.4 + throttle * 0.5;
    } else {
      plume.visible = false;
    }
  };

  return { group, updateTracking };
}
