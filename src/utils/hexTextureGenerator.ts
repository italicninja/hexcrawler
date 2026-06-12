import logger from './logger';

interface NoiseLike {
  noise2D(x: number, y: number): number;
}

interface TextureTerrain {
  key: string;
  color: string;
  [key: string]: unknown;
}

/**
 * Hex Texture Generator — Old School RuneScape inspired.
 *
 * Generates procedural canvas patterns for terrain types in the 2007-era
 * RuneScape style: muted earthy palettes, chunky 3px-texel dithering between
 * 2-3 hand-picked tones (instead of smooth gradients), and sparse pixel-art
 * decorations (grass tufts, wave glyphs, rock facets, dune ripples).
 *
 * Determinism: decoration placement uses a sin-hash of (texel, seedOffset),
 * blotch shapes use the injected noise function — same seed, same texture.
 */

/** [dark, base, light] tone ramps per terrain key — OSRS world-map palette. */
const TERRAIN_TONES: Record<string, [string, string, string]> = {
  grassland: ['#4c6b35', '#56793f', '#618748'],
  forest: ['#33492a', '#3d5930', '#466637'],
  hills: ['#5f6140', '#6e7045', '#7c7e4e'],
  mountains: ['#5b574e', '#6b675e', '#7b766b'],
  water: ['#3f5a79', '#4a698c', '#577a9e'],
  river: ['#4d6c8e', '#5a7da3', '#6b8fb5'],
  desert: ['#b9a276', '#c9b385', '#d6c294'],
  swamp: ['#40492e', '#4c5a36', '#56653e'],
  tundra: ['#b4bbc0', '#c7cdd1', '#d5dadd'],
};

export class HexTextureGenerator {
  noise: NoiseLike;
  patternCache: Map<string, CanvasPattern | null>;

  constructor(noise: NoiseLike) {
    this.noise = noise;
    this.patternCache = new Map();
    logger.render.debug('HexTextureGenerator initialized');
  }

  getPattern(
    ctx: CanvasRenderingContext2D,
    terrainType: TextureTerrain,
    hexSize: number,
    col = 0,
    row = 0
  ): CanvasPattern | null | undefined {
    const key = `${terrainType.key}_${hexSize}_${col}_${row}`;

    if (!this.patternCache.has(key)) {
      const seedOffset = col * 7919 + row * 6871;
      const pattern = this.createPattern(ctx, terrainType, hexSize, seedOffset);
      this.patternCache.set(key, pattern);
    }

    return this.patternCache.get(key);
  }

  createPattern(
    ctx: CanvasRenderingContext2D,
    terrainType: TextureTerrain,
    hexSize: number,
    seedOffset = 0
  ): CanvasPattern | null {
    const patternCanvas = document.createElement('canvas');
    const patternSize = Math.max(32, hexSize);
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;
    const pctx = patternCanvas.getContext('2d');
    if (!pctx) return null;
    pctx.imageSmoothingEnabled = false;

    switch (terrainType.key) {
      case 'grassland':
        this.drawGrasslandPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      case 'forest':
        this.drawForestPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      case 'mountains':
        this.drawMountainsPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      case 'hills':
        this.drawHillsPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      case 'water':
        this.drawWaterPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      case 'river':
        this.drawRiverPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      case 'desert':
        this.drawDesertPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      case 'swamp':
        this.drawSwampPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      case 'tundra':
        this.drawTundraPattern(pctx, patternSize, terrainType.color, seedOffset);
        break;
      default:
        this.drawDefaultPattern(pctx, patternSize, terrainType.color, seedOffset);
    }

    return ctx.createPattern(patternCanvas, 'repeat');
  }

  // ─── Shared helpers ────────────────────────────────────────────────────────

  /** Deterministic 0..1 hash of an integer texel coordinate + seed. */
  private hash(x: number, y: number, seed: number): number {
    const h = Math.sin(x * 127.1 + y * 311.7 + seed * 0.137) * 43758.5453;
    return h - Math.floor(h);
  }

  /** Resolve the tone ramp for a terrain key, deriving one from the base color
   *  for unknown keys so custom terrains still get the dithered treatment. */
  private tones(key: string, baseColor: string): [string, string, string] {
    return TERRAIN_TONES[key] ?? [this.shade(baseColor, 0.85), baseColor, this.shade(baseColor, 1.12)];
  }

  /** Multiply a #rrggbb color's channels by a factor. */
  private shade(hex: string, factor: number): string {
    const n = parseInt(hex.replace('#', ''), 16);
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((n >> 16) & 0xff) * factor);
    const g = clamp(((n >> 8) & 0xff) * factor);
    const b = clamp((n & 0xff) * factor);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  /**
   * The OSRS ground base: chunky texel dithering between three tones.
   * Blotch shape comes from low-frequency noise; per-texel grain from the
   * hash, so the result reads as hand-placed pixels rather than a gradient.
   */
  private ditherBase(
    ctx: CanvasRenderingContext2D,
    size: number,
    tones: [string, string, string],
    seedOffset: number,
    texel = 3,
    bandPhase = 0 // >0 adds horizontal banding (water)
  ): void {
    ctx.fillStyle = tones[1];
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += texel) {
      for (let x = 0; x < size; x += texel) {
        const tx = x / texel;
        const ty = y / texel;
        const blotch =
          this.noise.noise2D((tx + (seedOffset % 977)) * 0.45, (ty + (seedOffset % 769)) * 0.45) *
            0.5 +
          0.5;
        const grain = this.hash(tx, ty, seedOffset);
        let v = blotch * 0.65 + grain * 0.35;
        if (bandPhase > 0) {
          // Horizontal shimmer bands for water surfaces
          v += Math.sin(ty * bandPhase + seedOffset * 0.01) * 0.12;
        }

        if (v < 0.38) {
          ctx.fillStyle = tones[0];
          ctx.fillRect(x, y, texel, texel);
        } else if (v > 0.72) {
          ctx.fillStyle = tones[2];
          ctx.fillRect(x, y, texel, texel);
        }
        // middle band keeps the base fill
      }
    }
  }

  /** Place n deterministic points inside the tile (with a small margin). */
  private scatter(size: number, n: number, seedOffset: number, salt: number): Array<{ x: number; y: number; r: number }> {
    const pts: Array<{ x: number; y: number; r: number }> = [];
    for (let i = 0; i < n; i++) {
      pts.push({
        x: 2 + this.hash(i * 3 + 1, salt, seedOffset) * (size - 4),
        y: 2 + this.hash(salt, i * 5 + 2, seedOffset) * (size - 4),
        r: this.hash(i * 7 + 3, i + salt, seedOffset),
      });
    }
    return pts;
  }

  // ─── Terrain patterns ──────────────────────────────────────────────────────

  drawGrasslandPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('grassland', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset);

    // Grass tufts: little 3-blade fans, dark green
    ctx.strokeStyle = '#3c5529';
    ctx.lineWidth = 1;
    for (const p of this.scatter(size, 7, seedOffset, 11)) {
      const h = 2 + p.r * 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 1, p.y - h);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - h - 1);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 1, p.y - h);
      ctx.stroke();
    }

    // The occasional OSRS roadside flower (yellow pixel pair)
    for (const p of this.scatter(size, 2, seedOffset, 23)) {
      if (p.r < 0.55) continue;
      ctx.fillStyle = '#d8c84a';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      ctx.fillStyle = '#8a7430';
      ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 2, 1, 1);
    }
  }

  drawForestPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('forest', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset);

    // Low-poly canopy blobs: shadow disc, faceted crown, lit facet, dark rim
    for (const p of this.scatter(size, 5, seedOffset, 31)) {
      const r = 3 + p.r * 3;

      ctx.fillStyle = 'rgba(16, 26, 12, 0.45)'; // ground shadow
      ctx.beginPath();
      ctx.ellipse(p.x + 1, p.y + 1.5, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Faceted crown (chunky hexagon, not a smooth circle)
      ctx.fillStyle = '#2e4423';
      ctx.strokeStyle = '#1d2d16';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + p.r * 2;
        const px = p.x + Math.cos(a) * r;
        const py = p.y + Math.sin(a) * r * 0.85;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lit facet, top-left
      ctx.fillStyle = '#46663a';
      ctx.beginPath();
      ctx.moveTo(p.x - r * 0.5, p.y - r * 0.2);
      ctx.lineTo(p.x - r * 0.05, p.y - r * 0.75);
      ctx.lineTo(p.x + r * 0.35, p.y - r * 0.3);
      ctx.lineTo(p.x - r * 0.1, p.y + r * 0.05);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawMountainsPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('mountains', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset);

    // Faceted crags: lit face + shadow face + hard outline
    for (const p of this.scatter(size, 4, seedOffset, 41)) {
      const s = 3 + p.r * 4;
      const peakX = p.x;
      const peakY = p.y - s;

      ctx.fillStyle = '#7d786c'; // lit (left) face
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(p.x - s, p.y + s * 0.6);
      ctx.lineTo(p.x, p.y + s * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#504c44'; // shadow (right) face
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(p.x, p.y + s * 0.4);
      ctx.lineTo(p.x + s, p.y + s * 0.6);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#36332d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y + s * 0.6);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(p.x + s, p.y + s * 0.6);
      ctx.stroke();
    }

    // Scree pixels
    ctx.fillStyle = '#4b4840';
    for (const p of this.scatter(size, 6, seedOffset, 47)) {
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
    }
  }

  drawHillsPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('hills', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset);

    // Chunky stepped contour ridges (dirt showing through the grass)
    ctx.strokeStyle = '#57523a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const baseY = this.hash(i * 13 + 1, 3, seedOffset) * size;
      const w = size * (0.35 + this.hash(i, 9, seedOffset) * 0.3);
      const cx = this.hash(7, i * 11 + 2, seedOffset) * size;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, baseY);
      ctx.lineTo(cx - w / 6, baseY - 3);
      ctx.lineTo(cx + w / 6, baseY - 3);
      ctx.lineTo(cx + w / 2, baseY);
      ctx.stroke();
    }

    // Grass tufts, sparser than grassland
    ctx.strokeStyle = '#4c5a32';
    ctx.lineWidth = 1;
    for (const p of this.scatter(size, 4, seedOffset, 53)) {
      const h = 2 + p.r * 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 1, p.y - h);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 1, p.y - h);
      ctx.stroke();
    }
  }

  drawWaterPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('water', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset, 3, 0.9);

    // Sparse pale wave glyphs — the classic little ~ marks
    ctx.strokeStyle = '#9fb6cd';
    ctx.lineWidth = 1;
    for (const p of this.scatter(size, 3, seedOffset, 61)) {
      const w = 3 + p.r * 3;
      ctx.beginPath();
      ctx.moveTo(p.x - w, p.y);
      ctx.lineTo(p.x - w / 3, p.y - 1.5);
      ctx.lineTo(p.x + w / 3, p.y);
      ctx.lineTo(p.x + w, p.y - 1.5);
      ctx.stroke();
    }
  }

  drawRiverPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('river', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset, 3, 1.1);

    // More frequent, brighter glyphs than open water (moving current)
    ctx.strokeStyle = '#b6cade';
    ctx.lineWidth = 1;
    for (const p of this.scatter(size, 5, seedOffset, 67)) {
      const w = 2.5 + p.r * 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - w, p.y);
      ctx.lineTo(p.x - w / 3, p.y - 1.5);
      ctx.lineTo(p.x + w / 3, p.y);
      ctx.lineTo(p.x + w, p.y - 1.5);
      ctx.stroke();
    }
  }

  drawDesertPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('desert', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset, 3);

    // Dune ripple curves in darker sand
    ctx.strokeStyle = '#a8946b';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y0 = this.hash(i * 17 + 5, 7, seedOffset) * size;
      const cx = this.hash(3, i * 19 + 1, seedOffset) * size;
      const w = size * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx - w, y0 + 2);
      ctx.quadraticCurveTo(cx, y0 - 2, cx + w, y0 + 2);
      ctx.stroke();
    }

    // Dark pebble speckles
    ctx.fillStyle = '#94815c';
    for (const p of this.scatter(size, 5, seedOffset, 71)) {
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }

  drawSwampPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('swamp', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset);

    // Murky pools: irregular dark blobs with a hard rim
    for (const p of this.scatter(size, 3, seedOffset, 79)) {
      const r = 2.5 + p.r * 3;
      ctx.fillStyle = '#333d26';
      ctx.strokeStyle = '#262e1c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.65, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Sickly green sheen pixel
      ctx.fillStyle = '#5e7040';
      ctx.fillRect(Math.round(p.x - r * 0.3), Math.round(p.y - r * 0.2), 2, 1);
    }

    // Reeds with seed heads
    for (const p of this.scatter(size, 4, seedOffset, 83)) {
      const h = 3 + p.r * 3;
      ctx.strokeStyle = '#5a6638';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - h);
      ctx.stroke();
      ctx.fillStyle = '#6e5a34';
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y - h) - 1, 2, 2);
    }
  }

  drawTundraPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    const tones = this.tones('tundra', baseColor);
    this.ditherBase(ctx, size, tones, seedOffset);

    // Snow drifts: pale lumps with a soft-but-hard-edged rim
    for (const p of this.scatter(size, 3, seedOffset, 89)) {
      const r = 3 + p.r * 4;
      ctx.fillStyle = '#e6eaec';
      ctx.strokeStyle = '#aeb6bb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Exposed rock pixels poking through the snow
    ctx.fillStyle = '#8a8e92';
    for (const p of this.scatter(size, 4, seedOffset, 97)) {
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
    }
  }

  drawDefaultPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    this.ditherBase(ctx, size, this.tones('__default__', baseColor), seedOffset);
  }

  clearCache(): void {
    this.patternCache.clear();
    logger.render.debug('Pattern cache cleared');
  }
}
