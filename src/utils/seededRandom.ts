/**
 * All randomness in the game goes through here. Two kinds:
 *
 * - Seeded (world gen, interiors, combat terrain): `createSeededRNG(seed)` — same seed,
 *   same stream, so a world seed can be shared. String → cyrb128 (128-bit hash, so
 *   near-identical seeds like "x-1-10"/"x-10-1" land far apart) → sfc32 (128-bit state).
 * - Gameplay (dice, combat, AI, loot, shops, rest): `random()` — one sfc32 stream seeded
 *   from crypto.getRandomValues at startup, so reloading a save never replays a roll.
 *
 * Always returns [0, 1).
 */

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  const next = () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Discard the first outputs so weak/similar seed words are fully mixed.
  for (let i = 0; i < 12; i++) next();
  return next;
}

/** String → unsigned 32-bit hash. */
export function hashSeed(seed: string): number {
  return cyrb128(seed)[0];
}

/** Numeric seeds ("12345") keep their value; any other text ("dragon") is hashed. */
export function seedToNumber(seed: string | number): number {
  const s = String(seed).trim();
  return /^-?\d+$/.test(s) ? parseInt(s, 10) : hashSeed(s);
}

export function createSeededRNG(seed: string): () => number {
  const [a, b, c, d] = cyrb128(seed);
  return sfc32(a, b, c, d);
}

/**
 * Stateless (seed, n) → [0, 1). For counter-based streams whose whole state must
 * serialize as one number (WeatherSystem's seedCounter) or index-addressed draws.
 */
export function hashToUnit(seed: number, n: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const entropy = new Uint32Array(4);
globalThis.crypto.getRandomValues(entropy);

/** Unseeded gameplay randomness (OS entropy seed). Use instead of Math.random(). */
export const random: () => number = sfc32(entropy[0], entropy[1], entropy[2], entropy[3]);

/** Fresh 32-bit seed for things that are seeded but should differ every time (NPCs, new worlds). */
export const randomSeed = (): number => Math.floor(random() * 4294967296);
