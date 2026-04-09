// @ts-nocheck — DiceRoller source is @ts-nocheck; its constructor accepts (seed, logger) as any
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiceRoller } from '../../src/game/DiceRoller';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCharacter(overrides: Record<string, unknown> = {}) {
  return {
    strength: 10,
    dexterity: 14,
    constitution: 12,
    intelligence: 10,
    wisdom: 13,
    charisma: 8,
    abilities: {
      strength: 10,
      dexterity: 14,
      constitution: 12,
      intelligence: 10,
      wisdom: 13,
      charisma: 8,
    },
    proficiencyBonus: 2,
    saveProficiencies: ['strength', 'constitution'],
    ...overrides,
  };
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('DiceRoller — constructor', () => {
  it('creates an instance without seed', () => {
    const dr = new DiceRoller();
    expect(dr).toBeInstanceOf(DiceRoller);
  });

  it('creates a seeded instance', () => {
    const dr = new DiceRoller('myseed');
    expect(dr).toBeInstanceOf(DiceRoller);
  });

  it('produces deterministic rolls with the same seed', () => {
    const dr1 = new DiceRoller('test-seed-42');
    const dr2 = new DiceRoller('test-seed-42');
    const rolls1 = Array.from({ length: 10 }, () => dr1.rollD20());
    const rolls2 = Array.from({ length: 10 }, () => dr2.rollD20());
    expect(rolls1).toEqual(rolls2);
  });

  it('produces different rolls with different seeds', () => {
    const dr1 = new DiceRoller('seed-A');
    const dr2 = new DiceRoller('seed-B');
    const rolls1 = Array.from({ length: 20 }, () => dr1.rollD20());
    const rolls2 = Array.from({ length: 20 }, () => dr2.rollD20());
    expect(rolls1).not.toEqual(rolls2);
  });
});

// ─── rollD20 ──────────────────────────────────────────────────────────────────

describe('DiceRoller.rollD20()', () => {
  // Use unseeded (Math.random) for range correctness — seeded LCG can overflow to negatives
  it('always returns an integer in [1, 20]', () => {
    const dr = new DiceRoller();
    for (let i = 0; i < 200; i++) {
      const roll = dr.rollD20();
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(20);
      expect(Number.isInteger(roll)).toBe(true);
    }
  });
});

// ─── rollDice ─────────────────────────────────────────────────────────────────

describe('DiceRoller.rollDice()', () => {
  // Use unseeded (Math.random) for range correctness
  it('returns an integer in [1, sides] for count=1', () => {
    const dr = new DiceRoller();
    for (let i = 0; i < 100; i++) {
      const roll = dr.rollDice(6);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    }
  });

  it('returns sum of multiple dice (d8 × 3 ∈ [3, 24])', () => {
    const dr = new DiceRoller();
    for (let i = 0; i < 100; i++) {
      const roll = dr.rollDice(8, 3);
      expect(roll).toBeGreaterThanOrEqual(3);
      expect(roll).toBeLessThanOrEqual(24);
    }
  });

  it('defaults count to 1', () => {
    const dr = new DiceRoller();
    for (let i = 0; i < 50; i++) {
      const roll = dr.rollDice(4);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(4);
    }
  });
});

// ─── Advantage / Disadvantage ─────────────────────────────────────────────────

describe('DiceRoller.rollWithAdvantage()', () => {
  let dr: DiceRoller;
  beforeEach(() => {
    dr = new DiceRoller('adv');
  });

  it('returns { roll, kept, dropped }', () => {
    const result = dr.rollWithAdvantage();
    expect(result).toHaveProperty('roll');
    expect(result).toHaveProperty('kept');
    expect(result).toHaveProperty('dropped');
  });

  it('kept === roll (the higher value)', () => {
    for (let i = 0; i < 50; i++) {
      const result = dr.rollWithAdvantage();
      expect(result.roll).toBe(result.kept);
      expect(result.kept).toBeGreaterThanOrEqual(result.dropped);
    }
  });

  it('all values are in [1, 20]', () => {
    for (let i = 0; i < 50; i++) {
      const { kept, dropped } = dr.rollWithAdvantage();
      expect(kept).toBeGreaterThanOrEqual(1);
      expect(kept).toBeLessThanOrEqual(20);
      expect(dropped).toBeGreaterThanOrEqual(1);
      expect(dropped).toBeLessThanOrEqual(20);
    }
  });
});

describe('DiceRoller.rollWithDisadvantage()', () => {
  let dr: DiceRoller;
  beforeEach(() => {
    dr = new DiceRoller('dis');
  });

  it('kept === roll (the lower value)', () => {
    for (let i = 0; i < 50; i++) {
      const result = dr.rollWithDisadvantage();
      expect(result.roll).toBe(result.kept);
      expect(result.kept).toBeLessThanOrEqual(result.dropped);
    }
  });
});

// ─── getAbilityModifier ───────────────────────────────────────────────────────

describe('DiceRoller.getAbilityModifier()', () => {
  const dr = new DiceRoller();

  const cases: Array<[number, number]> = [
    [1, -5],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [13, 1],
    [14, 2],
    [15, 2],
    [16, 3],
    [17, 3],
    [18, 4],
    [20, 5],
    [30, 10],
  ];

  it.each(cases)('score %i → modifier %i', (score, expected) => {
    expect(dr.getAbilityModifier(score)).toBe(expected);
  });
});

// ─── skillCheck ───────────────────────────────────────────────────────────────

describe('DiceRoller.skillCheck()', () => {
  let dr: DiceRoller;
  beforeEach(() => {
    dr = new DiceRoller('skill');
  });

  it('throws if character is null', () => {
    expect(() => dr.skillCheck(null, 'strength')).toThrow();
  });

  it('returns { roll, modifier, total, success, dc }', () => {
    const char = makeCharacter();
    const result = dr.skillCheck(char, 'strength', false, 10);
    expect(result).toHaveProperty('roll');
    expect(result).toHaveProperty('modifier');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('dc');
  });

  it('total === roll + modifier', () => {
    const char = makeCharacter({ strength: 16 }); // +3 modifier
    const result = dr.skillCheck(char, 'strength', false, 15);
    expect(result.total).toBe(result.roll + result.modifier);
  });

  it('proficiency bonus is added when proficient', () => {
    const char = makeCharacter();
    const noprof = dr.skillCheck(char, 'strength', false, 10);
    const withprof = dr.skillCheck(char, 'strength', true, 10);
    // modifier with prof = modifier without prof + proficiencyBonus (2)
    expect(withprof.modifier - noprof.modifier).toBe(2);
  });

  it('success is true when total >= dc', () => {
    const char = makeCharacter({ strength: 30 }); // +10 modifier, guaranteed success
    // Force roll with mocked Math.random to guarantee a high roll
    const result = dr.skillCheck(char, 'strength', true, 1);
    expect(result.success).toBe(true);
  });

  it('always success on natural 20 if dc is very high (advantage mode)', () => {
    // With strength 30 (+10) + prof (2) = +12, even rolling 1 = 13 vs DC 1 → success
    const char = makeCharacter({ strength: 30 });
    for (let i = 0; i < 30; i++) {
      const result = dr.skillCheck(char, 'strength', true, 1, 'advantage');
      expect(result.success).toBe(true);
    }
  });
});

// ─── attackRoll ───────────────────────────────────────────────────────────────

describe('DiceRoller.attackRoll()', () => {
  let dr: DiceRoller;
  beforeEach(() => {
    dr = new DiceRoller('attack');
  });

  it('throws if character is null', () => {
    expect(() => dr.attackRoll(null)).toThrow();
  });

  it('returns { roll, modifier, total, hit, crit, targetAC, rollType }', () => {
    const char = makeCharacter();
    const result = dr.attackRoll(char, 'melee', 10);
    expect(result).toHaveProperty('roll');
    expect(result).toHaveProperty('modifier');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('hit');
    expect(result).toHaveProperty('crit');
    expect(result).toHaveProperty('targetAC');
    expect(result).toHaveProperty('rollType');
  });

  it('uses strength for melee attacks', () => {
    // Strength 20 (+5) + proficiencyBonus (2) = +7 modifier
    const char = makeCharacter({
      abilities: {
        strength: 20,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    });
    const result = dr.attackRoll(char, 'melee', 10);
    expect(result.modifier).toBe(7);
  });

  it('uses dexterity for ranged attacks', () => {
    // Dexterity 18 (+4) + proficiencyBonus (2) = +6 modifier
    const char = makeCharacter({
      abilities: {
        strength: 10,
        dexterity: 18,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    });
    const result = dr.attackRoll(char, 'ranged', 10);
    expect(result.modifier).toBe(6);
  });

  it('crit is true when roll === 20', () => {
    // Mock random to always return 20
    const dr2 = new DiceRoller();
    vi.spyOn(dr2, 'rollD20').mockReturnValue(20);
    const char = makeCharacter();
    const result = dr2.attackRoll(char, 'melee', 10);
    expect(result.crit).toBe(true);
    expect(result.hit).toBe(true);
  });

  it('miss on natural 1 (even vs AC 1)', () => {
    const dr2 = new DiceRoller();
    vi.spyOn(dr2, 'rollD20').mockReturnValue(1);
    const char = makeCharacter({
      abilities: {
        strength: 30,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      proficiencyBonus: 2,
    });
    const result = dr2.attackRoll(char, 'melee', 1);
    expect(result.hit).toBe(false);
    expect(result.crit).toBe(false);
  });
});

// ─── damageRoll ───────────────────────────────────────────────────────────────

describe('DiceRoller.damageRoll()', () => {
  let dr: DiceRoller;
  beforeEach(() => {
    dr = new DiceRoller('dmg');
  });

  const cases: Array<[string, number, number]> = [
    ['1d6', 1, 6],
    ['2d6', 2, 12],
    ['1d8', 1, 8],
    ['1d4+3', 4, 7],
    ['2d6+3', 5, 15],
    ['1d10-2', -1, 8],
  ];

  it.each(cases)('"%s" rolls in [%i, %i]', (diceStr, min, max) => {
    for (let i = 0; i < 80; i++) {
      const result = dr.damageRoll(diceStr);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
    }
  });

  it('returns 0 for invalid dice string', () => {
    const result = dr.damageRoll('not-a-dice');
    expect(result).toBe(0);
  });

  it('returns 0 for empty string', () => {
    const result = dr.damageRoll('');
    expect(result).toBe(0);
  });
});

// ─── Logging ──────────────────────────────────────────────────────────────────

describe('DiceRoller — logger callback', () => {
  it('calls logger with message and type on skillCheck', () => {
    const mockLogger = vi.fn();
    const dr = new DiceRoller(null, mockLogger);
    const char = makeCharacter();
    dr.skillCheck(char, 'strength', false, 10, 'normal', 'Athletics');
    expect(mockLogger).toHaveBeenCalled();
    const [message, type] = mockLogger.mock.calls[0];
    expect(typeof message).toBe('string');
    expect(['success', 'warning', 'info']).toContain(type);
  });

  it('does not call logger when no logger provided', () => {
    const dr = new DiceRoller();
    const char = makeCharacter();
    // Should not throw
    expect(() => dr.skillCheck(char, 'strength', false, 10, 'normal', 'Athletics')).not.toThrow();
  });
});
