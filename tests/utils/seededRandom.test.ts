import { describe, it, expect } from 'vitest';
import { createSeededRNG, hashToUnit, random } from '../../src/utils/seededRandom';
import { DiceRoller } from '../../src/game/DiceRoller';

describe('createSeededRNG', () => {
  it('stays in [0, 1) for seeds whose hash is negative', () => {
    // These seeds made the old LCG return negative values
    for (const seed of ['abc-hazard-3-4', 'poi-12,7-1790256348675', '-1', 'x'.repeat(40)]) {
      const rng = createSeededRNG(seed);
      for (let i = 0; i < 1000; i++) {
        const r = rng();
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(1);
      }
    }
  });

  it('is deterministic per seed', () => {
    const a = createSeededRNG('same');
    const b = createSeededRNG('same');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('seeded d20 rolls are always 1-20', () => {
    const dice = new DiceRoller('abc-hazard-3-4');
    for (let i = 0; i < 500; i++) {
      const r = dice.rollD20();
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
    }
  });

  it('near-identical seeds give unrelated streams', () => {
    const a = createSeededRNG('x-hazard-1-10');
    const b = createSeededRNG('x-hazard-10-1');
    const diffs = Array.from({ length: 100 }, () => Math.abs(a() - b()));
    // Unrelated uniforms differ by ~1/3 on average; correlated streams sit near 0
    expect(diffs.reduce((s, d) => s + d, 0) / diffs.length).toBeGreaterThan(0.25);
  });

  it('gameplay d20 and hashToUnit are uniform across all faces', () => {
    for (const next of [
      random,
      (() => {
        let n = 0;
        return () => hashToUnit(42, n++);
      })(),
    ]) {
      const counts = new Array(20).fill(0);
      const N = 200_000;
      for (let i = 0; i < N; i++) counts[Math.floor(next() * 20)]++;
      const expected = N / 20;
      const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
      expect(chi2).toBeLessThan(50); // 19 dof: p ≈ 0.0001
    }
  });
});
