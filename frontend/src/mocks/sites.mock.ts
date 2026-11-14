import type { LandingSite } from '../shared/types/lunar';

// Catalogo de prueba. Coordenadas APROXIMADAS (sirven para la UI, no para la demo final
// si el backend/LOLA les da valores mejores). Las de regiones Artemis son centros
// aproximados de region, no puntos exactos.

export const MOCK_SITES: LandingSite[] = [
  // --- Polo sur: lo central del reto ---
  {
    id: 'shackleton-ridge',
    name: 'Cresta Shackleton - de Gerlache',
    lat: -89.45,
    lon: -137.3,
    category: 'artemis',
    agency: 'NASA',
    description: 'Cresta muy iluminada entre dos crateres; candidata clasica para larga duracion.',
  },
  {
    id: 'shackleton-floor',
    name: 'Interior del crater Shackleton',
    lat: -89.67,
    lon: 129.78,
    category: 'reference',
    description: 'Region en sombra permanente (hielo). Sirve de contraste: casi nunca ve el Sol.',
  },
  {
    id: 'malapert-massif',
    name: 'Macizo Malapert',
    lat: -85.99,
    lon: 2.9,
    category: 'artemis',
    agency: 'NASA',
    description: 'Montana alta del lado visible; buena vista hacia la Tierra.',
  },
  {
    id: 'haworth',
    name: 'Region Haworth',
    lat: -87.45,
    lon: -4.0,
    category: 'artemis',
    agency: 'NASA',
  },
  {
    id: 'nobile-rim',
    name: 'Borde del crater Nobile',
    lat: -84.6,
    lon: 60.0,
    category: 'artemis',
    agency: 'NASA',
  },
  {
    id: 'im2-athena',
    name: 'IM-2 Athena (Mons Mouton)',
    lat: -84.81,
    lon: 29.19,
    category: 'clps',
    agency: 'Intuitive Machines / NASA CLPS',
    mission: 'IM-2',
    landedAt: '2025-03-06T17:28:00Z',
  },
  {
    id: 'im1-odysseus',
    name: 'IM-1 Odysseus (Malapert A)',
    lat: -80.13,
    lon: 1.44,
    category: 'clps',
    agency: 'Intuitive Machines / NASA CLPS',
    mission: 'IM-1',
    landedAt: '2024-02-22T23:23:00Z',
  },
  {
    id: 'chandrayaan-3',
    name: 'Chandrayaan-3 Vikram (Shiv Shakti)',
    lat: -69.373,
    lon: 32.319,
    category: 'international',
    agency: 'ISRO',
    mission: 'Chandrayaan-3',
    landedAt: '2023-08-23T12:34:00Z',
  },
  {
    id: 'polo-sur',
    name: 'Polo sur exacto',
    lat: -90,
    lon: 0,
    category: 'reference',
  },

  // --- Contraste: lado oculto (la Tierra nunca se ve) ---
  {
    id: 'change-6',
    name: "Chang'e 6 (crater Apollo, lado oculto)",
    lat: -41.64,
    lon: -153.99,
    category: 'international',
    agency: 'CNSA',
    mission: "Chang'e 6",
    landedAt: '2024-06-01T22:23:00Z',
    description: 'Lado oculto: sin comunicacion directa con la Tierra, necesita satelite relay.',
  },
  {
    id: 'change-4',
    name: "Chang'e 4 (Von Karman, lado oculto)",
    lat: -45.44,
    lon: 177.6,
    category: 'international',
    agency: 'CNSA',
    mission: "Chang'e 4",
    landedAt: '2019-01-03T02:26:00Z',
  },

  // --- Contraste: ecuatoriales (dias de ~14 dias terrestres, Sol alto) ---
  {
    id: 'apollo-11',
    name: 'Apollo 11 (Base Tranquilidad)',
    lat: 0.6741,
    lon: 23.473,
    category: 'apollo',
    agency: 'NASA',
    mission: 'Apollo 11',
    landedAt: '1969-07-20T20:17:40Z',
  },
  {
    id: 'apollo-15',
    name: 'Apollo 15 (Hadley-Apennine)',
    lat: 26.1322,
    lon: 3.6339,
    category: 'apollo',
    agency: 'NASA',
    mission: 'Apollo 15',
    landedAt: '1971-07-30T22:16:29Z',
  },
  {
    id: 'apollo-17',
    name: 'Apollo 17 (Taurus-Littrow)',
    lat: 20.1908,
    lon: 30.7717,
    category: 'apollo',
    agency: 'NASA',
    mission: 'Apollo 17',
    landedAt: '1972-12-11T19:54:57Z',
  },
];

/** Solo para el mock: que tipo de terreno inventar para cada sitio. */
export type MockTerrain = 'peak' | 'ridge' | 'plain' | 'crater';

export const MOCK_TERRAIN: Record<string, MockTerrain> = {
  'shackleton-ridge': 'ridge',
  'shackleton-floor': 'crater',
  'malapert-massif': 'peak',
  haworth: 'plain',
  'nobile-rim': 'ridge',
  'im2-athena': 'plain',
  'im1-odysseus': 'crater',
  'chandrayaan-3': 'plain',
  'polo-sur': 'ridge',
};
