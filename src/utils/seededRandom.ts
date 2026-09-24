/**
 * Seeded PRNG shared by dice, interior generation, combat terrain and world gen.
 * String seed → unsigned 32-bit hash → mulberry32. Always returns [0, 1).
 */
export function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Numeric seeds ("12345") keep their value; any other text ("dragon") is hashed. */
export function seedToNumber(seed: string | number): number {
  const s = String(seed).trim();
  return /^-?\d+$/.test(s) ? parseInt(s, 10) : hashSeed(s);
}

export function createSeededRNG(seed: string): () => number {
  let h = hashSeed(seed);

  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
