/**
 * Pixel-art primitives shared by the terrain tile renderer and the interior renderer.
 *
 * Everything is computed in "art space": a hex of radius ART_HEX_RADIUS art pixels,
 * laid out with the same calculateHexPosition as the game. Callers scale the result
 * by hexSize / ART_HEX_RADIUS with image smoothing off, so the art stays crisp and
 * the look is identical at every hex size.
 */

import { calculateHexPosition, pixelToOffset } from '../hexRenderer';

export const ART_HEX_RADIUS = 10;
export const SQ3 = Math.sqrt(3);

// ── Deterministic noise (world/art-space) ──────────────────────────────────

export function hash2(x: number, y: number, s = 0): number {
  let h =
    (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in 0..1. */
export function vnoise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, oct = 4, s = 0): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f, s + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Cellular noise: distance to nearest (f1) / second-nearest (f2) feature point + cell id. */
export function worley(x: number, y: number, s = 0): { f1: number; f2: number; id: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const d = Math.hypot(cx + hash2(cx, cy, s) - x, cy + hash2(cx, cy, s + 1) - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash2(cx, cy, s + 2);
      } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id };
}

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Seeded PRNG (mulberry32) from a 0..1 seed. */
export function rng(seed: number): () => number {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Ordered dithering ──────────────────────────────────────────────────────

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
/** 4x4 Bayer threshold in 0..1 for an art pixel. */
export const bayer = (i: number, j: number): number => BAYER[j & 3][i & 3] / 16;

// ── Colour ─────────────────────────────────────────────────────────────────

export type RGB = [number, number, number];
export function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const pal = (hexes: string[]): RGB[] => hexes.map(rgb);
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export const BLACK: RGB = [0, 0, 0];

// ── Hex geometry in art space ──────────────────────────────────────────────

export function artHexCenter(col: number, row: number): { x: number; y: number } {
  return calculateHexPosition(col, row, ART_HEX_RADIUS);
}

/** Offset coords of the hex containing art pixel (i, j) (sampled at the pixel centre). */
export function artPixelHex(i: number, j: number): { col: number; row: number } {
  return pixelToOffset(i + 0.5, j + 0.5, ART_HEX_RADIUS);
}

export interface ScatterPoint {
  x: number;
  y: number;
  k: number;
}

/** Deterministic, roughly even points inside a hex (rejection sampling), sorted top to bottom. */
export function scatterInHex(
  cx: number,
  cy: number,
  r: number,
  n: number,
  minDist: number,
  margin: number,
  rand: () => number
): ScatterPoint[] {
  const pts: ScatterPoint[] = [];
  const rr = r - margin;
  for (let tries = 0; pts.length < n && tries < n * 40; tries++) {
    const x = cx + ((rand() * 2 - 1) * (r * SQ3)) / 2;
    const y = cy + (rand() * 2 - 1) * r;
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    if (dx > (rr * SQ3) / 2 || dy > rr - dx / SQ3) continue;
    if (pts.some(p => Math.hypot(p.x - x, p.y - y) < minDist)) continue;
    pts.push({ x: Math.round(x), y: Math.round(y), k: rand() });
  }
  return pts.sort((a, b) => a.y - b.y);
}

// ── Sprites ────────────────────────────────────────────────────────────────

/** A pixel sprite: [x, y, paletteChar] cells anchored at the bottom centre. */
export interface Sprite {
  px: Array<[number, number, string]>;
  pal: Record<string, string>;
}

const SPRITE_PALETTES: Record<string, Record<string, string>> = {
  tree: { o: '#122012', d: '#23411f', m: '#2f5a2a', l: '#437a36', h: '#62a047', t: '#4a3421' },
  pine: { o: '#0f1d15', d: '#1b3524', m: '#27482f', l: '#36613c', h: '#4c7d4b', t: '#3f2c1c' },
  snowpine: { o: '#1a2a2a', d: '#2a4638', m: '#365a45', l: '#dfe8ee', h: '#ffffff', t: '#3f2c1c' },
  mountain: {
    o: '#2a2724',
    d: '#4a4640',
    m: '#6b665e',
    l: '#8e887d',
    h: '#aaa396',
    s: '#f2f5f7',
    b: '#b3c2d2',
  },
  hill: { o: '#3f4a22', d: '#5b6b30', m: '#728339', l: '#8e9a4b', h: '#aab260' },
  rock: { o: '#2e2f33', d: '#5a5c63', m: '#7d8088', l: '#a4a7ad' },
};

const spriteCache = new Map<string, Sprite>();

/** Procedurally lit sprites: 'tree' | 'pine' | 'snowpine' | 'mountain' | 'hill' | 'rock'. */
export function sprite(kind: string, size: number): Sprite {
  const key = kind + size;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const px: Sprite['px'] = [];
  const lvl = (lit: number, x: number, y: number): string => {
    const t = lit + (bayer(x, y) - 0.5) * 0.35;
    return t > 0.5 ? 'h' : t > 0.1 ? 'l' : t > -0.35 ? 'm' : 'd';
  };
  if (kind === 'tree') {
    const R = size;
    const cy = -R - 2;
    const cells = new Set<string>();
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) if (x * x + y * y <= R * R + R * 0.6) cells.add(x + ',' + y);
    for (const s of cells) {
      const [x, y] = s.split(',').map(Number);
      const edge = ![
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].every(([a, b]) => cells.has(x + a + ',' + (y + b)));
      px.push([x, cy + y, edge ? 'o' : lvl(-(x * 0.6 + y * 0.8) / R, x, y)]);
    }
    px.push([0, -1, 't'], [0, 0, 't'], [-1, 0, 'o'], [1, 0, 'o']);
  } else if (kind === 'pine' || kind === 'snowpine') {
    for (let y = 0; y < size; y++) {
      const tier = Math.floor(y / 3);
      const within = y % 3;
      const hw = Math.round(tier * 0.7 + within * 0.8);
      for (let x = -hw; x <= hw; x++) {
        const edge = Math.abs(x) === hw || (within === 2 && Math.abs(x) >= hw - 1);
        px.push([
          x,
          -size - 1 + y,
          edge ? 'o' : x < 0 ? (y % 3 === 0 ? 'h' : 'l') : x === 0 ? 'm' : 'd',
        ]);
      }
    }
    px.push([0, -1, 't'], [0, 0, 't']);
  } else if (kind === 'mountain') {
    const snowRows = Math.floor(size * 0.35);
    for (let y = 0; y < size; y++) {
      const hw = Math.round(y * 1.05);
      const ridge = Math.round(y * 0.3);
      for (let x = -hw; x <= hw; x++) {
        let c: string;
        if (Math.abs(x) === hw || y === 0) c = 'o';
        else if (y < snowRows + ((x * 7 + y) % 3 === 0 ? 1 : 0)) c = x <= ridge ? 's' : 'b';
        else c = x < ridge - 1 ? lvl(0.6 - (y / size) * 0.5, x, y) : x <= ridge ? 'm' : 'd';
        px.push([x, -size + y + 1, c]);
      }
    }
  } else if (kind === 'hill') {
    const W = size * 2;
    for (let x = -W; x <= W; x++) {
      const top = Math.round(size * Math.sqrt(Math.max(0, 1 - (x / (W + 0.5)) ** 2)));
      for (let y = 0; y < top; y++) {
        px.push([x, -y, y === top - 1 ? 'o' : lvl((-x / W) * 0.7 + (y / size) * 0.4, x, y)]);
      }
    }
  } else {
    // rock
    px.push(
      [-1, -2, 'o'],
      [0, -2, 'o'],
      [-2, -1, 'o'],
      [-1, -1, 'l'],
      [0, -1, 'm'],
      [1, -1, 'o'],
      [-2, 0, 'o'],
      [-1, 0, 'm'],
      [0, 0, 'd'],
      [1, 0, 'o']
    );
  }
  const out: Sprite = { px, pal: SPRITE_PALETTES[kind] ?? SPRITE_PALETTES.rock };
  spriteCache.set(key, out);
  return out;
}

/** Tiny hand-placed sprites: rows top to bottom, anchored at the bottom centre. */
export const RAW_SPRITES: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  tuft: { rows: ['h.h', 'lhl'], pal: { h: '#8fc25c', l: '#4a7f33' } },
  glint: { rows: ['hh..', '..hh'], pal: { h: '#a8d4ee' } },
  cactus: {
    rows: ['..o..', '.olo.', 'oolo.', 'olmoo', 'oomlo', '.omo.', '.omo.'],
    pal: { o: '#1f3a1c', l: '#78a651', m: '#4f7d3a' },
  },
  reed: { rows: ['r', 'r', 'm', 'm', 'm'], pal: { r: '#6b4424', m: '#6f8a3c' } },
  flower: { rows: ['y'], pal: { y: '#f0e07a' } },
  stone: { rows: ['ll', 'dd'], pal: { l: '#c6b48d', d: '#8d7a55' } },
  pebble: { rows: ['lm'], pal: { l: '#8d8a82', m: '#5a5852' } },
  torch: {
    rows: ['.y.', 'fyf', '.f.', '.b.', '.b.'],
    pal: { y: '#fff3a8', f: '#ff9a2e', b: '#5a3a1e' },
  },
  shroom: { rows: ['.c.', 'ccc', '.s.'], pal: { c: '#7fe8e0', s: '#c8c0a8' } },
  rubble1: {
    rows: ['.oo.', 'olmo', 'ommd'],
    pal: { o: '#2a2926', l: '#8d8a82', m: '#6a675f', d: '#4a4843' },
  },
  rubble2: { rows: ['oo', 'lm'], pal: { o: '#2a2926', l: '#8d8a82', m: '#5a5852' } },
};

/** Draw a sprite onto an art-resolution context (1 art pixel = 1 canvas pixel). */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, ax: number, ay: number): void {
  for (const [x, y, ch] of s.px) {
    const c = s.pal[ch];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(ax + x, ay + y, 1, 1);
  }
}

export function drawRawSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  ax: number,
  ay: number
): void {
  const spr = RAW_SPRITES[name];
  if (!spr) return;
  spr.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = spr.pal[row[i]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ax + i - (row.length >> 1), ay - spr.rows.length + 1 + j, 1, 1);
    }
  });
}
