/**
 * 16-bit pixel-art terrain tiles for the overworld and the combat battlefield.
 *
 * Each hex is rendered once into a small art-resolution canvas (1 art pixel = 1 canvas
 * pixel) and cached; drawHex() blits it scaled by hexSize / ART_HEX_RADIUS with
 * smoothing off. Tiles sit on one global art-pixel grid, so neighbours tessellate
 * exactly. A tile depends on its neighbours' terrain (coast foam, borders, river
 * channels), so the neighbour keys are part of the cache key.
 */

import logger from '../logger';
import { getHexNeighbors } from '../hexMath';
import {
  ART_HEX_RADIUS,
  artHexCenter,
  artPixelHex,
  bayer,
  clamp01,
  drawRawSprite,
  drawSprite,
  fbm,
  hash2,
  pal,
  rgb,
  rng,
  scatterInHex,
  sprite,
  vnoise,
  worley,
  type RGB,
} from './core';

/** Returns the terrain key at (col, row), or undefined if there is no hex there. */
export type TerrainLookup = (col: number, row: number) => string | undefined;

export interface DrawHexOptions {
  /** Big decorations (trees, peaks, hills, cacti). Off for the combat grid. Default true. */
  decor?: boolean;
  /** Fallback base colour for terrain keys this renderer doesn't know. */
  color?: string;
}

const R = ART_HEX_RADIUS;
const TOP_MARGIN = 8; // art pixels above the hex for sprites that poke upward
const SIDE_MARGIN = 3;
const MAX_CACHED_TILES = 6000; // ponytail: clear-all when full; LRU if long sessions thrash it

type Pattern = 'field' | 'dunes' | 'waves' | 'flag' | 'rock' | 'ruin';

/** 4-tone ramps, dark -> light. */
const PALETTES: Record<string, RGB[]> = {
  grassland: pal(['#3f6b2f', '#4f8337', '#62993f', '#7cae4e']),
  forest: pal(['#1f3b22', '#2c5230', '#3b6a3a', '#4f8446']),
  hills: pal(['#566a32', '#6d803b', '#879449', '#a2a45d']),
  mountains: pal(['#4a4744', '#625e59', '#7d7870', '#9d978c']),
  water: pal(['#27507a', '#2f6090', '#3b74a6', '#4f8cbd']),
  desert: pal(['#b58d58', '#caa56b', '#dcbc82', '#ead29c']),
  swamp: pal(['#3a4a2c', '#4b5d34', '#5d6f3c', '#72824a']),
  tundra: pal(['#9fb0bf', '#bccad6', '#d7e1e9', '#eef3f7']),
  pool: pal(['#1f3432', '#27433e', '#34574d', '#4a735f']),
  river: pal(['#2f6090', '#3b74a6', '#5a9ccb', '#8cc3e3']),
  stone: pal(['#2c2a27', '#57524a', '#655f55', '#736c60']),
  cave: pal(['#3a3026', '#54473a', '#615242', '#6f5e4b']),
  ruin: pal(['#5e5a4a', '#7a7461', '#8d8671', '#a19a83']),
};

interface TerrainStyle {
  pal: RGB[];
  pattern: Pattern;
}

/** Overworld keys plus the POI / alias keys the combat battlefield uses. */
const STYLES: Record<string, TerrainStyle> = {
  grassland: { pal: PALETTES.grassland, pattern: 'field' },
  forest: { pal: PALETTES.forest, pattern: 'field' },
  hills: { pal: PALETTES.hills, pattern: 'field' },
  mountains: { pal: PALETTES.mountains, pattern: 'field' },
  water: { pal: PALETTES.water, pattern: 'waves' },
  river: { pal: PALETTES.grassland, pattern: 'field' },
  desert: { pal: PALETTES.desert, pattern: 'dunes' },
  swamp: { pal: PALETTES.swamp, pattern: 'field' },
  tundra: { pal: PALETTES.tundra, pattern: 'field' },
  dungeon: { pal: PALETTES.stone, pattern: 'flag' },
  temple: { pal: PALETTES.stone, pattern: 'flag' },
  tower: { pal: PALETTES.stone, pattern: 'flag' },
  shrine: { pal: PALETTES.stone, pattern: 'flag' },
  cave: { pal: PALETTES.cave, pattern: 'rock' },
  lair: { pal: PALETTES.cave, pattern: 'rock' },
  ruins: { pal: PALETTES.ruin, pattern: 'ruin' },
};
STYLES.plains = STYLES.grassland;
STYLES.mountain = STYLES.mountains;
STYLES.village = STYLES.grassland;
STYLES.town = STYLES.grassland;
STYLES.camp = STYLES.grassland;

const SAND_LIP = ['grassland', 'hills', 'desert', 'river', 'plains'];

function styleFor(key: string, color?: string): TerrainStyle {
  const known = STYLES[key];
  if (known) return known;
  // Unknown key: derive a ramp from its base colour so it still gets the dithered look.
  const base = rgb(color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#6b8e23');
  return { pal: [0.62, 0.82, 1, 1.15].map(k => base.map(c => c * k) as RGB), pattern: 'field' };
}

/** Stone slab pattern: returns a palette index, 0 = mortar. */
function flagIdx(i: number, j: number, s: number, w = 8, h = 5): { idx: number; k: number } {
  const row = Math.floor(j / h);
  const off = (row & 1) * (w >> 1);
  const x = (((i + off) % w) + w) % w;
  const y = ((j % h) + h) % h;
  if (x === 0 || y === 0) return { idx: 0, k: -1 };
  const k = hash2(Math.floor((i + off) / w), row, s);
  let idx = 1 + Math.floor(k * 2.4);
  if (y === 1 && idx < 3) idx++;
  return { idx: Math.min(3, idx), k };
}

function segDist(px: number, py: number, s: [number, number, number, number]): number {
  const [ax, ay, bx, by] = s;
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

interface Tile {
  canvas: HTMLCanvasElement;
  i0: number;
  j0: number;
}

export class PixelTerrainRenderer {
  private cache = new Map<string, Tile | null>();
  private seedX: number;
  private seedY: number;

  constructor(seed = 0) {
    // Shift the noise field per world seed so two worlds don't share ground texture.
    this.seedX = (Math.abs(seed) % 997) * 7.31;
    this.seedY = (Math.abs(seed) % 991) * 5.17;
  }

  /**
   * Draw one hex tile centred at world (x, y). Returns false if the tile couldn't be
   * rendered (no 2D canvas, e.g. jsdom) so the caller can fall back to a flat fill.
   */
  drawHex(
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    key: string,
    x: number,
    y: number,
    hexSize: number,
    lookup: TerrainLookup,
    opts: DrawHexOptions = {}
  ): boolean {
    const decor = opts.decor !== false;
    const nKeys = getHexNeighbors(col, row).map(n => lookup(n.col, n.row) ?? '-');
    const cacheKey = `${col},${row},${key},${nKeys.join('|')},${decor ? 1 : 0}`;
    let tile = this.cache.get(cacheKey);
    if (tile === undefined) {
      if (this.cache.size >= MAX_CACHED_TILES) this.cache.clear();
      tile = this.renderTile(col, row, key, lookup, decor, opts.color);
      this.cache.set(cacheKey, tile);
    }
    if (!tile) return false;
    const s = hexSize / R;
    const c = artHexCenter(col, row);
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      tile.canvas,
      x + (tile.i0 - c.x) * s,
      y + (tile.j0 - c.y) * s,
      tile.canvas.width * s,
      tile.canvas.height * s
    );
    ctx.imageSmoothingEnabled = prev;
    return true;
  }

  clearCache(): void {
    this.cache.clear();
    logger.render.debug('Pixel terrain cache cleared');
  }

  private renderTile(
    col: number,
    row: number,
    key: string,
    lookup: TerrainLookup,
    decor: boolean,
    color?: string
  ): Tile | null {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const c = artHexCenter(col, row);
    const i0 = Math.floor(c.x - (R * Math.sqrt(3)) / 2) - SIDE_MARGIN;
    const i1 = Math.ceil(c.x + (R * Math.sqrt(3)) / 2) + SIDE_MARGIN;
    const j0 = Math.floor(c.y - R) - TOP_MARGIN;
    const j1 = Math.ceil(c.y + R) + 1;
    const W = i1 - i0 + 1;
    const H = j1 - j0 + 1;
    canvas.width = W;
    canvas.height = H;

    const keyAtPixel = (i: number, j: number): { same: boolean; key: string | undefined } => {
      const h = artPixelHex(i, j);
      const same = h.col === col && h.row === row;
      return { same, key: same ? key : lookup(h.col, h.row) };
    };
    const isWater = (k: string | undefined) => k === 'water';
    const style = styleFor(key, color);
    const selfWater = isWater(key);

    // River channel: centre -> shared edge midpoint of every river/water neighbour
    const segs: Array<[number, number, number, number]> = [];
    if (key === 'river') {
      for (const n of getHexNeighbors(col, row)) {
        const nk = lookup(n.col, n.row);
        if (nk === 'river' || nk === 'water') {
          const nc = artHexCenter(n.col, n.row);
          segs.push([c.x, c.y, (c.x + nc.x) / 2, (c.y + nc.y) / 2]);
        }
      }
      const half = (R * Math.sqrt(3)) / 2;
      if (segs.length === 0) segs.push([c.x, c.y, c.x - half, c.y], [c.x, c.y, c.x + half, c.y]);
      else if (segs.length === 1) segs.push([c.x, c.y, 2 * c.x - segs[0][2], 2 * c.y - segs[0][3]]);
    }

    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (!keyAtPixel(i, j).same) continue;
        const u = (i + 0.5) / R + this.seedX;
        const v = (j + 0.5) / R + this.seedY;
        const t = bayer(i, j);
        let p = style.pal;
        let val = clamp01((fbm(u * 1.2, v * 1.2, 3, 7) - 0.28) / 0.44);
        let idx: number;
        if (style.pattern === 'flag') {
          idx = flagIdx(i, j, 11).idx;
        } else if (style.pattern === 'ruin') {
          const f = flagIdx(i, j, 12);
          if ((f.k >= 0 && f.k < 0.16) || (f.idx === 0 && hash2(i, j, 13) > 0.45)) {
            p = PALETTES.grassland;
            idx = 1 + Math.min(2, Math.floor(val * 2 + t));
          } else idx = f.idx;
        } else if (style.pattern === 'rock') {
          const w = worley(u * 1.25, v * 1.25, 21);
          if (w.f2 - w.f1 < 0.06) idx = 0;
          else if (hash2(i, j, 23) > 0.985) idx = 3;
          else
            idx =
              1 + Math.min(2, Math.floor(w.id * 1.6 + (w.f1 < 0.35 ? 0.5 : 0) + (t - 0.5) * 0.4));
        } else {
          if (style.pattern === 'dunes')
            val = clamp01(
              val * 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(u * 6 + v * 2 + fbm(u, v, 2, 8) * 4))
            );
          if (style.pattern === 'waves')
            val = clamp01(
              val * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(v * 7 + fbm(u * 2, v * 2, 2, 9) * 3))
            );
          if (key === 'swamp' && fbm(u * 2.4, v * 2.4, 4, 71) < 0.44) p = PALETTES.pool;
          idx = 1 + Math.min(2, Math.floor(val * 2 + t));
        }
        let col3 = p[idx];

        // Hex border: one tone darker along the right/bottom edge
        if (!keyAtPixel(i + 1, j).same || !keyAtPixel(i, j + 1).same)
          col3 = p[Math.max(0, idx - 1)];

        // Coast: foam on the water side, sand or a dark lip on the land side
        const n4 = [
          keyAtPixel(i + 1, j),
          keyAtPixel(i - 1, j),
          keyAtPixel(i, j + 1),
          keyAtPixel(i, j - 1),
        ];
        if (selfWater) {
          if (n4.some(n => n.key !== undefined && !isWater(n.key))) col3 = rgb('#d6ecf4');
          else if (
            [
              keyAtPixel(i + 2, j),
              keyAtPixel(i - 2, j),
              keyAtPixel(i, j + 2),
              keyAtPixel(i, j - 2),
            ].some(n => n.key !== undefined && !isWater(n.key))
          )
            col3 = PALETTES.water[3];
        } else if (n4.some(n => isWater(n.key))) {
          col3 = SAND_LIP.includes(key) ? rgb(t > 0.5 ? '#d8c38a' : '#c4ad74') : p[0];
        }

        if (segs.length) {
          const wob = 0.16 * R;
          const rx = i + 0.5 + (vnoise(u * 1.8, v * 1.8, 7) - 0.5) * wob;
          const ry = j + 0.5 + (vnoise(u * 1.8 + 9, v * 1.8, 8) - 0.5) * wob;
          const rd = Math.min(...segs.map(sg => segDist(rx, ry, sg)));
          const w = 1.4;
          if (rd < w) {
            const q = rd / w;
            col3 = PALETTES.river[q < 0.45 ? 1 : q < 0.85 ? 2 : 3];
          } else if (rd < w + 1.2) col3 = rgb('#34521f');
        }

        const o = ((j - j0) * W + (i - i0)) * 4;
        d[o] = col3[0];
        d[o + 1] = col3[1];
        d[o + 2] = col3[2];
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    this.drawDecor(ctx, col, row, key, decor, c.x - i0, c.y - j0);
    return { canvas, i0, j0 };
  }

  /** Sprites for one hex, in tile-local art coordinates (cx, cy = hex centre). */
  private drawDecor(
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    key: string,
    decor: boolean,
    cx: number,
    cy: number
  ): void {
    const rand = rng(hash2(col, row, 99));
    const spots = (n: number, md: number, margin: number) =>
      scatterInHex(cx, cy, R, n, md, margin, rand).map(p => [p.x, p.y, p.k] as const);
    switch (key) {
      case 'grassland':
      case 'plains':
      case 'village':
      case 'town':
      case 'camp':
        for (const [x, y, k] of spots(6, 3, 2))
          drawRawSprite(ctx, k < 0.25 ? 'flower' : 'tuft', x, y);
        if (decor && rand() < 0.4)
          for (const [x, y] of spots(1, 0, 5)) drawSprite(ctx, sprite('tree', 3), x, y);
        break;
      case 'forest':
        if (!decor) {
          for (const [x, y] of spots(4, 3, 2)) drawRawSprite(ctx, 'tuft', x, y);
          break;
        }
        for (const [x, y, k] of spots(8, 4.2, 2.5))
          drawSprite(ctx, k < 0.3 ? sprite('pine', 8) : sprite('tree', k < 0.65 ? 3 : 4), x, y);
        break;
      case 'hills':
        if (decor)
          for (const [x, y, k] of spots(2, 7, 4))
            drawSprite(ctx, sprite('hill', k < 0.5 ? 3 : 4), x, y);
        for (const [x, y] of spots(2, 3, 2)) drawRawSprite(ctx, 'tuft', x, y);
        break;
      case 'mountains':
      case 'mountain': {
        if (!decor) {
          for (const [x, y] of spots(3, 4, 2)) drawSprite(ctx, sprite('rock', 0), x, y);
          break;
        }
        const side = rand() < 0.5 ? -1 : 1;
        drawSprite(ctx, sprite('mountain', 6), Math.round(cx + side * 4), Math.round(cy));
        drawSprite(ctx, sprite('mountain', 9), Math.round(cx - side), Math.round(cy + 5));
        drawSprite(ctx, sprite('rock', 0), Math.round(cx + side * 6), Math.round(cy + 6));
        break;
      }
      case 'water':
        for (const [x, y] of spots(2, 5, 4)) drawRawSprite(ctx, 'glint', x, y);
        break;
      case 'desert':
        for (const [x, y, k] of spots(3, 4, 3))
          drawRawSprite(ctx, decor && k < 0.4 ? 'cactus' : 'stone', x, y);
        break;
      case 'swamp':
        for (const [x, y] of spots(7, 2.5, 2)) drawRawSprite(ctx, 'reed', x, y);
        break;
      case 'tundra':
        for (const [x, y, k] of spots(3, 5, 3))
          drawSprite(ctx, decor && k < 0.6 ? sprite('snowpine', 7) : sprite('rock', 0), x, y);
        break;
      case 'cave':
      case 'lair':
      case 'ruins':
        for (const [x, y] of spots(2, 4, 3)) drawRawSprite(ctx, 'pebble', x, y);
        break;
      default:
    }
  }
}
