import { describe, it, expect } from 'vitest';
import { Enemy } from '../../src/game/Enemy';
import { DiceRoller } from '../../src/game/DiceRoller';

describe('Enemy group sizing by XP budget', () => {
  it('keeps level 1 solo fights small and grows them by level 5', () => {
    // Wolves are CR 1/4 (50 XP). L1 low = 50 XP -> 1 wolf.
    expect(Enemy.groupSizeForBudget(0.25, 8, [1])).toBe(1);
    // L3 moderate = 225 XP -> 4 wolves (size cap L+1 = 4).
    expect(Enemy.groupSizeForBudget(0.25, 8, [3])).toBe(4);
    // L5 high = 1100 XP -> 22 fit, capped at L+1 = 6.
    expect(Enemy.groupSizeForBudget(0.25, 8, [5])).toBe(6);
  });

  it('never exceeds the dice max and always spawns at least one', () => {
    expect(Enemy.groupSizeForBudget(0.125, 3, [5])).toBe(3);
    // Hill giant (CR 5, 1800 XP) is over any L1 budget but still spawns alone.
    expect(Enemy.groupSizeForBudget(5, 2, [1])).toBe(1);
  });

  it('sums budgets across party members', () => {
    // Two L1s: 100 XP -> 2 wolves; one L1 alone gets 1.
    expect(Enemy.groupSizeForBudget(0.25, 8, [1, 1])).toBe(2);
  });

  it('parseCreatureString uses the budget when party levels are given', () => {
    const enemies = Enemy.parseCreatureString('2d4 Wolves', 0.25, new DiceRoller(), [3]);
    expect(enemies).toHaveLength(4);
    expect(enemies.every(e => e.cr === 0.25)).toBe(true);
  });
});
