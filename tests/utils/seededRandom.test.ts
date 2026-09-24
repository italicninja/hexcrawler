import { describe, it, expect } from 'vitest';
import { createSeededRNG } from '../../src/utils/seededRandom';
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
});
