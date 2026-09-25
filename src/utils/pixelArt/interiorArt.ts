/**
 * 16-bit pixel-art renderer for interior maps (dungeon, cave, ruins, tower, town).
 *
 * Renders the whole map once into an art-resolution canvas. A tile can't be rendered
 * alone: wall/building south faces spill onto the hexes below, and torch light spans
 * rooms. Callers cache the result and blit it scaled by hexSize / ART_HEX_RADIUS.
 * Gameplay markers (chests, encounters, stairs icons) are NOT drawn here; the canvas
 * component still owns those because they depend on discovery state.
 */

import {
  ART_HEX_RADIUS,
  BLACK,
  artHexCenter,
  artPixelHex,
  bayer,
  clamp01,
  drawRawSprite,
  drawSprite,
  fbm,
  hash2,
  mix,
  pal,
  rgb,
  rng,
  scatterInHex,
  sprite,
  vnoise,
  worley,
  type RGB,
} from './core';
import { getHexNeighbors } from '../hexMath';

export interface InteriorArtHex {
  col: number;
  row: number;
  terrain: { key: string };
  content?: string | null;
  buildingType?: string;
}

export interface InteriorArt {
  canvas: HTMLCanvasElement;
  /** Scale factor from art pixels to world units at a given hex size. */
  scaleFor(hexSize: number): number;
}

type Theme = 'dungeon' | 'cave' | 'ruins' | 'tower' | 'town';
type FloorStyle = 'flag' | 'rock' | 'ruinflag' | 'planks' | 'cobble' | 'pavers' | 'grass';

interface ThemeDef {
  ambient: number;
  torches?: boolean;
  glow?: boolean;
  floor: FloorStyle;
  wallTop: 'masonry' | 'lumps';
  face: 'brick' | 'strata';
  void: 'dark' | 'night' | 'overgrowth';
  floorPal: RGB[];
  wallPal: RGB[];
  facePal: RGB[];
}

const R = ART_HEX_RADIUS;
const F = 6; // height of a wall's south face in art pixels (the 3/4 depth trick)
const BLOCKS = new Set(['wall', 'water', 'chasm', 'building', 'fence']);
const SOLID = new Set(['wall', 'building']);

const THEMES: Record<Theme, ThemeDef> = {
  dungeon: {
    ambient: 0.42,
    torches: true,
    floor: 'flag',
    wallTop: 'masonry',
    face: 'brick',
    void: 'dark',
    floorPal: pal(['#34302b', '#57524a', '#655f55', '#736c60']),
    wallPal: pal(['#101014', '#1c1c22', '#24242b', '#2e2e37']),
    facePal: pal(['#1a1715', '#4a423a', '#5c5248', '#6e6356']),
  },
  cave: {
    ambient: 0.36,
    glow: true,
    floor: 'rock',
    wallTop: 'lumps',
    face: 'strata',
    void: 'dark',
    floorPal: pal(['#3a3026', '#54473a', '#615242', '#6f5e4b']),
    wallPal: pal(['#110e0b', '#1c1712', '#241e17', '#2e261d']),
    facePal: pal(['#16120e', '#3e3428', '#4d4132', '#5d4f3d']),
  },
  ruins: {
    ambient: 1,
    floor: 'ruinflag',
    wallTop: 'masonry',
    face: 'brick',
    void: 'overgrowth',
    floorPal: pal(['#5e5a4a', '#7a7461', '#8d8671', '#a19a83']),
    wallPal: pal(['#4a463b', '#625d4f', '#777161', '#8c8674']),
    facePal: pal(['#3a362d', '#4d483c', '#5f594b', '#716a5a']),
  },
  tower: {
    ambient: 0.36,
    torches: true,
    floor: 'planks',
    wallTop: 'masonry',
    face: 'brick',
    void: 'night',
    floorPal: pal(['#3a2618', '#553a24', '#66472c', '#7a5736']),
    wallPal: pal(['#141310', '#201e1b', '#2a2824', '#35322d']),
    facePal: pal(['#2a2724', '#57524a', '#6a645b', '#7d766b']),
  },
  town: {
    ambient: 1,
    floor: 'cobble',
    wallTop: 'masonry',
    face: 'brick',
    void: 'dark',
    floorPal: pal(['#4c4439', '#6a6053', '#7e7466', '#948a7b']),
    wallPal: pal(['#4a4740', '#646058', '#7a766c', '#908b80']),
    facePal: pal(['#3e3b35', '#524e46', '#666157', '#7a7469']),
  },
};

const GRASS = pal(['#3f6b2f', '#4f8337', '#62993f', '#7cae4e']);
const OVERGROWTH = pal(['#1f3b22', '#2c5230', '#3b6a3a', '#4f8446']);
const WATER = pal(['#0e2238', '#16304c', '#1f4062', '#2f5a80']);
const PAVERS = pal(['#6e6552', '#948a72', '#a89e85', '#bcb299']);

interface BuildingDef {
  roof: 'tile' | 'slate' | 'thatch' | 'stripes';
  roofPal: RGB[];
  wall: string;
  timber: string;
  ridge?: string;
}
const BUILDINGS: Record<string, BuildingDef> = {
  inn: {
    roof: 'tile',
    roofPal: pal(['#3e1512', '#6e2620', '#8c3428', '#ac4a38']),
    wall: '#d8c8a0',
    timber: '#5a3a20',
  },
  shop: {
    roof: 'slate',
    roofPal: pal(['#1e252e', '#344050', '#465466', '#5e6e84']),
    wall: '#c8c0b0',
    timber: '#4a3a2a',
  },
  blacksmith: {
    roof: 'slate',
    roofPal: pal(['#18191c', '#2e3136', '#3e4248', '#52575f']),
    wall: '#6e6a62',
    timber: '#3a3632',
  },
  temple: {
    roof: 'slate',
    roofPal: pal(['#4a5058', '#727880', '#8e949c', '#aab0b8']),
    wall: '#dcdcd2',
    timber: '#b8b8ae',
    ridge: '#e0b848',
  },
  house: {
    roof: 'thatch',
    roofPal: pal(['#4e3818', '#7a5c28', '#98763a', '#b8924c']),
    wall: '#cdb890',
    timber: '#6a4a2a',
  },
  market: {
    roof: 'stripes',
    roofPal: pal(['#5a1a14', '#a8352c', '#c24a3c', '#e8dcc0']),
    wall: '#c8b890',
    timber: '#5a3a20',
  },
  barracks: {
    roof: 'slate',
    roofPal: pal(['#2a2a22', '#44443a', '#56564a', '#6a6a5c']),
    wall: '#7a7a70',
    timber: '#4a4a40',
  },
  tent: {
    roof: 'stripes',
    roofPal: pal(['#5a4a30', '#a89870', '#c4b48a', '#e2d6b4']),
    wall: '#b8a880',
    timber: '#5a4a30',
  },
};

/** Map an interior's poiType to a visual theme. */
export function themeForPoi(poiType: unknown): Theme {
  switch (poiType) {
    case 'cave':
    case 'lair':
      return 'cave';
    case 'ruins':
      return 'ruins';
    case 'tower':
      return 'tower';
    case 'town':
    case 'village':
    case 'city':
    case 'metropolis':
    case 'camp':
      return 'town';
    default:
      return 'dungeon';
  }
}

// ── Patterns (palette index 0..3) ──────────────────────────────────────────

function flag(i: number, j: number, s: number, w = 6, h = 4): { idx: number; k: number } {
  const row = Math.floor(j / h);
  const off = (row & 1) * (w >> 1);
  const x = (i + off) % w;
  const y = j % h;
  if (x === 0 || y === 0) return { idx: 0, k: -1 };
  const k = hash2(Math.floor((i + off) / w), row, s);
  let idx = 1 + Math.floor(k * 2.4);
  if (y === 1 && idx < 3) idx++;
  if (k > 0.93 && x === y + 1) idx = 0; // hairline crack
  return { idx: Math.min(3, idx), k };
}

function floorColor(T: ThemeDef, i: number, j: number, style: FloorStyle): RGB {
  const t = bayer(i, j);
  switch (style) {
    case 'flag':
      return T.floorPal[flag(i, j, 11, 8, 5).idx];
    case 'rock': {
      const w = worley(i / 8, j / 8, 21);
      if (w.f2 - w.f1 < 0.06) return T.floorPal[0];
      if (hash2(i, j, 23) > 0.985) return T.floorPal[3];
      return T.floorPal[
        1 + Math.min(2, Math.floor(w.id * 1.6 + (w.f1 < 0.35 ? 0.5 : 0) + (t - 0.5) * 0.4))
      ];
    }
    case 'ruinflag': {
      const f = flag(i, j, 12);
      if (f.k >= 0 && f.k < 0.16)
        return GRASS[1 + Math.min(2, Math.floor(fbm(i * 0.2, j * 0.2, 2, 3) * 2 + t))];
      if (f.idx === 0 && hash2(i, j, 13) > 0.45) return GRASS[t > 0.5 ? 1 : 2]; // moss in the joints
      return T.floorPal[f.idx];
    }
    case 'planks': {
      const row = Math.floor(j / 3);
      if (j % 3 === 0) return T.floorPal[0];
      const x = i + Math.floor(hash2(row, 1, 31) * 16);
      if (x % 14 === 0) return T.floorPal[0];
      if (x % 14 === 1 && j % 3 === 1) return T.floorPal[3]; // nail head
      return T.floorPal[1 + Math.min(2, Math.floor(fbm(i * 0.25, row * 2.1, 2, 33) * 2 + t * 0.6))];
    }
    case 'cobble': {
      const w = worley(i / 2.6, j / 2.6, 41);
      if (w.f2 - w.f1 < 0.16) return T.floorPal[0];
      return T.floorPal[1 + Math.min(2, Math.floor(w.id * 2 + (w.f1 < 0.3 ? 0.6 : 0)))];
    }
    case 'pavers':
      return PAVERS[flag(i, j, 51, 8, 5).idx];
    default:
      return GRASS[
        1 + Math.min(2, Math.floor(clamp01((fbm(i * 0.06, j * 0.06, 3, 7) - 0.28) / 0.44) * 2 + t))
      ];
  }
}

function wallTopColor(T: ThemeDef, i: number, j: number): RGB {
  if (T.wallTop === 'lumps') {
    const w = worley(i / 4, j / 4, 61);
    if (w.f2 - w.f1 < 0.1) return T.wallPal[0];
    const f = w.f1 + (bayer(i, j) - 0.5) * 0.15;
    return T.wallPal[f < 0.3 ? 3 : f < 0.55 ? 2 : 1];
  }
  return T.wallPal[flag(i, j, 62, 5, 3).idx];
}

function faceColor(T: ThemeDef, i: number, k: number): RGB {
  if (T.face === 'strata') {
    if (k === F) return T.facePal[0];
    const band = (Math.floor(k / 2) + Math.floor(vnoise(i * 0.25, 3, 71) * 2)) % 2;
    return T.facePal[Math.min(3, 1 + band + (hash2(i >> 1, k, 72) > 0.8 ? 1 : 0))];
  }
  if (k === 1) return T.facePal[3];
  if (k === 4 || k === F) return T.facePal[0];
  const course = k < 4 ? 0 : 1;
  if ((i + course * 3) % 6 === 0) return T.facePal[0];
  return T.facePal[hash2(Math.floor((i + course * 3) / 6), course, 73) > 0.75 ? 1 : 2];
}

function facadeColor(b: BuildingDef, i: number, k: number, doorX: number | null): RGB {
  const wall = rgb(b.wall);
  const timber = rgb(b.timber);
  if (k === 1) return mix(wall, BLACK, 0.55); // eave shadow
  if (k === F) return rgb('#5a5248'); // stone footing
  if (doorX !== null && Math.abs(i - doorX) <= 2 && k >= 2) {
    if (Math.abs(i - doorX) === 2) return timber;
    return k === 4 && i === doorX + 1 ? rgb('#e0b040') : rgb('#4a2c14');
  }
  if (i % 7 === 0 || k === 2) return timber;
  if ((k === 3 || k === 4) && (i % 7 === 3 || i % 7 === 4))
    return k === 3 && i % 7 === 3 ? rgb('#8fb0c8') : rgb('#2a3848');
  return wall;
}

interface Group {
  def: BuildingDef;
  ridge: number;
}

function roofColor(g: Group, i: number, j: number, onEdge: boolean): RGB {
  const b = g.def;
  const p = b.roofPal;
  const dy = j - g.ridge;
  if (onEdge) return p[0];
  if (Math.abs(dy) < 0.5) return b.ridge ? rgb(b.ridge) : p[3];
  if (b.roof === 'stripes') return mix(i % 6 < 3 ? p[2] : p[3], BLACK, dy < 0 ? 0 : 0.2);
  let idx = dy < 0 ? 2 : 1;
  if (b.roof === 'tile') {
    if (j % 2 === 0 || (i + (Math.floor(j / 2) % 2) * 2) % 4 === 0) idx--;
  } else if (b.roof === 'slate') {
    if (flag(i, j, 81, 3, 2).idx === 0) idx--;
  } else {
    const n = vnoise(i * 0.8, j * 0.15, 82) + (bayer(i, j) - 0.5) * 0.2;
    idx += n > 0.62 ? 1 : n < 0.3 ? -1 : 0;
  }
  return p[Math.max(0, Math.min(3, idx))];
}

// ── Renderer ───────────────────────────────────────────────────────────────

interface Cell {
  col: number;
  row: number;
  key: string;
  walk: boolean;
  edge: boolean; // solid tile touching open floor (shows a top face instead of void)
  group: Group | null;
  buildingType?: string;
  content?: string | null;
}

interface Light {
  x: number;
  y: number;
  r: number;
  p: number;
  tint: RGB;
}

export function renderInteriorArt(hexes: InteriorArtHex[], poiType: unknown): InteriorArt | null {
  if (!hexes.length) return null;
  const canvas = document.createElement('canvas');
  const actx = canvas.getContext('2d');
  if (!actx) return null;

  const theme = themeForPoi(poiType);
  const T = THEMES[theme];
  const cells = new Map<string, Cell>();
  for (const h of hexes) {
    const key = h.terrain.key;
    cells.set(`${h.col},${h.row}`, {
      col: h.col,
      row: h.row,
      key,
      walk: !BLOCKS.has(key),
      edge: false,
      group: null,
      buildingType: h.buildingType,
      content: h.content,
    });
  }
  const at = (col: number, row: number) => cells.get(`${col},${row}`);
  const neighbors = (c: Cell) => getHexNeighbors(c.col, c.row).map(n => at(n.col, n.row));
  for (const c of cells.values()) c.edge = SOLID.has(c.key) && neighbors(c).some(n => n?.walk);

  // One continuous roof per building: flood-fill same-type building hexes
  for (const c of cells.values()) {
    if (c.key !== 'building' || c.group) continue;
    const g: Group = { def: BUILDINGS[c.buildingType ?? ''] ?? BUILDINGS.house, ridge: 0 };
    const members: Cell[] = [];
    const stack = [c];
    c.group = g;
    while (stack.length) {
      const cur = stack.pop()!;
      members.push(cur);
      for (const n of neighbors(cur)) {
        if (
          n &&
          !n.group &&
          (n.key === 'building' || n.key === 'buildingEntrance') &&
          n.buildingType === c.buildingType
        ) {
          n.group = g;
          stack.push(n);
        }
      }
    }
    const roof = members.filter(m => m.key === 'building');
    g.ridge = Math.round(roof.reduce((s, m) => s + artHexCenter(m.col, m.row).y, 0) / roof.length);
  }

  let maxX = 0;
  let maxY = 0;
  for (const c of cells.values()) {
    const p = artHexCenter(c.col, c.row);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const GW = Math.ceil(maxX + R);
  const GH = Math.ceil(maxY + R) + 1;
  canvas.width = GW;
  canvas.height = GH;

  const grid: Array<Cell | undefined> = new Array(GW * GH);
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const h = artPixelHex(i, j);
      grid[j * GW + i] = at(h.col, h.row);
    }
  const G = (i: number, j: number) =>
    i < 0 || j < 0 || i >= GW || j >= GH ? undefined : grid[j * GW + i];
  const solidAt = (i: number, j: number) => {
    const a = G(i, j);
    return !!a && SOLID.has(a.key);
  };
  const isVoid = (c: Cell) => c.key === 'wall' && !c.edge;

  const img = actx.createImageData(GW, GH);
  const d = img.data;
  const unlit = new Uint8Array(GW * GH); // stars ignore the light map

  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const h = G(i, j);
      if (!h) continue;
      const t = bayer(i, j);
      const center = artHexCenter(h.col, h.row);
      const cx = Math.round(center.x);
      const cy = Math.round(center.y);
      const ground: FloorStyle =
        theme === 'town'
          ? ((
              {
                road: 'cobble',
                gate: 'cobble',
                buildingEntrance: 'cobble',
                townSquare: 'pavers',
              } as Record<string, FloorStyle>
            )[h.key] ?? 'grass')
          : T.floor;
      let c: RGB;

      if (h.key === 'building' && h.group) {
        const onEdge = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([a, b]) => {
          const n = G(i + a, j + b);
          return !n || n.group !== h.group || n.key !== 'building';
        });
        c = roofColor(h.group, i, j, onEdge);
      } else if (isVoid(h)) {
        if (T.void === 'night') {
          c = rgb(t > 0.5 ? '#0b1020' : '#0e1428');
          if (hash2(i, j, 77) > 0.992) {
            c = rgb('#c9d3f0');
            unlit[j * GW + i] = 1;
          }
        } else if (T.void === 'overgrowth') {
          c = OVERGROWTH[1 + Math.min(2, Math.floor(fbm(i * 0.1, j * 0.1, 3, 9) * 2 + t))];
        } else c = rgb(fbm(i * 0.1, j * 0.1, 2, 5) + t * 0.2 > 0.72 ? '#131318' : '#0a0a0d');
      } else if (h.key === 'wall') {
        c = wallTopColor(T, i, j);
        // Outline where the wall top meets open floor
        if (!solidAt(i, j - 1) || !solidAt(i - 1, j) || !solidAt(i + 1, j)) c = T.wallPal[0];
      } else if (h.key === 'chasm') {
        let k = 0;
        for (let kk = 1; kk <= F; kk++) {
          const a = G(i, j - kk);
          if (a?.walk) {
            k = kk;
            break;
          }
        }
        c = k
          ? mix(T.facePal[2], [4, 4, 6], (k - 1) / F)
          : rgb(hash2(i, j, 91) > 0.985 ? '#15151c' : '#050507');
      } else if (h.key === 'water') {
        if (G(i, j - 1)?.walk) c = T.facePal[2];
        else if (G(i, j - 2)?.walk) c = T.facePal[1];
        else if ([G(i + 1, j), G(i - 1, j), G(i, j + 1)].some(n => n?.walk)) c = rgb('#8fb8d0');
        else if (Math.sin(j * 0.9 + fbm(i * 0.1, j * 0.1, 2, 93) * 5) > 0.85) c = WATER[3];
        else c = WATER[1 + Math.min(1, Math.floor(fbm(i * 0.08, j * 0.08, 3, 92) * 1.4 + t * 0.6))];
      } else {
        c = floorColor(T, i, j, ground);
        if (
          (h.key === 'stairsDown' || h.key === 'stairsUp') &&
          Math.abs(i - cx) <= 5 &&
          Math.abs(j - cy) <= 5
        ) {
          const step = Math.floor((j - cy + 5) / 2);
          const f = h.key === 'stairsDown' ? step / 5.5 : (5 - step) / 5.5;
          c =
            Math.abs(i - cx) === 5
              ? rgb('#141210')
              : (j - cy + 5) % 2 === 0
                ? mix(rgb('#a39c8c'), BLACK, f * 0.7)
                : mix(rgb('#5e594f'), BLACK, f * 0.85);
        }
        if (
          h.key === 'fence' &&
          (j - cy === -2 || j - cy === 0 || (i % 5 === 0 && j - cy >= -4 && j - cy <= 1))
        )
          c = rgb(i % 5 === 0 ? '#4a3018' : '#7a5632');
        if (h.key === 'gate' && Math.abs(Math.abs(i - cx) - 5) <= 1 && j - cy >= -6 && j - cy <= 1)
          c = rgb(j - cy === -6 ? '#a19a83' : '#6e6858');
      }

      // South faces: an open pixel just below a solid block shows that block's front wall
      if (!SOLID.has(h.key) && h.key !== 'chasm') {
        for (let k = 1; k <= F + 2; k++) {
          const a = G(i, j - k);
          if (!a) break;
          if (!SOLID.has(a.key)) continue;
          if (isVoid(a)) break;
          if (k <= F) {
            if (a.key === 'building' && a.group) {
              const doorX = h.key === 'buildingEntrance' && h.group === a.group ? cx : null;
              c = facadeColor(a.group.def, i, k, doorX);
            } else c = faceColor(T, i, k);
          } else if (k === F + 1 || t < 0.5) c = mix(c, BLACK, 0.45); // contact shadow
          break;
        }
      }

      const o = (j * GW + i) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  }
  actx.putImageData(img, 0, 0);

  // Decorations that receive lighting; collect light sources
  const lights: Light[] = [];
  const emissive: Array<[string, number, number]> = [];
  const ordered = [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const h of ordered) {
    const center = artHexCenter(h.col, h.row);
    const cx = Math.round(center.x);
    const cy = Math.round(center.y);
    const rand = rng(hash2(h.col, h.row, 99));
    const spots = (n: number, md: number, margin: number) =>
      scatterInHex(cx, cy, R, n, md, margin, rand).map(p => [p.x, p.y, p.k] as const);

    if (h.key === 'rubble')
      for (const [x, y, k] of spots(4, 3, 2))
        drawRawSprite(actx, k < 0.5 ? 'rubble1' : 'rubble2', x, y);
    if (theme === 'town' && h.key === 'grass') {
      for (const [x, y, k] of spots(3, 3, 2))
        drawRawSprite(actx, k < 0.3 ? 'flower' : 'tuft', x, y);
      if (rand() < 0.14 && neighbors(h).every(n => !n || n.key === 'grass'))
        drawSprite(actx, sprite('tree', 3), cx, cy + 3);
    }
    if (T.void === 'overgrowth' && isVoid(h) && rand() < 0.7)
      for (const [x, y, k] of spots(2, 5, 3))
        drawSprite(actx, sprite('tree', k < 0.5 ? 3 : 4), x, y);

    if (T.torches && h.key === 'wall' && h.edge && hash2(h.col, h.row, 5) < 0.4) {
      const tx = cx;
      const ty = Math.round(center.y + R) + 3;
      if (G(tx, ty)?.walk && !lights.some(l => Math.hypot(l.x - tx, l.y - ty) < R * 4.5)) {
        lights.push({ x: tx, y: ty, r: R * 4.2, p: 1.1, tint: [1.15, 0.95, 0.7] });
        emissive.push(['torch', tx, ty]);
      }
    }
    if (
      T.glow &&
      h.walk &&
      neighbors(h).some(n => n?.key === 'wall') &&
      hash2(h.col, h.row, 6) < 0.16
    ) {
      const [spot] = spots(1, 0, 3);
      const x = spot ? spot[0] : cx;
      const y = spot ? spot[1] : cy;
      lights.push({ x, y, r: R * 2.4, p: 0.8, tint: [0.7, 1.1, 1.15] });
      emissive.push(['shroom', x, y]);
    }
    if (theme !== 'town' && (h.content === 'exit' || h.key === 'exit'))
      lights.push({ x: cx, y: cy, r: R * 2.2, p: 1.2, tint: [1.05, 1.02, 0.9] });
  }

  // Light map: ambient + point lights, quantised to 4 levels with ordered dithering
  if (T.ambient < 1) {
    const px = actx.getImageData(0, 0, GW, GH);
    const q = px.data;
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        if (unlit[j * GW + i]) continue;
        let L = T.ambient;
        let sum = 0;
        let tr = 0;
        let tg = 0;
        let tb = 0;
        for (const l of lights) {
          const f = Math.max(0, 1 - Math.hypot(i - l.x, j - l.y) / l.r);
          if (!f) continue;
          const c = l.p * f * f;
          L += c;
          sum += c;
          tr += c * l.tint[0];
          tg += c * l.tint[1];
          tb += c * l.tint[2];
        }
        const level = Math.min(3, Math.floor(clamp01(L) * 3 + bayer(i, j))) / 3;
        const b = 0.2 + 0.8 * level;
        const w = sum ? Math.min(1, sum / L) * 0.6 : 0;
        const o = (j * GW + i) * 4;
        q[o] *= b * (1 - w + w * (sum ? tr / sum : 1));
        q[o + 1] *= b * (1 - w + w * (sum ? tg / sum : 1));
        q[o + 2] *= b * (1 - w + w * (sum ? tb / sum : 1));
      }
    }
    actx.putImageData(px, 0, 0);
  }
  for (const [name, x, y] of emissive) drawRawSprite(actx, name, x, y);

  return { canvas, scaleFor: hexSize => hexSize / R };
}
