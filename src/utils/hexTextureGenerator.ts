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
 * Hex Texture Generator
 *
 * Generates procedural canvas patterns for terrain types.
 * Uses noise functions and geometric patterns to create organic textures.
 */
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

  drawGrasslandPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const noise = this.noise.noise2D((x / size) * 2, (y / size) * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.02 * Math.abs(noise)})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }

    ctx.strokeStyle = 'rgba(100, 150, 100, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 0.5, 0) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(0, seedOffset + i * 0.5) * 0.5 + 0.5) * size;
      const height = 2 + (this.noise.noise2D(seedOffset + i, i) * 0.5 + 0.5) * 2;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - height);
      ctx.stroke();
    }
  }

  drawForestPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 10; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 1.2, 0) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(0, seedOffset + i * 1.2) * 0.5 + 0.5) * size;
      const radius = 3 + (this.noise.noise2D(seedOffset + i, i) * 0.5 + 0.5) * 3;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(0, 50, 0, 0.4)';
    for (let i = 0; i < 8; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 2, 10) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(10, seedOffset + i * 2) * 0.5 + 0.5) * size;
      const treeSize = 3;

      ctx.beginPath();
      ctx.moveTo(x, y - treeSize);
      ctx.lineTo(x - treeSize, y + treeSize);
      ctx.lineTo(x + treeSize, y + treeSize);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawMountainsPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < 12; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 1.5, 5) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(5, seedOffset + i * 1.5) * 0.5 + 0.5) * size;
      const rockSize = 2 + (this.noise.noise2D(seedOffset + i, i + 5) * 0.5 + 0.5) * 4;

      ctx.beginPath();
      ctx.moveTo(x, y - rockSize);
      ctx.lineTo(x + rockSize, y);
      ctx.lineTo(x, y + rockSize);
      ctx.lineTo(x - rockSize, y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
  }

  drawHillsPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const offset = i * (size / 6);
      const amplitude = 3 + (this.noise.noise2D(seedOffset + i, 0) * 0.5 + 0.5) * 3;

      ctx.beginPath();
      for (let x = 0; x <= size; x += 2) {
        const noise = this.noise.noise2D((x / size) * 3 + seedOffset + i, i);
        const y = offset + noise * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(100, 140, 80, 0.2)';
    for (let i = 0; i < 8; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 2, 20) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(20, seedOffset + i * 2) * 0.5 + 0.5) * size;
      const radius = 2 + (this.noise.noise2D(seedOffset + i, i + 20) * 0.5 + 0.5) * 2;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWaterPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const offset = i * (size / 8);
      const amplitude = 2;
      const frequency = 4;

      ctx.beginPath();
      for (let x = 0; x <= size; x += 1) {
        const y = offset + Math.sin((x / size) * Math.PI * frequency + i) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 0, 50, 0.1)';
    for (let i = 0; i < 6; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 3, 30) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(30, seedOffset + i * 3) * 0.5 + 0.5) * size;
      const radius = 4 + (this.noise.noise2D(seedOffset + i, i + 30) * 0.5 + 0.5) * 4;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRiverPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const offset = i * (size / 6);
      const amplitude = 3;
      const frequency = 3;

      ctx.beginPath();
      for (let x = 0; x <= size; x += 1) {
        const y = offset + Math.sin((x / size) * Math.PI * frequency + i * 0.5) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < 10; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 2.5, 40) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(40, seedOffset + i * 2.5) * 0.5 + 0.5) * size;
      const radius = 1 + (this.noise.noise2D(seedOffset + i, i + 40) * 0.5 + 0.5) * 1.5;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawDesertPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(210, 180, 140, 0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const offset = i * (size / 5);
      const amplitude = 4;
      const frequency = 2;

      ctx.beginPath();
      for (let x = 0; x <= size; x += 2) {
        const y = offset + Math.sin((x / size) * Math.PI * frequency + i * 0.8) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(200, 160, 120, 0.2)';
    for (let i = 0; i < 40; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 0.8, 50) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(50, seedOffset + i * 0.8) * 0.5 + 0.5) * size;

      ctx.fillRect(x, y, 1, 1);
    }
  }

  drawSwampPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < 12; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 1.8, 60) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(60, seedOffset + i * 1.8) * 0.5 + 0.5) * size;
      const radius = 3 + (this.noise.noise2D(seedOffset + i, i + 60) * 0.5 + 0.5) * 4;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(60, 80, 50, 0.4)';
    for (let i = 0; i < 15; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 2.2, 65) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(65, seedOffset + i * 2.2) * 0.5 + 0.5) * size;
      const radius = 1 + (this.noise.noise2D(seedOffset + i, i + 65) * 0.5 + 0.5) * 1.5;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(80, 100, 60, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 2.8, 70) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(70, seedOffset + i * 2.8) * 0.5 + 0.5) * size;
      const height = 3 + (this.noise.noise2D(seedOffset + i, i + 70) * 0.5 + 0.5) * 4;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - height);
      ctx.stroke();
    }
  }

  drawTundraPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 8; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 2, 80) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(80, seedOffset + i * 2) * 0.5 + 0.5) * size;
      const radius = 4 + (this.noise.noise2D(seedOffset + i, i + 80) * 0.5 + 0.5) * 5;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(200, 220, 240, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 1.5, 85) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(85, seedOffset + i * 1.5) * 0.5 + 0.5) * size;
      const crystalSize = 2;

      ctx.beginPath();
      ctx.moveTo(x - crystalSize, y);
      ctx.lineTo(x + crystalSize, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y - crystalSize);
      ctx.lineTo(x, y + crystalSize);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(100, 120, 140, 0.2)';
    for (let i = 0; i < 6; i++) {
      const x = (this.noise.noise2D(seedOffset + i * 3, 90) * 0.5 + 0.5) * size;
      const y = (this.noise.noise2D(90, seedOffset + i * 3) * 0.5 + 0.5) * size;

      ctx.fillRect(x, y, 1, 2);
    }
  }

  drawDefaultPattern(ctx: CanvasRenderingContext2D, size: number, baseColor: string, _seedOffset = 0): void {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
  }

  clearCache(): void {
    this.patternCache.clear();
    logger.render.debug('Pattern cache cleared');
  }
}
