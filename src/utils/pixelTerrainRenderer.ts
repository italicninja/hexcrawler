/**
 * 16-bit pixel-art overworld terrain (style C from texture-previews/).
 *
 * Each hex is rendered once, at art resolution (1 canvas px = 1 art px), into two
 * cached canvases: `ground` (clipped to the hex) and `sprites` (trees, peaks... that
 * overhang neighbours). Callers draw every ground tile before any sprite tile.
 * The art grid is world-aligned and noise is sampled in world space, so texture,
 * coastlines and river channels run continuously across hex edges.
 */

import { calculateHexPosition, pixelToOffset } from './hexRenderer';
import { getHexNeighbors } from './hexMath';

/** CSS pixels per art pixel. The preview used 3 at radius 40; 2 keeps a similar art-pixel count per hex at radius 30. */
export const ART_PX = 2;
const SQ3 = Math.sqrt(3);
const PAD = 12; // art px of room around the hex for sprite overhang

type RGB = [number, number, number];
type Seg = [number, number, number, number];

export interface PixelTile {
  ground: HTMLCanvasElement;
  sprites: HTMLCanvasElement;
  /** World-space top-left where the tiles are drawn, at ART_PX scale. */
  x: number;
  y: number;
}

interface TerrainHex {
  col: number;
  row: number;
  terrain: { key: string };
}

// ── Noise (deterministic, world-space) ──────────────────────────────────────
function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct: number, s: number): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f, s + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}
function rng(seed: number): () => number {
  // mulberry32
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const rgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// ── Palettes & sprites ──────────────────────────────────────────────────────
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const PAL: Record<string, string[]> = {
  grassland: ['#3f6b2f', '#4f8337', '#62993f', '#7cae4e'],
  forest: ['#1f3b22', '#2c5230', '#3b6a3a', '#4f8446'],
  hills: ['#566a32', '#6d803b', '#879449', '#a2a45d'],
  mountains: ['#4a4744', '#625e59', '#7d7870', '#9d978c'],
  water: ['#27507a', '#2f6090', '#3b74a6', '#4f8cbd'],
  desert: ['#b58d58', '#caa56b', '#dcbc82', '#ead29c'],
  swamp: ['#3a4a2c', '#4b5d34', '#5d6f3c', '#72824a'],
  tundra: ['#9fb0bf', '#bccad6', '#d7e1e9', '#eef3f7'],
  pool: ['#1f3432', '#27433e', '#34574d', '#4a735f'],
  river: ['#2f6090', '#3b74a6', '#5a9ccb', '#8cc3e3'],
};
PAL.river_ground = PAL.grassland;

const SPR_PAL: Record<string, Record<string, string>> = {
  tree: { o: '#122012', d: '#23411f', m: '#2f5a2a', l: '#437a36', h: '#62a047', t: '#4a3421' },
  pine: { o: '#0f1d15', d: '#1b3524', m: '#27482f', l: '#36613c', h: '#4c7d4b', t: '#3f2c1c' },
  snowpine: { o: '#1a2a2a', d: '#2a4638', m: '#365a45', l: '#dfe8ee', h: '#ffffff', t: '#3f2c1c' },
  mountain: { o: '#2a2724', d: '#4a4640', m: '#6b665e', l: '#8e887d', h: '#aaa396', s: '#f2f5f7', b: '#b3c2d2' },
  hill: { o: '#3f4a22', d: '#5b6b30', m: '#728339', l: '#8e9a4b', h: '#aab260' },
  rock: { o: '#2e2f33', d: '#5a5c63', m: '#7d8088', l: '#a4a7ad' },
};

interface Sprite {
  px: Array<[number, number, string]>; // (0,0) = bottom-centre anchor
  pal: Record<string, string>;
}
const spriteCache = new Map<string, Sprite>();
function sprite(kind: string, size: number): Sprite {
  const key = kind + size;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const px: Sprite['px'] = [];
  const lvl = (lit: number, x: number, y: number) => {
    const t = lit + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.35;
    return t > 0.5 ? 'h' : t > 0.1 ? 'l' : t > -0.35 ? 'm' : 'd';
  };
  if (kind === 'tree') {
    const R = size, cy = -R - 2, cells = new Set<string>();
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (x * x + y * y <= R * R + R * 0.6) cells.add(x + ',' + y);
    for (const s of cells) {
      const [x, y] = s.split(',').map(Number);
      const edge = ![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => cells.has(x + a + ',' + (y + b)));
      px.push([x, cy + y, edge ? 'o' : lvl(-(x * 0.6 + y * 0.8) / R, x, y)]);
    }
    px.push([0, -1, 't'], [0, 0, 't'], [-1, 0, 'o'], [1, 0, 'o']);
  } else if (kind === 'pine' || kind === 'snowpine') {
    const Hh = size;
    for (let y = 0; y < Hh; y++) {
      const tier = Math.floor(y / 3), within = y % 3, hw = Math.round(tier * 0.7 + within * 0.8);
      for (let x = -hw; x <= hw; x++) {
        const edge = Math.abs(x) === hw || (within === 2 && Math.abs(x) >= hw - 1);
        px.push([x, -Hh - 1 + y, edge ? 'o' : x < 0 ? (y % 3 === 0 ? 'h' : 'l') : x === 0 ? 'm' : 'd']);
      }
    }
    px.push([0, -1, 't'], [0, 0, 't']);
  } else if (kind === 'mountain') {
    const Hh = size, snowRows = Math.floor(Hh * 0.35);
    for (let y = 0; y < Hh; y++) {
      const hw = Math.round(y * 1.05), ridge = Math.round(y * 0.3);
      for (let x = -hw; x <= hw; x++) {
        let c;
        if (Math.abs(x) === hw || y === 0) c = 'o';
        else if (y < snowRows + ((x * 7 + y) % 3 === 0 ? 1 : 0)) c = x <= ridge ? 's' : 'b';
        else c = x < ridge - 1 ? lvl(0.6 - (y / Hh) * 0.5, x, y) : x <= ridge ? 'm' : 'd';
        px.push([x, -Hh + y + 1, c]);
      }
    }
  } else if (kind === 'hill') {
    const W = size * 2, Hh = size;
    for (let x = -W; x <= W; x++) {
      const top = Math.round(Hh * Math.sqrt(Math.max(0, 1 - (x / (W + 0.5)) ** 2)));
      for (let y = 0; y < top; y++) px.push([x, -y, y === top - 1 ? 'o' : lvl((-x / W) * 0.7 + (y / Hh) * 0.4, x, y)]);
    }
  } else if (kind === 'rock') {
    px.push([-1, -2, 'o'], [0, -2, 'o'], [-2, -1, 'o'], [-1, -1, 'l'], [0, -1, 'm'], [1, -1, 'o'], [-2, 0, 'o'], [-1, 0, 'm'], [0, 0, 'd'], [1, 0, 'o']);
  }
  const out = { px, pal: SPR_PAL[kind] ?? SPR_PAL.tree };
  spriteCache.set(key, out);
  return out;
}

// Tiny hand-placed sprites: rows top->bottom, anchored bottom-centre.
const RAW: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  tuft: { rows: ['h.h', 'lhl'], pal: { h: '#8fc25c', l: '#4a7f33' } },
  glint: { rows: ['hh..', '..hh'], pal: { h: '#a8d4ee' } },
  cactus: { rows: ['..o..', '.olo.', 'oolo.', 'olmoo', 'oomlo', '.omo.', '.omo.'], pal: { o: '#1f3a1c', l: '#78a651', m: '#4f7d3a' } },
  reed: { rows: ['r', 'r', 'm', 'm', 'm'], pal: { r: '#6b4424', m: '#6f8a3c' } },
  flower: { rows: ['y'], pal: { y: '#f0e07a' } },
  stone: { rows: ['ll', 'dd'], pal: { l: '#c6b48d', d: '#8d7a55' } },
};
function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, ax: number, ay: number): void {
  for (const [x, y, ch] of s.px) {
    ctx.fillStyle = s.pal[ch];
    ctx.fillRect(ax + x, ay + y, 1, 1);
  }
}
function drawRaw(ctx: CanvasRenderingContext2D, name: string, ax: number, ay: number): void {
  const { rows, pal } = RAW[name], w = rows[0].length;
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (!pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(ax + i - (w >> 1), ay - rows.length + 1 + j, 1, 1);
    })
  );
}

/** Deterministic, roughly even points inside a hex (rejection sampling), sorted top to bottom. */
function scatterInHex(cx: number, cy: number, r: number, n: number, minDist: number, margin: number, rand: () => number) {
  const pts: Array<{ x: number; y: number; k: number }> = [];
  for (let tries = 0; pts.length < n && tries < n * 40; tries++) {
    const x = cx + (rand() * 2 - 1) * r * SQ3 / 2, y = cy + (rand() * 2 - 1) * r;
    const dx = Math.abs(x - cx), dy = Math.abs(y - cy), rr = r - margin;
    if (dx > rr * SQ3 / 2 || dy > rr - dx / SQ3) continue;
    if (pts.some(p => Math.hypot(p.x - x, p.y - y) < minDist)) continue;
    pts.push({ x, y, k: rand() });
  }
  return pts.sort((a, b) => a.y - b.y).map(p => [Math.round(p.x), Math.round(p.y), p.k] as const);
}

function segDist(px: number, py: number, [ax, ay, bx, by]: Seg): number {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

// ── Renderer ────────────────────────────────────────────────────────────────
export class PixelTerrainRenderer {
  private terrain = new Map<string, string>();
  private tiles = new Map<string, PixelTile>();
  private segs = new Map<string, Seg[]>();

  constructor(hexes: readonly TerrainHex[], private hexSize: number) {
    for (const h of hexes) this.terrain.set(`${h.col},${h.row}`, h.terrain.key);
  }

  getTile(col: number, row: number): PixelTile {
    const key = `${col},${row}`;
    let tile = this.tiles.get(key);
    if (!tile) {
      tile = this.render(col, row);
      this.tiles.set(key, tile);
    }
    return tile;
  }

  private keyAt(col: number, row: number): string | undefined {
    return this.terrain.get(`${col},${row}`);
  }

  /** River channel: hex centre -> shared edge midpoint of every river/water neighbour (world space). */
  private riverSegs(col: number, row: number): Seg[] {
    const key = `${col},${row}`;
    const cached = this.segs.get(key);
    if (cached) return cached;
    const out: Seg[] = [];
    if (this.keyAt(col, row) === 'river') {
      const r = this.hexSize, { x, y } = calculateHexPosition(col, row, r);
      for (const n of getHexNeighbors(col, row)) {
        const k = this.keyAt(n.col, n.row);
        if (k !== 'river' && k !== 'water') continue;
        const p = calculateHexPosition(n.col, n.row, r);
        out.push([x, y, (x + p.x) / 2, (y + p.y) / 2]);
      }
      // Isolated / dead-end river hex: run the channel straight across.
      if (out.length === 0) out.push([x, y, x - r * SQ3 / 2, y], [x, y, x + r * SQ3 / 2, y]);
      else if (out.length === 1) out.push([x, y, 2 * x - out[0][2], 2 * y - out[0][3]]);
    }
    this.segs.set(key, out);
    return out;
  }

  private render(col: number, row: number): PixelTile {
    const r = this.hexSize, lr = r / ART_PX;
    const { x: hx, y: hy } = calculateHexPosition(col, row, r);
    const i0 = Math.floor((hx - r) / ART_PX) - PAD, j0 = Math.floor((hy - r) / ART_PX) - PAD;
    const W = Math.ceil((2 * r) / ART_PX) + 2 * PAD, H = W;

    // Which hex owns art pixel (i, j) in world art coords, memoised for this tile.
    const owner = new Map<number, string | undefined>();
    const own = (i: number, j: number) => {
      const id = (i - i0 + 2) * 4096 + (j - j0 + 2);
      if (!owner.has(id)) {
        const o = pixelToOffset((i + 0.5) * ART_PX, (j + 0.5) * ART_PX, r);
        owner.set(id, `${o.col},${o.row}`);
      }
      return owner.get(id);
    };
    const self = `${col},${row}`;
    const tkey = this.keyAt(col, row) ?? 'grassland';
    const isWater = (id: string | undefined) => id !== undefined && this.terrain.get(id) === 'water';
    const exists = (id: string | undefined) => id !== undefined && this.terrain.has(id);

    const segs = [this.riverSegs(col, row), ...getHexNeighbors(col, row).map(n => this.riverSegs(n.col, n.row))].flat();
    const riverR = r * 0.11;
    const wobbleRiver = (x: number, y: number) => {
      const u = x / r, v = y / r;
      // Displacement gradient must stay well under 1 or the distance field folds (smeared banks).
      const wx = x + (vnoise(u * 1.8, v * 1.8, 7) - 0.5) * r * 0.16;
      const wy = y + (vnoise(u * 1.8 + 9, v * 1.8, 8) - 0.5) * r * 0.16;
      return segs.reduce((m, s) => Math.min(m, segDist(wx, wy, s)), Infinity);
    };

    const ground = document.createElement('canvas');
    ground.width = W;
    ground.height = H;
    const gctx = ground.getContext('2d')!;
    const img = gctx.createImageData(W, H), d = img.data;
    const basePal = PAL[tkey === 'river' ? 'river_ground' : tkey] ?? PAL.grassland;

    for (let jj = 0; jj < H; jj++) for (let ii = 0; ii < W; ii++) {
      const i = i0 + ii, j = j0 + jj;
      if (own(i, j) !== self) continue;
      const cx = (i + 0.5) * ART_PX, cy = (j + 0.5) * ART_PX, u = cx / r, v = cy / r;
      const thr = BAYER[j & 3][i & 3] / 16;
      let pal = basePal;
      let val = clamp01((fbm(u * 1.2, v * 1.2, 3, 7) - 0.28) / 0.44);
      if (tkey === 'desert') val = clamp01(val * 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(u * 6 + v * 2 + fbm(u, v, 2, 8) * 4)));
      if (tkey === 'water') val = clamp01(val * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(v * 7 + fbm(u * 2, v * 2, 2, 9) * 3)));
      if (tkey === 'swamp' && fbm(u * 2.4, v * 2.4, 4, 71) < 0.44) pal = PAL.pool;
      const idx = 1 + Math.min(2, Math.floor(val * 2 + thr));
      let col3 = rgb(pal[idx]);
      // Hex border: one step darker
      if (own(i + 1, j) !== self || own(i, j + 1) !== self) col3 = rgb(pal[idx - 1]);
      // Coast: foam on the water side, sand / dark lip on the land side
      const n4 = [own(i + 1, j), own(i - 1, j), own(i, j + 1), own(i, j - 1)];
      if (tkey === 'water') {
        if (n4.some(n => exists(n) && !isWater(n))) col3 = rgb('#d6ecf4');
        else if ([own(i + 2, j), own(i - 2, j), own(i, j + 2), own(i, j - 2)].some(n => exists(n) && !isWater(n))) col3 = rgb(PAL.water[3]);
      } else if (n4.some(isWater)) {
        col3 = ['grassland', 'hills', 'desert', 'river'].includes(tkey) ? rgb(thr > 0.5 ? '#d8c38a' : '#c4ad74') : rgb(pal[0]);
      }
      if (segs.length) {
        const rd = wobbleRiver(cx, cy);
        if (rd < riverR) {
          const t = rd / riverR;
          col3 = rgb(PAL.river[t < 0.45 ? 1 : t < 0.85 ? 2 : 3]);
        } else if (rd < riverR + ART_PX * 1.2) col3 = rgb('#34521f');
      }
      const o = (jj * W + ii) * 4;
      d[o] = col3[0];
      d[o + 1] = col3[1];
      d[o + 2] = col3[2];
      d[o + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);

    // Sprites, in tile-local art coords
    const sprites = document.createElement('canvas');
    sprites.width = W;
    sprites.height = H;
    const ctx = sprites.getContext('2d')!;
    const rand = rng(hash2(col, row, 99));
    const cx = Math.round(hx / ART_PX) - i0, cy = Math.round(hy / ART_PX) - j0;
    const spots = (n: number, md: number, margin: number) => scatterInHex(cx, cy, lr, n, md, margin, rand);
    switch (tkey) {
      case 'grassland':
        for (const [x, y, k] of spots(6, 3, 2)) drawRaw(ctx, k < 0.25 ? 'flower' : 'tuft', x, y);
        if (rand() < 0.4) for (const [x, y] of spots(1, 0, 5)) drawSprite(ctx, sprite('tree', 3), x, y);
        break;
      case 'forest':
        for (const [x, y, k] of spots(8, 4.2, 2.5)) drawSprite(ctx, k < 0.3 ? sprite('pine', 8) : sprite('tree', k < 0.65 ? 3 : 4), x, y);
        break;
      case 'hills':
        for (const [x, y, k] of spots(2, 7, 4)) drawSprite(ctx, sprite('hill', k < 0.5 ? 3 : 4), x, y);
        for (const [x, y] of spots(2, 3, 2)) drawRaw(ctx, 'tuft', x, y);
        break;
      case 'mountains': {
        const side = rand() < 0.5 ? -1 : 1;
        drawSprite(ctx, sprite('mountain', 6), cx + side * 4, cy);
        drawSprite(ctx, sprite('mountain', 9), cx - side, cy + 5);
        drawSprite(ctx, sprite('rock', 0), cx + side * 6, cy + 6);
        break;
      }
      case 'water':
        for (const [x, y] of spots(2, 5, 4)) drawRaw(ctx, 'glint', x, y);
        break;
      case 'desert':
        for (const [x, y, k] of spots(3, 4, 3)) drawRaw(ctx, k < 0.4 ? 'cactus' : 'stone', x, y);
        break;
      case 'swamp':
        for (const [x, y] of spots(7, 2.5, 2)) drawRaw(ctx, 'reed', x, y);
        break;
      case 'tundra':
        for (const [x, y, k] of spots(3, 5, 3)) drawSprite(ctx, k < 0.6 ? sprite('snowpine', 7) : sprite('rock', 0), x, y);
        break;
      default:
    }

    return { ground, sprites, x: i0 * ART_PX, y: j0 * ART_PX };
  }
}
