import { describe, it, expect } from 'vitest';
import {
  getExhaustionEffects,
  consumeRations,
  consumeWater,
  applyStarvation,
  reduceExhaustion,
  getActiveExhaustionPenalties,
} from '../../src/game/SurvivalManager';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCharacter(overrides: Record<string, unknown> = {}) {
  return {
    rations: 7,
    daysWithoutFood: 0,
    exhaustionLevel: 0,
    abilities: { constitution: 10 },
    proficiencyBonus: 2,
    // getModifier: standard D&D formula for constitution
    getModifier: (ability: string) => {
      const score =
        (overrides.abilities as Record<string, number>)?.[ability] ??
        { constitution: 10 }[ability] ??
        10;
      return Math.floor((score - 10) / 2);
    },
    ...overrides,
  };
}

// ─── getExhaustionEffects ────────────────────────────────────────────────────

describe('getExhaustionEffects()', () => {
  it('level 0 — no exhaustion, empty penalties', () => {
    const effect = getExhaustionEffects(0);
    expect(effect.description).toMatch(/no exhaustion/i);
    expect(effect.penalties).toHaveLength(0);
  });

  it('level 1 — disadvantage on ability checks', () => {
    const effect = getExhaustionEffects(1);
    expect(effect.penalties).toContain('disadvantage_checks');
    expect(effect.penalties).toHaveLength(1);
  });

  it('level 2 — speed halved + disadvantage on checks', () => {
    const effect = getExhaustionEffects(2);
    expect(effect.penalties).toContain('disadvantage_checks');
    expect(effect.penalties).toContain('speed_halved');
  });

  it('level 3 — adds disadvantage on attacks and saves', () => {
    const effect = getExhaustionEffects(3);
    expect(effect.penalties).toContain('disadvantage_attacks_saves');
  });

  it('level 4 — HP max halved', () => {
    const effect = getExhaustionEffects(4);
    expect(effect.penalties).toContain('hp_max_halved');
  });

  it('level 5 — speed reduced to 0', () => {
    const effect = getExhaustionEffects(5);
    expect(effect.penalties).toContain('speed_zero');
  });

  it('level 6 — death', () => {
    const effect = getExhaustionEffects(6);
    expect(effect.penalties).toContain('death');
    expect(effect.description).toMatch(/death/i);
  });

  it('penalties are cumulative — level N includes all previous penalties', () => {
    const penalties5 = getExhaustionEffects(5).penalties;
    expect(penalties5).toContain('disadvantage_checks');
    expect(penalties5).toContain('speed_halved');
    expect(penalties5).toContain('disadvantage_attacks_saves');
    expect(penalties5).toContain('hp_max_halved');
    expect(penalties5).toContain('speed_zero');
  });

  it('out-of-range level (e.g. 99) falls back gracefully', () => {
    const effect = getExhaustionEffects(99);
    expect(effect).toBeDefined();
    expect(Array.isArray(effect.penalties)).toBe(true);
  });

  it('returns effects for all levels 0-6 without throwing', () => {
    for (let level = 0; level <= 6; level++) {
      expect(() => getExhaustionEffects(level)).not.toThrow();
    }
  });
});

// ─── consumeRations ──────────────────────────────────────────────────────────

describe('consumeRations()', () => {
  it('returns failure for null character', () => {
    const result = consumeRations(null);
    expect(result.success).toBe(false);
  });

  it('decrements rations when available', () => {
    const char = makeCharacter({ rations: 3 });
    consumeRations(char);
    expect(char.rations).toBe(2);
  });

  it('returns success and remaining count', () => {
    const char = makeCharacter({ rations: 5 });
    const result = consumeRations(char);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('resets daysWithoutFood to 0 when eating', () => {
    const char = makeCharacter({ rations: 2, daysWithoutFood: 3 });
    consumeRations(char);
    expect(char.daysWithoutFood).toBe(0);
  });

  it('increments daysWithoutFood when no rations', () => {
    const char = makeCharacter({ rations: 0, daysWithoutFood: 1 });
    const result = consumeRations(char);
    expect(result.success).toBe(false);
    expect(char.daysWithoutFood).toBe(2);
    expect(result.daysWithout).toBe(2);
  });

  it('does not go below 0 rations', () => {
    const char = makeCharacter({ rations: 0 });
    consumeRations(char);
    consumeRations(char);
    expect(char.rations).toBe(0);
  });

  it('multiple consecutive days consumption', () => {
    const char = makeCharacter({ rations: 3 });
    consumeRations(char);
    consumeRations(char);
    consumeRations(char);
    expect(char.rations).toBe(0);
    const last = consumeRations(char);
    expect(last.success).toBe(false);
    expect(char.daysWithoutFood).toBe(1);
  });
});

// ─── consumeWater (deprecated) ───────────────────────────────────────────────

describe('consumeWater() — deprecated', () => {
  it('always returns success (water system removed)', () => {
    const char = makeCharacter();
    const result = consumeWater(char);
    expect(result.success).toBe(true);
  });
});

// ─── applyStarvation ─────────────────────────────────────────────────────────

describe('applyStarvation()', () => {
  it('returns zero exhaustion gained for null character', () => {
    const result = applyStarvation(null);
    expect(result.exhaustionGained).toBe(0);
  });

  it('does not apply exhaustion if daysWithoutFood < threshold', () => {
    // CON 10 (mod 0) → threshold = max(1, 3 + 0) = 3
    const char = makeCharacter({ daysWithoutFood: 2, exhaustionLevel: 0 });
    const result = applyStarvation(char);
    expect(result.exhaustionGained).toBe(0);
    expect(char.exhaustionLevel).toBe(0);
  });

  it('applies 1 exhaustion when days starving >= threshold', () => {
    // CON 10 (mod 0) → threshold = 3
    const char = makeCharacter({ daysWithoutFood: 3, exhaustionLevel: 0 });
    const result = applyStarvation(char);
    expect(result.exhaustionGained).toBe(1);
    expect(char.exhaustionLevel).toBe(1);
  });

  it('caps exhaustion at 6 (death)', () => {
    const char = makeCharacter({ daysWithoutFood: 99, exhaustionLevel: 5 });
    applyStarvation(char);
    expect(char.exhaustionLevel).toBe(6);
    // Calling again should not exceed 6
    applyStarvation(char);
    expect(char.exhaustionLevel).toBe(6);
  });

  it('high CON raises the starvation threshold', () => {
    // CON 20 (mod +5) → threshold = max(1, 3 + 5) = 8
    const char = makeCharacter({
      daysWithoutFood: 5,
      exhaustionLevel: 0,
      abilities: { constitution: 20 },
      getModifier: (_: string) => 5, // +5
    });
    const result = applyStarvation(char);
    expect(result.exhaustionGained).toBe(0);
  });

  it('returns a descriptive message', () => {
    const char = makeCharacter({ daysWithoutFood: 5, exhaustionLevel: 0 });
    const result = applyStarvation(char);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });
});

// ─── reduceExhaustion ────────────────────────────────────────────────────────

describe('reduceExhaustion()', () => {
  it('returns false when character is null', () => {
    const result = reduceExhaustion(null);
    expect(result.reduced).toBe(false);
  });

  it('reduces exhaustion by 1', () => {
    const char = makeCharacter({ exhaustionLevel: 3 });
    const result = reduceExhaustion(char);
    expect(result.reduced).toBe(true);
    expect(char.exhaustionLevel).toBe(2);
    expect(result.newLevel).toBe(2);
  });

  it('does not reduce below 0', () => {
    const char = makeCharacter({ exhaustionLevel: 0 });
    const result = reduceExhaustion(char);
    expect(result.reduced).toBe(false);
    expect(char.exhaustionLevel).toBe(0);
  });

  it('reducing from 6 to 5 removes death', () => {
    const char = makeCharacter({ exhaustionLevel: 6 });
    reduceExhaustion(char);
    expect(char.exhaustionLevel).toBe(5);
  });
});

// ─── getActiveExhaustionPenalties ────────────────────────────────────────────

describe('getActiveExhaustionPenalties()', () => {
  it('returns { level: 0, penalties: [], description } for null character', () => {
    const result = getActiveExhaustionPenalties(null);
    expect(result.level).toBe(0);
    expect(result.penalties).toHaveLength(0);
  });

  it('reflects the character current exhaustion level', () => {
    const char = makeCharacter({ exhaustionLevel: 3 });
    const result = getActiveExhaustionPenalties(char);
    expect(result.level).toBe(3);
    expect(result.penalties).toContain('disadvantage_attacks_saves');
  });

  it('returns all properties', () => {
    const char = makeCharacter({ exhaustionLevel: 2 });
    const result = getActiveExhaustionPenalties(char);
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('penalties');
    expect(result).toHaveProperty('description');
  });
});
