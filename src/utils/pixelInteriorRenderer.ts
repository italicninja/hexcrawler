/**
 * 16-bit pixel-art interiors (style C from texture-previews/interiors-pixel.js):
 * dungeon, cave, ruins, tower and town themes on the generators' shared tile keys.
 *
 * A tile depends on its north neighbours (the 3/4 wall-face trick) and on nearby
 * lights, so a whole floor is rendered at once, at art resolution, into one canvas.
 * Cache the result per map and re-render only when the terrain changes.
 */

import { calculateHexPosition, pixelToOffset } from './hexRenderer';
import { getHexNeighbors } from './hexMath';
import {
  ART_PX,
  BAYER,
  PAL,
  clamp01,
  drawRaw,
  drawSprite,
  fbm,
  hash2,
  rgb,
  rng,
  scatterInHex,
  sprite,
  vnoise,
  type RGB,
} from './pixelTerrainRenderer';

export type InteriorTheme = 'dungeon' | 'cave' | 'ruins' | 'tower' | 'town';

export interface PixelFloor {
  canvas: HTMLCanvasElement;
  /** World-space top-left; draw at canvas size x ART_PX. */
  x: number;
  y: number;
}

interface FloorHex {
  col: number;
  row: number;
  terrain: { key: string };
  content?: string | null;
  buildingType?: unknown;
  buildingId?: number;
}

const F = 6; // height of a wall's south face, in art pixels
const BLOCKS = new Set(['wall', 'water', 'chasm', 'building', 'fence']);
const SOLID = new Set(['wall']);
const P = (a: string[]): RGB[] => a.map(rgb);
const bay = (i: number, j: number) => BAYER[j & 3][i & 3] / 16;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const BLACK: RGB = [0, 0, 0];

/** Map a POI / battlefield type onto one of the five themes. */
export function interiorThemeFor(poiType: unknown): InteriorTheme {
  switch (poiType) {
    case 'cave':
    case 'lair':
      return 'cave';
    case 'ruins':
    case 'temple':
    case 'shrine':
      return 'ruins';
    case 'tower':
      return 'tower';
    case 'camp':
    case 'village':
    case 'town':
    case 'city':
    case 'metropolis':
      return 'town';
    default:
      return 'dungeon';
  }
}

interface Theme {
  ambient: number;
  torches?: boolean;
  glow?: boolean;
  floor: string;
  wallTop: 'masonry' | 'lumps';
  face: 'brick' | 'strata';
  void: 'dark' | 'overgrowth' | 'night';
  floorPal: RGB[];
  wallPal: RGB[];
  facePal: RGB[];
}
const THEMES: Record<InteriorTheme, Theme> = {
  dungeon: {
    ambient: 0.42, torches: true, floor: 'flag', wallTop: 'masonry', face: 'brick', void: 'dark',
    floorPal: P(['#34302b', '#57524a', '#655f55', '#736c60']),
    wallPal: P(['#101014', '#1c1c22', '#24242b', '#2e2e37']),
    facePal: P(['#1a1715', '#4a423a', '#5c5248', '#6e6356']),
  },
  cave: {
    ambient: 0.36, glow: true, floor: 'rock', wallTop: 'lumps', face: 'strata', void: 'dark',
    floorPal: P(['#3a3026', '#54473a', '#615242', '#6f5e4b']),
    wallPal: P(['#110e0b', '#1c1712', '#241e17', '#2e261d']),
    facePal: P(['#16120e', '#3e3428', '#4d4132', '#5d4f3d']),
  },
  ruins: {
    ambient: 1, floor: 'ruinflag', wallTop: 'masonry', face: 'brick', void: 'overgrowth',
    floorPal: P(['#5e5a4a', '#7a7461', '#8d8671', '#a19a83']),
    wallPal: P(['#4a463b', '#625d4f', '#777161', '#8c8674']),
    facePal: P(['#3a362d', '#4d483c', '#5f594b', '#716a5a']),
  },
  tower: {
    ambient: 0.36, torches: true, floor: 'planks', wallTop: 'masonry', face: 'brick', void: 'night',
    floorPal: P(['#3a2618', '#553a24', '#66472c', '#7a5736']),
    wallPal: P(['#141310', '#201e1b', '#2a2824', '#35322d']),
    facePal: P(['#2a2724', '#57524a', '#6a645b', '#7d766b']),
  },
  town: {
    ambient: 1, floor: 'cobble', wallTop: 'masonry', face: 'brick', void: 'dark',
    floorPal: P(['#4c4439', '#6a6053', '#7e7466', '#948a7b']),
    wallPal: P(['#4a4740', '#646058', '#7a766c', '#908b80']),
    facePal: P(['#3e3b35', '#524e46', '#666157', '#7a7469']),
  },
};
const GRASS = P(PAL.grassland), OVERGROWTH = P(PAL.forest);
const WATER = P(['#0e2238', '#16304c', '#1f4062', '#2f5a80']);
const PAVERS = P(['#6e6552', '#948a72', '#a89e85', '#bcb299']);
const DIRT = P(['#5a4430', '#76593c', '#866846', '#98794f']);
/** Town props drawn as sprites instead of building boxes. */
const PROPS = new Set(['well', 'questBoard', 'campfire']);
/** Walkable town ground that trees should not crowd. */
const OPEN_GROUND = new Set(['road', 'path', 'townSquare', 'buildingEntrance', 'gate']);
const STREETS = new Set(['road', 'path', 'townSquare']);
const TOWN_GROUND: Record<string, string> = { road: 'cobble', gate: 'cobble', buildingEntrance: 'cobble', townSquare: 'pavers', path: 'dirt' };
/** Doorsteps and gates sit on whatever street they open onto: dirt in camps, cobble elsewhere. */
function townGround(h: { key: string; buildingType?: unknown; neighbors: Array<{ key: string } | undefined> }): string {
  const inherits = h.key === 'buildingEntrance' || h.key === 'gate' || (h.key === 'building' && PROPS.has(String(h.buildingType)));
  if (!inherits) return TOWN_GROUND[h.key] ?? 'grass';
  // Doorsteps, gates and props take the most common street surface around them
  const counts = new Map<string, number>();
  for (const n of h.neighbors) if (n && STREETS.has(n.key)) counts.set(n.key, (counts.get(n.key) ?? 0) + 1);
  const best = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return best ? TOWN_GROUND[best] : h.key === 'building' ? 'grass' : 'cobble';
}

interface BuildingDef {
  roof: 'tile' | 'slate' | 'thatch' | 'stripes';
  roofPal: RGB[];
  wall: string;
  timber: string;
  ridge?: string;
}
const HOUSE: BuildingDef = { roof: 'thatch', roofPal: P(['#4e3818', '#7a5c28', '#98763a', '#b8924c']), wall: '#cdb890', timber: '#6a4a2a' };
const HOUSES: BuildingDef[] = [
  HOUSE,
  { roof: 'tile', roofPal: P(['#4a2414', '#7a3c22', '#96502e', '#b46a40']), wall: '#d8ccaa', timber: '#5a3a20' },
  { roof: 'slate', roofPal: P(['#2a2e30', '#46505a', '#58646e', '#6e7c86']), wall: '#c4bca8', timber: '#4a3a2a' },
  { roof: 'thatch', roofPal: P(['#3e3418', '#665a2a', '#84763a', '#a2924e']), wall: '#e0d4b4', timber: '#6a4a2a' },
];
const BUILDINGS: Record<string, BuildingDef> = {
  inn: { roof: 'tile', roofPal: P(['#3e1512', '#6e2620', '#8c3428', '#ac4a38']), wall: '#d8c8a0', timber: '#5a3a20' },
  shop: { roof: 'slate', roofPal: P(['#1e252e', '#344050', '#465466', '#5e6e84']), wall: '#c8c0b0', timber: '#4a3a2a' },
  blacksmith: { roof: 'slate', roofPal: P(['#18191c', '#2e3136', '#3e4248', '#52575f']), wall: '#6e6a62', timber: '#3a3632' },
  temple: { roof: 'slate', roofPal: P(['#4a5058', '#727880', '#8e949c', '#aab0b8']), wall: '#dcdcd2', timber: '#b8b8ae', ridge: '#e0b848' },
  house: HOUSE,
  market: { roof: 'stripes', roofPal: P(['#5a1a14', '#a8352c', '#c24a3c', '#e8dcc0']), wall: '#c8b890', timber: '#5a3a20' },
  barracks: { roof: 'slate', roofPal: P(['#2a2a22', '#44443a', '#56564a', '#6a6a5c']), wall: '#7a7a70', timber: '#4a4a40' },
  tent: { roof: 'stripes', roofPal: P(['#5a4a30', '#a89870', '#c4b48a', '#e2d6b4']), wall: '#b8a880', timber: '#5a4a30' },
  questBoard: { roof: 'tile', roofPal: P(['#2e1c0e', '#4e3018', '#6a4422', '#8a5a2e']), wall: '#a07c48', timber: '#4e3018' },
  supplyWagon: { roof: 'stripes', roofPal: P(['#4a3a22', '#c8b890', '#dccca4', '#efe4c6']), wall: '#6a4a2a', timber: '#3a2814' },
  campfire: { roof: 'thatch', roofPal: P(['#2a1a0a', '#5a3a1a', '#7a4e22', '#9a642c']), wall: '#5a3a1a', timber: '#2a1a0a' },
};

// ── Tile patterns ───────────────────────────────────────────────────────────
function worley(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = xi + dx, cy = yi + dy;
    const d = Math.hypot(cx + hash2(cx, cy, s) - x, cy + hash2(cx, cy, s + 1) - y);
    if (d < f1) { f2 = f1; f1 = d; id = hash2(cx, cy, s + 2); } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}
function flag(i: number, j: number, s: number, w = 6, h = 4) {
  const row = Math.floor(j / h), off = (row & 1) * (w >> 1);
  const x = (((i + off) % w) + w) % w, y = ((j % h) + h) % h, col = Math.floor((i + off) / w);
  if (x === 0 || y === 0) return { idx: 0, k: -1 };
  const k = hash2(col, row, s);
  let idx = 1 + Math.floor(k * 2.4);
  if (y === 1 && idx < 3) idx++;
  if (k > 0.93 && x === y + 1) idx = 0; // hairline crack
  return { idx: Math.min(3, idx), k };
}
const mod = (a: number, n: number) => ((a % n) + n) % n;
function floorColor(T: Theme, i: number, j: number, style: string): RGB {
  const t = bay(i, j);
  switch (style) {
    case 'flag': return T.floorPal[flag(i, j, 11, 8, 5).idx];
    case 'rock': {
      const w = worley(i / 8, j / 8, 21);
      if (w.f2 - w.f1 < 0.06) return T.floorPal[0];
      if (hash2(i, j, 23) > 0.985) return T.floorPal[3];
      return T.floorPal[1 + Math.max(0, Math.min(2, Math.floor(w.id * 1.6 + (w.f1 < 0.35 ? 0.5 : 0) + (t - 0.5) * 0.4)))];
    }
    case 'ruinflag': {
      const f = flag(i, j, 12);
      if (f.k >= 0 && f.k < 0.16) return GRASS[1 + Math.min(2, Math.floor(fbm(i * 0.2, j * 0.2, 2, 3) * 2 + t))]; // missing stone
      if (f.idx === 0 && hash2(i, j, 13) > 0.45) return GRASS[t > 0.5 ? 1 : 2]; // moss in the joints
      return T.floorPal[f.idx];
    }
    case 'planks': {
      const row = Math.floor(j / 3);
      if (mod(j, 3) === 0) return T.floorPal[0];
      const x = i + Math.floor(hash2(row, 1, 31) * 16);
      if (mod(x, 14) === 0) return T.floorPal[0];
      if (mod(x, 14) === 1 && mod(j, 3) === 1) return T.floorPal[3]; // nail head
      return T.floorPal[1 + Math.min(2, Math.floor(fbm(i * 0.25, row * 2.1, 2, 33) * 2 + t * 0.6))];
    }
    case 'cobble': {
      const w = worley(i / 2.6, j / 2.6, 41);
      if (w.f2 - w.f1 < 0.16) return T.floorPal[0];
      return T.floorPal[1 + Math.min(2, Math.floor(w.id * 2 + (w.f1 < 0.3 ? 0.6 : 0)))];
    }
    case 'pavers': return PAVERS[flag(i, j, 51, 8, 5).idx];
    case 'dirt': return hash2(i, j, 53) > 0.97 ? DIRT[0] : DIRT[1 + Math.min(2, Math.floor(fbm(i * 0.12, j * 0.12, 3, 52) * 2 + t * 0.8))];
    case 'grass': return GRASS[1 + Math.min(2, Math.floor(clamp01((fbm(i * 0.06, j * 0.06, 3, 7) - 0.28) / 0.44) * 2 + t))];
    default: return T.floorPal[1];
  }
}
function wallTopColor(T: Theme, i: number, j: number): RGB {
  if (T.wallTop === 'lumps') {
    const w = worley(i / 4, j / 4, 61);
    if (w.f2 - w.f1 < 0.1) return T.wallPal[0];
    const f = w.f1 + (bay(i, j) - 0.5) * 0.15;
    return T.wallPal[f < 0.3 ? 3 : f < 0.55 ? 2 : 1];
  }
  return T.wallPal[flag(i, j, 62, 5, 3).idx];
}
function faceColor(T: Theme, i: number, k: number): RGB {
  if (T.face === 'strata') {
    if (k === F) return T.facePal[0];
    return T.facePal[Math.min(3, 1 + ((Math.floor(k / 2) + Math.floor(vnoise(i * 0.25, 3, 71) * 2)) % 2) + (hash2(i >> 1, k, 72) > 0.8 ? 1 : 0))];
  }
  if (k === 1) return T.facePal[3];
  if (k === 4 || k === F) return T.facePal[0];
  const course = k < 4 ? 0 : 1;
  if (mod(i + course * 3, 6) === 0) return T.facePal[0];
  return T.facePal[hash2(Math.floor((i + course * 3) / 6), course, 73) > 0.75 ? 1 : 2];
}
interface Cell {
  col: number;
  row: number;
  key: string;
  content?: string | null;
  buildingType?: unknown;
  buildingId?: number;
  x: number;
  y: number;
  seed: number;
  walk: boolean;
  edge: boolean;
  neighbors: Array<Cell | undefined>;
}

function roofColor(b: BuildingDef, i: number, j: number, dy: number): RGB {
  const pal = b.roofPal, t = bay(i, j);
  if (Math.abs(dy) < 0.5) return b.ridge ? rgb(b.ridge) : pal[3];
  let idx = dy < 0 ? 2 : 1;
  if (b.roof === 'tile') {
    if (mod(j, 2) === 0 || mod(i + (mod(Math.floor(j / 2), 2)) * 2, 4) === 0) idx--;
  } else if (b.roof === 'slate') {
    if (flag(i, j, 81, 3, 2).idx === 0) idx--;
  } else if (b.roof === 'thatch') {
    const n = vnoise(i * 0.8, j * 0.15, 82) + (t - 0.5) * 0.2;
    idx += n > 0.62 ? 1 : n < 0.3 ? -1 : 0;
  } else return mix(mod(i, 6) < 3 ? pal[2] : pal[3], BLACK, dy < 0 ? 0 : 0.2); // stripes
  return pal[Math.max(0, Math.min(3, idx))];
}

/** Screen-space box of one placed building, in local art pixels. */
interface BuildingBox {
  type: string;
  id: number;
  L: number;
  R: number;
  T: number;
  B: number;
  doorX: number | null;
}

type Put = (i: number, j: number, c: RGB) => void;

/**
 * Paint one building: gabled roof over a 3/4-view south facade, door above its doorstep.
 * The box is inscribed in the footprint hexes, so neighbouring lots never overlap.
 */
function drawBuilding(put: Put, darken: (i: number, j: number, f: number) => void, b: BuildingBox, i0: number, j0: number) {
  const h = hash2(b.id, 7, 3);
  const def = b.type === 'house' ? HOUSES[Math.floor(h * HOUSES.length)] : BUILDINGS[b.type] ?? HOUSE, { L, R, T, B } = b, W = R - L;
  const fh = Math.max(7, Math.min(14, Math.round((B - T) * 0.42)));
  const eave = B - fh, ridge = T + Math.round((eave - T) * 0.4);
  const doorX = b.doorX === null ? null : Math.max(L + 4, Math.min(R - 4, b.doorX));
  const wall = rgb(def.wall), timber = rgb(def.timber), stone = rgb('#5a5248'), dark = rgb('#2a1e12');

  // Drop shadow east and a contact line under the facade
  for (let j = T + 3; j <= B + 1; j++) for (let i = R + 1; i <= R + 2; i++) if (bay(i0 + i, j0 + j) < 0.6) darken(i, j, 0.35);
  for (let i = L; i <= R + 2; i++) darken(i, B + 1, 0.3);

  if (b.type === 'tent') {
    const mid = (L + R) / 2, pal = def.roofPal;
    for (let j = T; j <= B; j++) {
      const half = ((j - T + 1) / (B - T + 1)) * (W / 2);
      for (let i = Math.ceil(mid - half); i <= Math.floor(mid + half); i++) {
        const edge = i - (mid - half) < 1 || mid + half - i < 1 || j === B;
        let c = edge ? pal[0] : mod(i0 + i, 6) < 3 ? pal[2] : pal[3];
        if (i > mid && !edge) c = mix(c, BLACK, 0.18);
        if (doorX !== null && j > B - fh && Math.abs(i - doorX) <= (j - (B - fh)) * 0.45) c = dark;
        put(i, j, c);
      }
    }
    return;
  }

  // Roof
  for (let j = T; j <= eave; j++) for (let i = L; i <= R; i++) {
    const edge = i === L || i === R || j === T || j === eave;
    put(i, j, edge ? def.roofPal[0] : mix(roofColor(def, i0 + i, j0 + j, j - ridge), BLACK, i - L < 2 || R - i < 2 ? 0.2 : 0));
  }

  // Facade
  const twoStorey = fh >= 11, beam2 = Math.floor(fh / 2);
  const timbered = b.type === 'house' || b.type === 'inn' || b.type === 'shop';
  for (let k = 1; k <= fh; k++) for (let i = L + 1; i <= R - 1; i++) {
    const j = eave + k, x = i - L;
    let c = wall;
    if (b.type === 'supplyWagon') c = mod(k, 3) === 0 ? timber : mix(wall, BLACK, 0.1 * mod(x, 2));
    else if (b.type === 'temple' && mod(x, 4) === 0) c = mix(wall, BLACK, 0.18); // pilasters
    else if (b.type === 'barracks' || b.type === 'blacksmith') c = flag(i0 + i, j0 + j, 83, 4, 3).idx === 0 ? mix(wall, BLACK, 0.3) : wall;
    else if (timbered && (x === 1 || R - i === 1 || mod(x, 8) === 0 || k === 2 || (twoStorey && k === beam2))) c = timber;
    // Windows, one row per storey, kept clear of the door
    const wk = k - (twoStorey && k > beam2 ? beam2 : 0);
    if ((wk === 3 || wk === 4) && (mod(x, 8) === 3 || mod(x, 8) === 4) && b.type !== 'market' && b.type !== 'supplyWagon' && (doorX === null || Math.abs(i - doorX) > 3))
      c = b.type === 'inn' ? rgb(wk === 3 && mod(x, 8) === 3 ? '#fff0b0' : '#e0a848') : rgb(wk === 3 && mod(x, 8) === 3 ? '#8fb0c8' : '#2a3848');
    if (k === 1) c = mix(c, BLACK, 0.55); // eave shadow
    if (k === fh && b.type !== 'market') c = b.type === 'supplyWagon' ? timber : stone;
    put(i, j, c);
  }

  // Door
  if (doorX !== null && b.type !== 'market' && b.type !== 'supplyWagon') {
    const wide = b.type === 'blacksmith' ? 3 : 2, top = Math.max(2, fh - 7);
    for (let k = top; k < fh; k++) for (let dx = -wide; dx <= wide; dx++) {
      let c = Math.abs(dx) === wide || k === top ? timber : rgb('#4a2c14');
      if (b.type === 'temple' && k === top && Math.abs(dx) === wide) c = wall; // arch
      if (b.type === 'blacksmith' && Math.abs(dx) < wide && k > top) c = rgb(k > fh - 3 && Math.abs(dx) < 2 ? '#ffd070' : '#c8581e'); // forge glow
      if (b.type !== 'blacksmith' && dx === 1 && k === top + 3) c = rgb('#e0b040'); // handle
      put(doorX + dx, eave + k, c);
    }
  }

  // Per-type details
  const chimney = (cx: number, glow: boolean) => {
    for (let j = T - 5; j <= T + 2; j++) for (let i = cx - 1; i <= cx + 1; i++)
      put(i, j, j === T - 5 ? rgb(glow ? '#ff9a2e' : '#3a3632') : mix(stone, BLACK, i === cx + 1 ? 0.3 : 0));
    if (glow) put(cx, T - 6, rgb('#8a8680'));
  };
  if (b.type === 'blacksmith') chimney(R - 5, true);
  if (b.type === 'inn' || (b.type === 'house' && h > 0.35)) chimney(h > 0.6 ? L + 4 : R - 5, false);
  if (b.type === 'inn' && doorX !== null) {
    const sx = doorX + (doorX + 9 < R ? 5 : -8); // hanging sign beside the door
    for (let i = sx; i <= sx + 3; i++) put(i, eave + 2, timber);
    for (let j = eave + 3; j <= eave + 5; j++) for (let i = sx; i <= sx + 3; i++)
      put(i, j, i === sx || i === sx + 3 || j === eave + 5 ? timber : rgb('#d8b048'));
  }
  if (b.type === 'shop' && doorX !== null) {
    for (let k = 2; k <= 3; k++) for (let i = doorX - 4; i <= doorX + 4; i++) put(i, eave + k, rgb(mod(i0 + i, 2) === 0 ? '#b83a2c' : '#efe4c6')); // awning
  }
  if (b.type === 'barracks') {
    for (const bx of [L + 3, R - 5]) for (let k = 2; k <= 7 && k < fh; k++) for (let i = bx; i <= bx + 2; i++)
      put(i, eave + k, k === 2 ? rgb('#e0b848') : k === 7 && i === bx + 1 ? mix(rgb('#9a2a22'), BLACK, 0.3) : rgb('#9a2a22')); // banners
  }
  if (b.type === 'temple') {
    const cx = Math.round((L + R) / 2); // bell tower + spire
    for (let j = T - 9; j <= T + 3; j++) for (let i = cx - 3; i <= cx + 3; i++) {
      const spire = j < T - 4, half = spire ? Math.floor((j - (T - 9)) / 2) : 3;
      if (Math.abs(i - cx) > half) continue;
      let c = spire ? def.roofPal[Math.abs(i - cx) === half ? 0 : i < cx ? 3 : 2] : Math.abs(i - cx) === 3 ? mix(wall, BLACK, 0.3) : wall;
      if (!spire && j >= T - 2 && j <= T && Math.abs(i - cx) <= 1) c = rgb('#2a2418'); // belfry opening
      put(i, j, c);
    }
    put(cx, T - 10, rgb('#e0b848'));
  }
  if (b.type === 'market') {
    for (let k = 2; k <= fh; k++) for (let i = L + 1; i <= R - 1; i++) {
      const x = i - L;
      let c: RGB | null = null;
      if (x === 1 || R - i === 1) c = timber; // stall posts
      else if (k >= fh - 2) c = k === fh ? rgb('#3a2814') : rgb('#8a5a2e'); // counter
      else if (k === fh - 3) c = rgb(['#c83a2a', '#6a9a3a', '#e0c060', '#c87a2a'][Math.floor(hash2(i0 + i, 1, 84) * 4)]); // produce
      if (c) put(i, eave + k, c);
    }
  }
  if (b.type === 'supplyWagon') {
    for (const wx of [L + 5, R - 5]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= 10) put(wx + dx, B - 1 + dy, d2 <= 1 ? rgb('#8a7a60') : d2 >= 6 ? dark : rgb('#5a3a1e')); // wheels
    }
  }
}

interface Light {
  x: number;
  y: number;
  R: number;
  p: number;
  tint: [number, number, number];
}

/**
 * Render a whole interior floor. `grid` darkens the edge pixels of walkable tiles
 * one step (as on the overworld) so combat maps still read as hexes.
 */
export function renderInteriorFloor(
  hexes: readonly FloorHex[],
  themeKey: InteriorTheme,
  r: number,
  { grid = false } = {}
): PixelFloor {
  const T = THEMES[themeKey];
  const byKey = new Map<string, Cell>();
  for (const h of hexes) {
    const { x, y } = calculateHexPosition(h.col, h.row, r);
    byKey.set(`${h.col},${h.row}`, {
      col: h.col, row: h.row, key: h.terrain.key, content: h.content, buildingType: h.buildingType, buildingId: h.buildingId,
      x, y, seed: hash2(h.col, h.row, 99), walk: !BLOCKS.has(h.terrain.key), edge: false, neighbors: [],
    });
  }
  const cellsArr = [...byKey.values()];
  for (const c of cellsArr) c.neighbors = getHexNeighbors(c.col, c.row).map(n => byKey.get(`${n.col},${n.row}`));
  // Town walls are the perimeter, so every wall hex shows masonry (no dark void)
  for (const c of cellsArr) c.edge = SOLID.has(c.key) && (themeKey === 'town' || c.neighbors.some(n => n?.walk));

  // Art-pixel bounds of the floor, aligned to the world art grid
  const xs = cellsArr.map(c => c.x), ys = cellsArr.map(c => c.y);
  const i0 = Math.floor((Math.min(...xs) - r) / ART_PX), j0 = Math.floor((Math.min(...ys) - r) / ART_PX);
  const GW = Math.ceil((Math.max(...xs) + r) / ART_PX) - i0, GH = Math.ceil((Math.max(...ys) + r) / ART_PX) - j0;
  const owner: Array<Cell | undefined> = new Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const o = pixelToOffset((i0 + i + 0.5) * ART_PX, (j0 + j + 0.5) * ART_PX, r);
    owner[j * GW + i] = byKey.get(`${o.col},${o.row}`);
  }
  // Local art coords (i, j); world art coords are (i0 + i, j0 + j) and drive all noise.
  const G = (i: number, j: number) => (i < 0 || j < 0 || i >= GW || j >= GH ? undefined : owner[j * GW + i]);
  const solidAt = (i: number, j: number) => { const a = G(i, j); return !!a && SOLID.has(a.key); };

  const canvas = document.createElement('canvas');
  canvas.width = GW;
  canvas.height = GH;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(GW, GH), d = img.data;
  const unlit = new Uint8Array(GW * GH); // night-sky stars ignore the light map

  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const h = G(i, j);
    if (!h) continue;
    const wi = i0 + i, wj = j0 + j, t = bay(wi, wj);
    const cx = Math.round(h.x / ART_PX) - i0, cy = Math.round(h.y / ART_PX) - j0;
    let c: RGB;
    const ground = themeKey === 'town' ? townGround(h) : T.floor;

    if (h.key === 'wall' && !h.edge) {
      if (T.void === 'night') {
        c = rgb(t > 0.5 ? '#0b1020' : '#0e1428');
        if (hash2(wi, wj, 77) > 0.992) { c = rgb('#c9d3f0'); unlit[j * GW + i] = 1; }
      } else if (T.void === 'overgrowth') c = OVERGROWTH[1 + Math.min(2, Math.floor(fbm(wi * 0.1, wj * 0.1, 3, 9) * 2 + t))];
      else c = rgb(fbm(wi * 0.1, wj * 0.1, 2, 5) + t * 0.2 > 0.72 ? '#131318' : '#0a0a0d');
    } else if (h.key === 'wall') {
      c = wallTopColor(T, wi, wj);
      if (!solidAt(i, j - 1) || !solidAt(i - 1, j) || !solidAt(i + 1, j)) c = T.wallPal[0]; // outline where the top meets open floor
    } else if (h.key === 'chasm') {
      let k = 0;
      for (let kk = 1; kk <= F; kk++) { const a = G(i, j - kk); if (a?.walk) { k = kk; break; } }
      c = k ? mix(T.facePal[2], [4, 4, 6], (k - 1) / F) : rgb(hash2(wi, wj, 91) > 0.985 ? '#15151c' : '#050507');
    } else if (h.key === 'water') {
      const up1 = G(i, j - 1), up2 = G(i, j - 2);
      if (up1?.walk) c = T.facePal[2];
      else if (up2?.walk) c = T.facePal[1];
      else if ([G(i + 1, j), G(i - 1, j), G(i, j + 1)].some(n => n?.walk)) c = rgb('#8fb8d0');
      else c = WATER[Math.sin(wj * 0.9 + fbm(wi * 0.1, wj * 0.1, 2, 93) * 5) > 0.85 ? 3 : 1 + Math.min(1, Math.floor(fbm(wi * 0.08, wj * 0.08, 3, 92) * 1.4 + t * 0.6))];
    } else {
      c = floorColor(T, wi, wj, ground);
      if ((h.key === 'stairsDown' || h.key === 'stairsUp') && Math.abs(i - cx) <= 5 && Math.abs(j - cy) <= 5) {
        const step = Math.floor((j - cy + 5) / 2), f = h.key === 'stairsDown' ? step / 5.5 : (5 - step) / 5.5;
        c = Math.abs(i - cx) === 5 ? rgb('#141210') : (j - cy + 5) % 2 === 0 ? mix(rgb('#a39c8c'), BLACK, f * 0.7) : mix(rgb('#5e594f'), BLACK, f * 0.85);
      }
      if (grid && h.walk && (G(i + 1, j) !== h || G(i, j + 1) !== h)) c = mix(c, BLACK, 0.18);
    }
    // South faces: an open pixel just below a solid block shows that block's front wall
    if (!SOLID.has(h.key) && h.key !== 'chasm' && !(h.key === 'wall' && !h.edge)) {
      for (let k = 1; k <= F + 2; k++) {
        const a = G(i, j - k);
        if (!a) break;
        if (!SOLID.has(a.key)) continue;
        if (a.key === 'wall' && !a.edge) break;
        if (k <= F) c = faceColor(T, wi, k);
        else if (k === F + 1 || t < 0.5) c = mix(c, BLACK, 0.45); // contact shadow
        break;
      }
    }
    const o = (j * GW + i) * 4;
    d[o] = c[0];
    d[o + 1] = c[1];
    d[o + 2] = c[2];
    d[o + 3] = 255;
  }

  // Buildings: one box per buildingId, inscribed in its footprint hexes, painted north to south
  const put: Put = (i, j, c) => {
    if (!G(i, j)) return;
    const o = (j * GW + i) * 4;
    d[o] = c[0];
    d[o + 1] = c[1];
    d[o + 2] = c[2];
  };
  const darken = (i: number, j: number, f: number) => {
    if (!G(i, j)) return;
    const o = (j * GW + i) * 4;
    for (let k = 0; k < 3; k++) d[o + k] *= 1 - f;
  };
  const ax = (c: Cell) => Math.round(c.x / ART_PX) - i0, ay = (c: Cell) => Math.round(c.y / ART_PX) - j0;
  const hw = Math.floor((r * Math.sqrt(3)) / 2 / ART_PX) - 1, lr = r / ART_PX;
  const footprints = new Map<number, Cell[]>(), doors = new Map<number, Cell>();
  for (const c of cellsArr) {
    if (c.buildingId === undefined) continue;
    if (c.key === 'building') footprints.set(c.buildingId, [...(footprints.get(c.buildingId) ?? []), c]);
    else doors.set(c.buildingId, c);
  }
  const boxes: BuildingBox[] = [];
  for (const [id, cells] of footprints) {
    const type = String(cells[0].buildingType);
    if (PROPS.has(type)) continue;
    const rows = new Map<number, number[]>();
    for (const c of cells) rows.set(c.row, [...(rows.get(c.row) ?? []), ax(c)]);
    const spans = [...rows.values()], ys = cells.map(ay), door = doors.get(id);
    boxes.push({
      type, id,
      L: Math.max(...spans.map(xs => Math.min(...xs))) - hw,
      R: Math.min(...spans.map(xs => Math.max(...xs))) + hw,
      T: Math.min(...ys) - Math.round(lr * 0.55),
      B: Math.max(...ys) + Math.round(lr * 0.5),
      doorX: door ? ax(door) : null,
    });
  }
  boxes.sort((a, b) => a.T - b.T || a.L - b.L);
  for (const b of boxes) drawBuilding(put, darken, b, i0, j0);
  ctx.putImageData(img, 0, 0);

  // Fences: split rails from each post toward its fence/gate neighbours; gateposts beside the gate
  const FENCED = new Set(['fence', 'gate']);
  const dot = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  for (const h of cellsArr) {
    const cx = ax(h), cy = ay(h);
    if (h.key === 'fence') {
      for (const n of h.neighbors) {
        if (!n || !FENCED.has(n.key)) continue;
        // At a corner three fence hexes touch; skip the shortcut rail past the corner post
        const tip = h.neighbors.find(m => m && m !== n && FENCED.has(m.key) && n.neighbors.includes(m));
        if (tip && tip.neighbors.filter(m => m && FENCED.has(m.key)).length === 2) continue;
        const mx = (ax(n) - cx) / 2, my = (ay(n) - cy) / 2, steps = Math.max(Math.abs(mx), Math.abs(my));
        for (let k = 0; k <= steps; k++) {
          const x = Math.round(cx + (mx * k) / steps), y = Math.round(cy + (my * k) / steps);
          dot(x, y - 4, 1, 1, '#7a5632');
          dot(x, y - 1, 1, 1, '#7a5632');
          dot(x, y, 1, 1, '#3a2614');
        }
      }
      dot(cx, cy - 6, 2, 7, '#4a3018');
      dot(cx, cy - 6, 2, 1, '#8a6a42');
    }
    if (h.key === 'gate') {
      for (const n of h.neighbors) {
        if (!n || n.row !== h.row || (n.key !== 'fence' && n.key !== 'wall')) continue;
        const stone = n.key === 'wall', w = stone ? 4 : 2, x = n.col < h.col ? cx - hw - 1 : cx + hw - w + 2;
        dot(x, cy - (stone ? 12 : 8), w, stone ? 14 : 9, stone ? '#646058' : '#4a3018');
        dot(x, cy - (stone ? 12 : 8), w, 1, stone ? '#908b80' : '#a0804a');
      }
    }
    if (h.key === 'building' && PROPS.has(String(h.buildingType))) drawRaw(ctx, String(h.buildingType), cx, cy + 5);
  }

  // Decorations that receive lighting
  const lights: Light[] = [], emissive: Array<[string, number, number]> = [];
  const sorted = [...cellsArr].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const h of sorted) {
    const rand = rng(h.seed), cx = Math.round(h.x / ART_PX) - i0, cy = Math.round(h.y / ART_PX) - j0;
    const spots = (n: number, md: number, margin: number) => scatterInHex(cx, cy, lr, n, md, margin, rand);
    if (h.key === 'rubble') for (const [x, y, k] of spots(4, 3, 2)) drawRaw(ctx, k < 0.5 ? 'rubble1' : 'rubble2', x, y);
    // Buildings are already painted, so keep grass decor off hexes whose neighbours carry roofs/chimneys
    if (themeKey === 'town' && h.key === 'grass' && h.neighbors.every(n => n?.key !== 'building')) {
      for (const [x, y, k] of spots(3, 3, 2)) drawRaw(ctx, k < 0.3 ? 'flower' : 'tuft', x, y);
      if (rand() < 0.3 && h.neighbors.every(n => !n || !OPEN_GROUND.has(n.key))) drawSprite(ctx, sprite('tree', rand() < 0.5 ? 3 : 4), cx, cy + 4);
    }
    if (T.void === 'overgrowth' && h.key === 'wall' && !h.edge && rand() < 0.7) {
      for (const [x, y, k] of spots(2, 5, 3)) drawSprite(ctx, sprite('tree', k < 0.5 ? 3 : 4), x, y);
    }
    if (T.torches && h.key === 'wall' && h.edge && hash2(h.col, h.row, 5) < 0.4) {
      const tx = cx, ty = Math.round((h.y + r) / ART_PX) - j0 + 3;
      if (G(tx, ty)?.walk && !lights.some(l => Math.hypot(l.x - tx, l.y - ty) < lr * 4.5)) {
        lights.push({ x: tx, y: ty, R: lr * 4.2, p: 1.1, tint: [1.15, 0.95, 0.7] });
        emissive.push(['torch', tx, ty]);
      }
    }
    if (T.glow && h.walk && h.neighbors.some(n => n?.key === 'wall') && hash2(h.col, h.row, 6) < 0.16) {
      const [x, y] = spots(1, 0, 3)[0] ?? [cx, cy];
      lights.push({ x, y, R: lr * 2.4, p: 0.8, tint: [0.7, 1.1, 1.15] });
      emissive.push(['shroom', x, y]);
    }
    if ((h.content === 'exit' || h.key === 'exit') && themeKey !== 'town') {
      lights.push({ x: cx, y: cy, R: lr * 2.2, p: 1.2, tint: [1.05, 1.02, 0.9] }); // daylight from above
    }
  }

  // Light map: ambient + point lights, quantised to 4 levels with ordered dithering
  if (T.ambient < 1) {
    const px = ctx.getImageData(0, 0, GW, GH), q = px.data;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      if (unlit[j * GW + i]) continue;
      let L = T.ambient, tr = 0, tg = 0, tb = 0, sum = 0;
      for (const l of lights) {
        const f = Math.max(0, 1 - Math.hypot(i - l.x, j - l.y) / l.R);
        if (!f) continue;
        const c = l.p * f * f;
        L += c; sum += c; tr += c * l.tint[0]; tg += c * l.tint[1]; tb += c * l.tint[2];
      }
      const level = Math.min(3, Math.floor(clamp01(L) * 3 + bay(i0 + i, j0 + j))) / 3;
      const b = 0.2 + 0.8 * level, w = sum ? Math.min(1, sum / L) * 0.6 : 0;
      const o = (j * GW + i) * 4;
      q[o] *= b * (1 - w + w * (sum ? tr / sum : 1));
      q[o + 1] *= b * (1 - w + w * (sum ? tg / sum : 1));
      q[o + 2] *= b * (1 - w + w * (sum ? tb / sum : 1));
    }
    ctx.putImageData(px, 0, 0);
  }
  // Emissive sprites stay full-bright
  for (const [name, x, y] of emissive) drawRaw(ctx, name, x, y);

  return { canvas, x: i0 * ART_PX, y: j0 * ART_PX };
}
