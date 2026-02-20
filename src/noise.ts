/**
 * Perlin Noise implementation for procedural terrain generation
 * Based on Ken Perlin's improved noise (2002)
 */

export class PerlinNoise {
  seed: number;
  perm: number[];

  constructor(seed: number = 0) {
    this.seed = seed;
    this.perm = this.buildPermutationTable();
  }

  setSeed(seed: number): void {
    this.seed = seed;
    this.perm = this.buildPermutationTable();
  }

  // Build permutation table from seed
  buildPermutationTable(): number[] {
    const p: number[] = [];

    // Create ordered array
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle using seeded random
    for (let i = 255; i > 0; i--) {
      const n = Math.floor(this.seededRandom(i) * (i + 1));
      const q = p[i];
      p[i] = p[n];
      p[n] = q;
    }

    // Duplicate for overflow
    const perm = new Array<number>(512);
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
    }

    return perm;
  }

  // Seeded random number generator
  seededRandom(i: number): number {
    const x = Math.sin(this.seed + i * 0.9123) * 10000;
    return x - Math.floor(x);
  }

  // Fade function for smooth interpolation
  fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  // Linear interpolation
  lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  // Gradient function
  grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return (h & 1 ? -u : u) + (h & 2 ? -2.0 * v : 2.0 * v);
  }

  // 2D Perlin noise
  noise2D(x: number, y: number): number {
    // Find unit grid cell containing point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Get relative coordinates within cell
    x -= Math.floor(x);
    y -= Math.floor(y);

    // Compute fade curves
    const u = this.fade(x);
    const v = this.fade(y);

    // Hash coordinates of the 4 corners
    const A = this.perm[X] + Y;
    const B = this.perm[X + 1] + Y;

    // Blend results from 4 corners
    return this.lerp(
      v,
      this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
      this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
    );
  }

  // Octave noise (multiple frequencies layered)
  octaveNoise2D(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

/**
 * Simple noise generator (original implementation)
 * Kept for backward compatibility
 */
export class SimpleNoise {
  seed: number;

  constructor(seed: number = 0) {
    this.seed = seed;
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  noise2D(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed * 0.001) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }
}
