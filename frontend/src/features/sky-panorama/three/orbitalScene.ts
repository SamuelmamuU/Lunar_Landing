import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EphemerisSample, OrbitalVectors3D, Vec3 } from '../../../shared/types/lunar';
import { BODIES } from '../../../shared/lib/bodies';
import {
  bodyOcclusionState,
  clamp01,
  computeOrbitalDirectionsAtSample,
  type OcclusionState,
} from './lunar3dMath';

export type OrbitalCameraPreset = 'global' | 'south_pole' | 'site';

export interface OrbitalSceneParams {
  lat: number;
  lon: number;
  sample: EphemerisSample;
  vectors3d: OrbitalVectors3D | null;
  descentProgress: number;
}

const MOON_WORLD_RADIUS = 10;
const SUN_PROXY_DIST = 36;
const EARTH_PROXY_DIST = 26;

function toThreeVec(v: Vec3, scale = 1): THREE.Vector3 {
  return new THREE.Vector3(v[0] * scale, v[1] * scale, v[2] * scale);
}

/** Genera textura y bump map procedural lunar determinista para iluminar el terminador solar. */
function createMoonTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const width = 512;
  const height = 256;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const aCtx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;

  aCtx.fillStyle = '#8b9099';
  aCtx.fillRect(0, 0, width, height);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, width, height);

  // Maria lunares y tierras altas deterministas
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 42; i++) {
    const cx = rand() * width;
    const cy = height * (0.18 + rand() * 0.64);
    const rx = 18 + rand() * 48;
    const ry = rx * (0.55 + rand() * 0.45);
    const shade = 75 + Math.floor(rand() * 40);
    aCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 6}, 0.28)`;
    aCtx.beginPath();
    aCtx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    aCtx.fill();
  }

  for (let i = 0; i < 320; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 1.5 + rand() * 11;
    const rim = Math.floor(170 + rand() * 55);
    const floor = Math.floor(70 + rand() * 50);

    aCtx.strokeStyle = `rgba(${rim}, ${rim}, ${rim}, 0.35)`;
    aCtx.lineWidth = 1.2;
    aCtx.beginPath();
    aCtx.arc(x, y, r, 0, Math.PI * 2);
    aCtx.stroke();

    aCtx.fillStyle = `rgba(${floor}, ${floor}, ${floor + 4}, 0.35)`;
    aCtx.beginPath();
    aCtx.arc(x, y, Math.max(0.8, r * 0.72), 0, Math.PI * 2);
    aCtx.fill();

    bCtx.strokeStyle = 'rgba(235, 235, 235, 0.48)';
    bCtx.lineWidth = 1.5;
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.stroke();

    bCtx.fillStyle = 'rgba(42, 42, 42, 0.45)';
    bCtx.beginPath();
    bCtx.arc(x, y, Math.max(0.8, r * 0.72), 0, Math.PI * 2);
    bCtx.fill();
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  return { map, bumpMap };
}

function buildLatRingGeometry(latDeg: number, radius: number, segments = 96): THREE.BufferGeometry {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const r = Math.cos(lat) * radius;
  const y = Math.sin(lat) * radius;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function buildStarfield(count = 550): THREE.Points {
  const positions = new Float32Array(count * 3);
  let seed = 4099;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dist = 75 + rand() * 35;
    positions[i * 3] = s * Math.cos(phi) * dist;
    positions[i * 3 + 1] = u * dist;
    positions[i * 3 + 2] = s * Math.sin(phi) * dist;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.25, transparent: true, opacity: 0.7 });
  return new THREE.Points(geom, mat);
}

function buildRayLine(colorHex: string): {
  solid: THREE.Line;
  dashed: THREE.Line;
  setSegment: (start: THREE.Vector3, end: THREE.Vector3, state: OcclusionState) => void;
} {
  const solidGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
  const solidMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.92 });
  const solid = new THREE.Line(solidGeom, solidMat);

  const dashedGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
  const dashedMat = new THREE.LineDashedMaterial({
    color: colorHex,
    dashSize: 0.45,
    gapSize: 0.35,
    transparent: true,
    opacity: 0.75,
  });
  const dashed = new THREE.Line(dashedGeom, dashedMat);
  dashed.visible = false;

  const setSegment = (start: THREE.Vector3, end: THREE.Vector3, state: OcclusionState) => {
    const occluded = state === 'interference' || state === 'below';
    solid.visible = !occluded;
    dashed.visible = occluded;
    const target = occluded ? dashed : solid;
    const pos = target.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, start.x, start.y, start.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    if (occluded) {
      dashed.computeLineDistances();
      dashedMat.color.set(state === 'interference' ? '#f59e0b' : colorHex);
      dashedMat.opacity = state === 'interference' ? 0.95 : 0.45;
    } else {
      solidMat.color.set(colorHex);
    }
  };

  return { solid, dashed, setSegment };
}

export function createOrbitalScene(container: HTMLElement) {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060913');

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 220);
  camera.position.set(17, -14, 19);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 12.2;
  controls.maxDistance = 64;

  // Iluminacion astronomica real: luz solar direccional para marcar el terminador
  const ambientLight = new THREE.AmbientLight(0x1f2937, 0.45);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.7);
  sunLight.position.set(30, 5, 20);
  scene.add(sunLight);

  scene.add(buildStarfield());

  // Globo lunar
  const { map: moonMap, bumpMap: moonBump } = createMoonTextures();
  const moonGeom = new THREE.SphereGeometry(MOON_WORLD_RADIUS, 64, 48);
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonMap,
    bumpMap: moonBump,
    bumpScale: 0.16,
    roughness: 0.92,
    metalness: 0.02,
  });
  const moonMesh = new THREE.Mesh(moonGeom, moonMat);
  scene.add(moonMesh);

  // Graticula sutil: ecuador y paralelo -80S (cobertura LOLA polo sur)
  const eqGeom = buildLatRingGeometry(0, MOON_WORLD_RADIUS + 0.025);
  const eqMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.3 });
  scene.add(new THREE.Line(eqGeom, eqMat));

  const south80Geom = buildLatRingGeometry(-80, MOON_WORLD_RADIUS + 0.03);
  const south80Mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
  scene.add(new THREE.Line(south80Geom, south80Mat));

  // Eje polar Norte-Sur
  const axisGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -MOON_WORLD_RADIUS * 1.18, 0),
    new THREE.Vector3(0, MOON_WORLD_RADIUS * 1.18, 0),
  ]);
  const axisMat = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.4 });
  scene.add(new THREE.Line(axisGeom, axisMat));

  // Pin del sitio de aterrizaje
  const siteGroup = new THREE.Group();
  const pinStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.7, 12),
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  pinStem.position.y = 0.35;
  siteGroup.add(pinStem);
  const pinRing = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.36, 32),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }),
  );
  pinRing.rotation.x = -Math.PI / 2;
  pinRing.position.y = 0.04;
  siteGroup.add(pinRing);
  scene.add(siteGroup);

  // Arco de aproximacion orbital y nave animada
  const orbitPtsCount = 72;
  const orbitPositions = new Float32Array(orbitPtsCount * 3);
  const orbitGeom = new THREE.BufferGeometry();
  orbitGeom.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.78 });
  const orbitLine = new THREE.Line(orbitGeom, orbitMat);
  scene.add(orbitLine);

  const craftMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.56, 12),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
  );
  scene.add(craftMesh);

  // Proxy Sol y Tierra
  const sunGroup = new THREE.Group();
  const sunSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 24, 18),
    new THREE.MeshBasicMaterial({ color: BODIES.sun.color }),
  );
  const sunHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.75, 32),
    new THREE.MeshBasicMaterial({ color: 0xfdba74, side: THREE.DoubleSide, transparent: true, opacity: 0.65 }),
  );
  sunGroup.add(sunSphere, sunHalo);
  scene.add(sunGroup);

  const earthGroup = new THREE.Group();
  const earthSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 28, 22),
    new THREE.MeshStandardMaterial({ color: BODIES.earth.color, roughness: 0.55, emissive: 0x0c4a6e, emissiveIntensity: 0.4 }),
  );
  const earthHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.65, 1.92, 32),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
  );
  earthGroup.add(earthSphere, earthHalo);
  scene.add(earthGroup);

  // Rayos sitio -> Sol y sitio -> Tierra
  const sunRay = buildRayLine(BODIES.sun.color);
  const earthRay = buildRayLine(BODIES.earth.color);
  scene.add(sunRay.solid, sunRay.dashed, earthRay.solid, earthRay.dashed);

  let latestSiteUnit = new THREE.Vector3(0, -1, 0);
  const targetCamPos = new THREE.Vector3().copy(camera.position);
  const targetLookAt = new THREE.Vector3(0, 0, 0);
  let camTransition = 0;

  const updateOrbitCurve = (siteNorm: THREE.Vector3, descentProgress: number) => {
    const upRef = Math.abs(siteNorm.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangentA = new THREE.Vector3().crossVectors(upRef, siteNorm).normalize();
    const posAttr = orbitGeom.getAttribute('position') as THREE.BufferAttribute;

    const getPointAt = (u: number) => {
      // u = 0 lejos en orbita (~75 grados antes, altitud +2.6u), u = 1 en el sitio
      const angle = (1 - u) * 1.15;
      const alt = Math.pow(1 - u, 1.55) * 2.6 + 0.05;
      const r = MOON_WORLD_RADIUS + alt;
      return new THREE.Vector3()
        .addScaledVector(siteNorm, Math.cos(angle) * r)
        .addScaledVector(tangentA, Math.sin(angle) * r);
    };

    for (let i = 0; i < orbitPtsCount; i++) {
      const p = getPointAt(i / (orbitPtsCount - 1));
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
    posAttr.needsUpdate = true;

    const u = clamp01(descentProgress);
    const craftPos = getPointAt(u);
    craftMesh.position.copy(craftPos);
    const craftUp = craftPos.clone().normalize();
    craftMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), craftUp);
  };

  const update = (params: OrbitalSceneParams) => {
    const dirs = computeOrbitalDirectionsAtSample(params.lat, params.lon, params.sample, params.vectors3d);
    latestSiteUnit = toThreeVec(dirs.siteUnit, 1).normalize();
    const sunDir = toThreeVec(dirs.sunDir, 1).normalize();
    const earthDir = toThreeVec(dirs.earthDir, 1).normalize();

    sunLight.position.copy(sunDir).multiplyScalar(80);
    sunGroup.position.copy(sunDir).multiplyScalar(SUN_PROXY_DIST);
    earthGroup.position.copy(earthDir).multiplyScalar(EARTH_PROXY_DIST);

    const siteSurfacePos = latestSiteUnit.clone().multiplyScalar(MOON_WORLD_RADIUS);
    siteGroup.position.copy(siteSurfacePos);
    siteGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), latestSiteUnit);

    sunRay.setSegment(
      siteSurfacePos.clone().addScaledVector(latestSiteUnit, 0.15),
      siteSurfacePos.clone().addScaledVector(sunDir, 18),
      bodyOcclusionState(params.sample.sun),
    );
    earthRay.setSegment(
      siteSurfacePos.clone().addScaledVector(latestSiteUnit, 0.15),
      siteSurfacePos.clone().addScaledVector(earthDir, 15),
      bodyOcclusionState(params.sample.earth),
    );

    updateOrbitCurve(latestSiteUnit, params.descentProgress);
  };

  const setPreset = (preset: OrbitalCameraPreset) => {
    if (preset === 'global') {
      targetCamPos.set(17, -14, 19);
      targetLookAt.set(0, 0, 0);
    } else if (preset === 'south_pole') {
      targetCamPos.set(4, -22, 11);
      targetLookAt.set(0, -6.5, 0);
    } else {
      const ref = Math.abs(latestSiteUnit.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(ref, latestSiteUnit).normalize();
      targetLookAt.copy(latestSiteUnit).multiplyScalar(MOON_WORLD_RADIUS * 0.92);
      targetCamPos
        .copy(latestSiteUnit)
        .multiplyScalar(MOON_WORLD_RADIUS + 6.5)
        .addScaledVector(side, 5.5);
    }
    camTransition = 1;
  };

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  let rafId = 0;
  let paused = document.hidden;

  const tick = () => {
    if (paused) return;
    rafId = requestAnimationFrame(tick);

    sunHalo.lookAt(camera.position);
    earthHalo.lookAt(camera.position);

    if (camTransition > 0.01) {
      camera.position.lerp(targetCamPos, 0.12);
      controls.target.lerp(targetLookAt, 0.12);
      camTransition *= 0.88;
    }

    controls.update();
    renderer.render(scene, camera);
  };

  const onVisibility = () => {
    paused = document.hidden;
    if (!paused) tick();
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
      }
    });
    moonMap.dispose();
    moonBump.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return { update, setPreset, resize, dispose };
}
