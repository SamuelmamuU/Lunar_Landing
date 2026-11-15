import * as THREE from 'three';
import { BODIES } from '../../../shared/lib/bodies';

export interface CelestialBodyController {
  group: THREE.Group;
  update: (timeSec?: number) => void;
  dispose: () => void;
}

function makeSeededRand(seedInit: number): () => number {
  let seed = seedInit;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function createRadialGlowTexture(
  size: number,
  stops: { offset: number; color: string }[],
  withFlareRays = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  for (const s of stops) {
    grad.addColorStop(s.offset, s.color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (withFlareRays) {
    ctx.save();
    ctx.translate(half, half);
    const rand = makeSeededRand(4049);
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + rand() * 0.2;
      const len = half * (0.65 + rand() * 0.32);
      const rayGrad = ctx.createLinearGradient(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
      rayGrad.addColorStop(0, 'rgba(255, 240, 200, 0.28)');
      rayGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.strokeStyle = rayGrad;
      ctx.lineWidth = 1.5 + rand() * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSolarPhotosphereTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = makeSeededRand(7727);

  ctx.fillStyle = '#fb923c';
  ctx.fillRect(0, 0, w, h);

  // Gránulos convectivos y manchas cálidas solares
  for (let i = 0; i < 700; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 2 + rand() * 9;
    const bright = rand() > 0.35;
    ctx.fillStyle = bright
      ? `rgba(254, 249, 195, ${0.18 + rand() * 0.32})`
      : `rgba(194, 65, 12, ${0.22 + rand() * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Oscurecimiento suave hacia los polos
  const tint = ctx.createLinearGradient(0, 0, 0, h);
  tint.addColorStop(0, 'rgba(217, 89, 38, 0.35)');
  tint.addColorStop(0.5, 'rgba(255, 251, 235, 0.22)');
  tint.addColorStop(1, 'rgba(217, 89, 38, 0.35)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function createEarthTextures(): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const w = 1024;
  const h = 512;
  const albedo = document.createElement('canvas');
  albedo.width = w;
  albedo.height = h;
  const aCtx = albedo.getContext('2d')!;

  const rough = document.createElement('canvas');
  rough.width = w;
  rough.height = h;
  const rCtx = rough.getContext('2d')!;

  // Océano profundo realista
  const oceanGrad = aCtx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, '#1e3a8a');
  oceanGrad.addColorStop(0.5, '#1d4ed8');
  oceanGrad.addColorStop(1, '#172554');
  aCtx.fillStyle = oceanGrad;
  aCtx.fillRect(0, 0, w, h);

  rCtx.fillStyle = '#484848'; // océano relativamente especular
  rCtx.fillRect(0, 0, w, h);

  // Masas continentales estilizadas pero geográficamente reconocibles (u=0 -> -180°, u=0.5 -> 0°)
  const landPolygons: [number, number][][] = [
    // América del Norte
    [
      [0.14, 0.16], [0.27, 0.14], [0.32, 0.23], [0.28, 0.34], [0.23, 0.41], [0.19, 0.36], [0.15, 0.24],
    ],
    // América del Sur
    [
      [0.27, 0.44], [0.35, 0.48], [0.37, 0.59], [0.32, 0.74], [0.29, 0.81], [0.26, 0.62],
    ],
    // Groenlandia
    [
      [0.37, 0.09], [0.43, 0.08], [0.44, 0.17], [0.38, 0.19],
    ],
    // Europa
    [
      [0.47, 0.17], [0.56, 0.15], [0.58, 0.24], [0.52, 0.28], [0.46, 0.26],
    ],
    // África
    [
      [0.46, 0.31], [0.56, 0.31], [0.62, 0.42], [0.59, 0.56], [0.54, 0.69], [0.5, 0.54], [0.45, 0.41],
    ],
    // Asia
    [
      [0.58, 0.14], [0.78, 0.14], [0.87, 0.22], [0.83, 0.36], [0.74, 0.43], [0.64, 0.39], [0.57, 0.27],
    ],
    // Australia
    [
      [0.79, 0.57], [0.88, 0.57], [0.89, 0.68], [0.8, 0.69],
    ],
  ];

  const drawLand = (ctx: CanvasRenderingContext2D, fill: string) => {
    ctx.fillStyle = fill;
    for (const poly of landPolygons) {
      ctx.beginPath();
      poly.forEach(([u, v], idx) => {
        if (idx === 0) ctx.moveTo(u * w, v * h);
        else ctx.lineTo(u * w, v * h);
      });
      ctx.closePath();
      ctx.fill();
    }
  };

  drawLand(aCtx, '#3f6212');
  drawLand(rCtx, '#d4d4d4'); // tierra más rugosa

  // Desiertos y relieves continentales
  const rand = makeSeededRand(9901);
  for (let i = 0; i < 65; i++) {
    const px = (0.47 + rand() * 0.22) * w;
    const py = (0.28 + rand() * 0.14) * h;
    aCtx.fillStyle = 'rgba(217, 179, 130, 0.35)';
    aCtx.beginPath();
    aCtx.ellipse(px, py, 14 + rand() * 24, 7 + rand() * 14, rand() * Math.PI, 0, Math.PI * 2);
    aCtx.fill();
  }

  // Casquetes polares Ártico y Antártico
  aCtx.fillStyle = '#e2e8f0';
  aCtx.fillRect(0, 0, w, h * 0.075);
  aCtx.fillRect(0, h * 0.89, w, h * 0.11);

  // Bandas nubosas suaves para aspecto planetario realista
  for (let i = 0; i < 180; i++) {
    const cx = rand() * w;
    const cy = h * (0.08 + rand() * 0.84);
    const rx = 20 + rand() * 68;
    const ry = 4 + rand() * 11;
    aCtx.fillStyle = `rgba(248, 250, 252, ${0.14 + rand() * 0.24})`;
    aCtx.beginPath();
    aCtx.ellipse(cx, cy, rx, ry, (rand() - 0.5) * 0.25, 0, Math.PI * 2);
    aCtx.fill();
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.wrapS = THREE.RepeatWrapping;

  return { map, roughnessMap };
}

/** Construye un Sol realista con fotosfera granulada, halo y corona multicapa. */
export function createRealisticSun(
  radius: number,
  options?: { depthTestHalo?: boolean },
): CelestialBodyController {
  const depthTestHalo = options?.depthTestHalo ?? true;
  const group = new THREE.Group();

  const photoTex = createSolarPhotosphereTexture();
  const sphereGeom = new THREE.SphereGeometry(radius, 32, 24);
  const sphereMat = new THREE.MeshBasicMaterial({
    map: photoTex,
    color: new THREE.Color('#fff7ed'),
  });
  const photosphere = new THREE.Mesh(sphereGeom, sphereMat);
  group.add(photosphere);

  const glowTex = createRadialGlowTexture(256, [
    { offset: 0.0, color: 'rgba(255, 253, 240, 0.95)' },
    { offset: 0.25, color: 'rgba(253, 186, 116, 0.72)' },
    { offset: 0.55, color: 'rgba(217, 89, 38, 0.28)' },
    { offset: 1.0, color: 'rgba(217, 89, 38, 0.0)' },
  ]);
  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: depthTestHalo,
    }),
  );
  glowSprite.scale.set(radius * 3.1, radius * 3.1, 1);
  group.add(glowSprite);

  const coronaTex = createRadialGlowTexture(
    256,
    [
      { offset: 0.0, color: 'rgba(254, 240, 138, 0.5)' },
      { offset: 0.4, color: 'rgba(249, 115, 22, 0.16)' },
      { offset: 1.0, color: 'rgba(217, 89, 38, 0.0)' },
    ],
    true,
  );
  const coronaSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: coronaTex,
      color: BODIES.sun.color,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: depthTestHalo,
    }),
  );
  coronaSprite.scale.set(radius * 4.7, radius * 4.7, 1);
  group.add(coronaSprite);

  const update = (timeSec = 0) => {
    photosphere.rotation.y = timeSec * 0.03;
  };

  const dispose = () => {
    sphereGeom.dispose();
    sphereMat.dispose();
    photoTex.dispose();
    glowSprite.material.dispose();
    glowTex.dispose();
    coronaSprite.material.dispose();
    coronaTex.dispose();
  };

  return { group, update, dispose };
}

/** Construye una Tierra realista con continentes, nubes, fase iluminada y limbo atmosférico. */
export function createRealisticEarth(
  radius: number,
  options?: { depthTestHalo?: boolean },
): CelestialBodyController {
  const depthTestHalo = options?.depthTestHalo ?? true;
  const group = new THREE.Group();

  const { map, roughnessMap } = createEarthTextures();
  const sphereGeom = new THREE.SphereGeometry(radius, 36, 28);
  const sphereMat = new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    roughness: 0.85,
    metalness: 0.05,
    emissive: new THREE.Color('#0c2856'),
    emissiveIntensity: 0.38,
  });
  const globe = new THREE.Mesh(sphereGeom, sphereMat);
  // Inclinación axial sutil y rotación agradable
  globe.rotation.y = -Math.PI * 0.35;
  group.add(globe);

  const atmoTex = createRadialGlowTexture(256, [
    { offset: 0.0, color: 'rgba(57, 135, 229, 0.0)' },
    { offset: 0.62, color: 'rgba(56, 189, 248, 0.16)' },
    { offset: 0.78, color: 'rgba(96, 165, 250, 0.45)' },
    { offset: 1.0, color: 'rgba(57, 135, 229, 0.0)' },
  ]);
  const atmoSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: atmoTex,
      color: BODIES.earth.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: depthTestHalo,
    }),
  );
  atmoSprite.scale.set(radius * 2.55, radius * 2.55, 1);
  group.add(atmoSprite);

  const update = (timeSec = 0) => {
    globe.rotation.y = -Math.PI * 0.35 + timeSec * 0.015;
  };

  const dispose = () => {
    sphereGeom.dispose();
    sphereMat.dispose();
    map.dispose();
    roughnessMap.dispose();
    atmoSprite.material.dispose();
    atmoTex.dispose();
  };

  return { group, update, dispose };
}
