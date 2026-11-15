import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EphemerisSample, HorizonProfile } from '../../../shared/types/lunar';
import { BODIES } from '../../../shared/lib/bodies';
import {
  buildHorizonRidge,
  buildLocalDemMesh,
  SKY_DOME_RADIUS_M,
  sampleLocalElevationOffset,
} from './demGeometry';
import { createLanderMesh } from './landerMesh';
import {
  azElToSkyVector,
  clamp01,
  computeDescentState,
  skyPositionAtRadius,
} from './lunar3dMath';

export type SurfaceCameraMode = 'first_person' | 'third_person' | 'descent_cam';

export interface SurfaceSceneParams {
  horizon: HorizonProfile;
  samples: EphemerisSample[];
  current: EphemerisSample;
  verticalScale: number;
  descentProgress: number;
}

const STAR_RADIUS_M = 74000;

function makeCardinalSprite(label: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.beginPath();
  ctx.arc(64, 64, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = label === 'N' ? '#fb7185' : '#e2e8f0';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 64, 68);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1800, 1800, 1);
  sprite.renderOrder = 6;
  return sprite;
}

function makeGhostRing(colorHex: string): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1100, 1380, 40),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
    }),
  );
  ring.renderOrder = 12;
  ring.visible = false;
  return ring;
}

function buildStars(count = 700): THREE.Points {
  const pos = new Float32Array(count * 3);
  let seed = 9187;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    const az = rand() * Math.PI * 2;
    const el = rand() * Math.PI * 0.48 + 0.01;
    const cEl = Math.cos(el);
    pos[i * 3] = cEl * Math.sin(az) * STAR_RADIUS_M;
    pos[i * 3 + 1] = Math.sin(el) * STAR_RADIUS_M;
    pos[i * 3 + 2] = -cEl * Math.cos(az) * STAR_RADIUS_M;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xe2e8f0, size: 190, transparent: true, opacity: 0.72 });
  return new THREE.Points(geom, mat);
}

function disposeGroupChildren(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      } else if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    });
  }
}

export function createSurfaceScene(container: HTMLElement) {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040710');

  const camera = new THREE.PerspectiveCamera(56, width / height, 0.4, 110_000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.56;

  // Iluminacion lunar real + luz tenue de ceniza terrestre / instrumentos
  const ambientLight = new THREE.AmbientLight(0x334155, 0.38);
  const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.4);
  scene.add(ambientLight, sunLight);

  scene.add(buildStars());

  // Grupos reconstruibles al cambiar sitio/DEM/escala o trayectoria
  const terrainGroup = new THREE.Group();
  const skyPathsGroup = new THREE.Group();
  scene.add(terrainGroup, skyPathsGroup);

  // Marcadores cardinales N/E/S/O sobre la cresta
  const cardinalDirs: { label: string; az: number }[] = [
    { label: 'N', az: 0 },
    { label: 'E', az: 90 },
    { label: 'S', az: 180 },
    { label: 'W', az: 270 },
  ];
  for (const c of cardinalDirs) {
    const sprite = makeCardinalSprite(c.label);
    const [x, , z] = skyPositionAtRadius(c.az, 0, 23_500);
    sprite.position.set(x, 1950, z);
    scene.add(sprite);
  }

  // Marcador de diana en la zona de aterrizaje (0, groundY, 0)
  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(14, 22, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.72 }),
  );
  targetRing.rotation.x = -Math.PI / 2;
  scene.add(targetRing);

  // Modulo de aterrizaje
  const lander = createLanderMesh();
  scene.add(lander.group);

  // Sol y Tierra en boveda celeste (profundidad real ocluida por montanas)
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(850, 24, 18),
    new THREE.MeshBasicMaterial({ color: BODIES.sun.color }),
  );
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1350, 24, 18),
    new THREE.MeshBasicMaterial({ color: BODIES.earth.color }),
  );
  scene.add(sunMesh, earthMesh);

  // Anillos fantasma (depthTest: false) para diagnosticar cuerpos bloqueados por relieve
  const sunGhost = makeGhostRing(BODIES.sun.color);
  const earthGhost = makeGhostRing(BODIES.earth.color);
  scene.add(sunGhost, earthGhost);

  // Trayectoria de descenso en superficie (5000 m -> 2 m)
  const descentPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 50; i++) {
    const d = computeDescentState(i / 50);
    descentPts.push(new THREE.Vector3(d.eastOffsetMeters, d.altitudeMeters, -d.northOffsetMeters));
  }
  const descentLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(descentPts),
    new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 80, gapSize: 55, transparent: true, opacity: 0.6 }),
  );
  descentLine.computeLineDistances();
  scene.add(descentLine);

  let lastHorizonRef: HorizonProfile | null = null;
  let lastScale = -1;
  let lastSamplesRef: EphemerisSample[] | null = null;
  let cameraMode: SurfaceCameraMode = 'third_person';
  let latestLanderPos = new THREE.Vector3(0, 2, 0);
  let focusTransition = 0;
  const focusCamTarget = new THREE.Vector3();
  const focusLookTarget = new THREE.Vector3();

  const applyCameraRig = (mode: SurfaceCameraMode, landerPos: THREE.Vector3, isTransition = true) => {
    cameraMode = mode;
    if (mode === 'first_person') {
      const eye = landerPos.clone().add(new THREE.Vector3(0, 3.68, 0));
      controls.minDistance = 0.1;
      controls.maxDistance = 0.8;
      if (isTransition) {
        controls.target.copy(eye);
        camera.position.copy(eye).add(new THREE.Vector3(0, 0.02, 0.25));
      }
    } else if (mode === 'third_person') {
      controls.minDistance = 6;
      controls.maxDistance = 2600;
      if (isTransition) {
        controls.target.copy(landerPos).add(new THREE.Vector3(0, 2.2, 0));
        camera.position.copy(landerPos).add(new THREE.Vector3(14, 7.5, 16));
      }
    } else {
      controls.minDistance = 12;
      controls.maxDistance = 8500;
      if (isTransition) {
        controls.target.copy(landerPos);
        camera.position.copy(landerPos).add(new THREE.Vector3(-420, 260, 520));
      }
    }
    controls.update();
  };

  const rebuildTerrain = (horizon: HorizonProfile, verticalScale: number) => {
    disposeGroupChildren(terrainGroup);
    terrainGroup.add(buildLocalDemMesh(horizon.localDem, verticalScale));
    const { wall, crestLine } = buildHorizonRidge(horizon, verticalScale);
    terrainGroup.add(wall, crestLine);
    const groundAtCenter = sampleLocalElevationOffset(horizon.localDem, 0, 0, verticalScale);
    targetRing.position.set(0, groundAtCenter + 1.2, 0);
  };

  const rebuildSkyPaths = (samples: EphemerisSample[]) => {
    disposeGroupChildren(skyPathsGroup);
    if (samples.length < 2) return;

    const sunPts = samples.map((s) => {
      const [x, y, z] = skyPositionAtRadius(s.sun.azimuth, s.sun.elevation, SKY_DOME_RADIUS_M);
      return new THREE.Vector3(x, y, z);
    });
    const earthPts = samples.map((s) => {
      const [x, y, z] = skyPositionAtRadius(s.earth.azimuth, s.earth.elevation, SKY_DOME_RADIUS_M);
      return new THREE.Vector3(x, y, z);
    });

    const sunCurve = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(sunPts),
      new THREE.LineBasicMaterial({ color: BODIES.sun.color, transparent: true, opacity: 0.72 }),
    );
    const earthCurve = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(earthPts),
      new THREE.LineBasicMaterial({ color: BODIES.earth.color, transparent: true, opacity: 0.72 }),
    );
    skyPathsGroup.add(sunCurve, earthCurve);
  };

  let latestParams: SurfaceSceneParams | null = null;
  let clock = 0;

  const update = (params: SurfaceSceneParams) => {
    latestParams = params;
    if (params.horizon !== lastHorizonRef || params.verticalScale !== lastScale) {
      rebuildTerrain(params.horizon, params.verticalScale);
      lastHorizonRef = params.horizon;
      lastScale = params.verticalScale;
    }
    if (params.samples !== lastSamplesRef) {
      rebuildSkyPaths(params.samples);
      lastSamplesRef = params.samples;
    }

    const d = computeDescentState(params.descentProgress);
    const eastM = d.eastOffsetMeters;
    const northM = d.northOffsetMeters;
    const groundY = sampleLocalElevationOffset(
      params.horizon.localDem,
      eastM,
      northM,
      params.verticalScale,
    );
    const prevLanderPos = latestLanderPos.clone();
    // La altitud d.altitudeMeters ya termina en 2 m sobre la superficie (ojos a ~5 m del suelo o cabina a 2 m)
    const shipY = groundY + Math.max(0, d.altitudeMeters - 2.0);
    latestLanderPos.set(eastM, shipY, -northM);

    lander.group.position.copy(latestLanderPos);
    lander.group.rotation.set(0, 0, THREE.MathUtils.degToRad(-d.pitchDeg));
    lander.updateTracking(
      params.current.sun.skyVector,
      params.current.earth.skyVector,
      params.current.sun.visible,
      params.current.earth.visible,
      d.throttle,
      clock,
    );

    // Actualizar desplazamiento relativo de camara al animar el descenso
    const delta = latestLanderPos.clone().sub(prevLanderPos);
    if (delta.lengthSq() > 1e-6 && focusTransition <= 0.01) {
      controls.target.add(delta);
      camera.position.add(delta);
    }

    // Posicionar Sol, Tierra y luz solar
    const [sx, sy, sz] = skyPositionAtRadius(
      params.current.sun.azimuth,
      params.current.sun.elevation,
      SKY_DOME_RADIUS_M,
    );
    const [ex, ey, ez] = skyPositionAtRadius(
      params.current.earth.azimuth,
      params.current.earth.elevation,
      SKY_DOME_RADIUS_M,
    );

    sunMesh.position.set(sx, sy, sz);
    earthMesh.position.set(ex, ey, ez);

    sunGhost.position.set(sx, sy, sz);
    sunGhost.lookAt(camera.position);
    sunGhost.visible = params.current.sun.interference;

    earthGhost.position.set(ex, ey, ez);
    earthGhost.lookAt(camera.position);
    earthGhost.visible = params.current.earth.interference;

    const [lx, ly, lz] = azElToSkyVector(params.current.sun.azimuth, Math.max(3, params.current.sun.elevation));
    sunLight.position.set(lx * 30000, ly * 30000, lz * 30000);
    sunLight.intensity = params.current.sun.visible ? 2.5 : 0.45;
  };

  const setCameraMode = (mode: SurfaceCameraMode) => {
    focusTransition = 0;
    applyCameraRig(mode, latestLanderPos, true);
  };

  const lookAtBody = (azDeg: number, elDeg: number) => {
    const [vx, vy, vz] = azElToSkyVector(azDeg, elDeg);
    const dir = new THREE.Vector3(vx, vy, vz).normalize();
    if (cameraMode === 'first_person') {
      const eye = latestLanderPos.clone().add(new THREE.Vector3(0, 3.68, 0));
      focusLookTarget.copy(eye);
      focusCamTarget.copy(eye).sub(dir.multiplyScalar(0.25));
    } else {
      focusLookTarget.copy(latestLanderPos).add(dir.clone().multiplyScalar(220));
      focusCamTarget.copy(latestLanderPos).add(new THREE.Vector3(0, 4.5, 0)).sub(dir.multiplyScalar(18));
    }
    focusTransition = 1;
  };

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  applyCameraRig('third_person', latestLanderPos, true);

  let rafId = 0;
  let lastNow = performance.now();
  let paused = document.hidden;

  const tick = () => {
    if (paused) return;
    rafId = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    clock += dt;

    if (latestParams) {
      const d = computeDescentState(clamp01(latestParams.descentProgress));
      lander.updateTracking(
        latestParams.current.sun.skyVector,
        latestParams.current.earth.skyVector,
        latestParams.current.sun.visible,
        latestParams.current.earth.visible,
        d.throttle,
        clock,
      );
    }

    if (focusTransition > 0.01) {
      camera.position.lerp(focusCamTarget, 0.14);
      controls.target.lerp(focusLookTarget, 0.14);
      focusTransition *= 0.86;
    }

    if (sunGhost.visible) sunGhost.lookAt(camera.position);
    if (earthGhost.visible) earthGhost.lookAt(camera.position);

    controls.update();
    renderer.render(scene, camera);
  };

  const onVisibility = () => {
    paused = document.hidden;
    if (!paused) {
      lastNow = performance.now();
      tick();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  tick();

  const dispose = () => {
    paused = true;
    cancelAnimationFrame(rafId);
    document.removeEventListener('visibilitychange', onVisibility);
    observer.disconnect();
    controls.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      } else if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return { update, setCameraMode, lookAtBody, resize, dispose };
}
