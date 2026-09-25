import { describe, it, expect } from 'vitest';
import { Enemy, findSrdMonster } from '../../src/game/Enemy';
import { DiceRoller } from '../../src/game/DiceRoller';
import { POISystem } from '../../src/poiSystem';

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

describe('SRD monster database', () => {
  it('resolves every CR <= 5 encounter creature to a real stat block with a matching CR', () => {
    const tables = new POISystem().encounterTables;
    const mismatches: string[] = [];
    for (const [terrain, entries] of Object.entries(tables)) {
      for (const e of entries) {
        if (e.cr === 0 || e.cr > 5 || ['Giant fish', 'Yetis'].includes(e.name)) continue;
        const name = e.creatures.replace(/^(\d+d\d+|\d+)\s+/, '');
        const enemy = new Enemy(name, e.cr);
        const block = findSrdMonster(name) ?? enemy.getStatTableByName(name.toLowerCase());
        if (!block || enemy.cr !== e.cr) {
          mismatches.push(`${terrain}/${e.name}: table CR ${e.cr}, block CR ${enemy.cr}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('prefers exact SRD creatures over loose hand-written keyword matches', () => {
    // "owlbear" contains "bear" but must not get the brown bear block
    const owlbear = new Enemy('Owlbear', 3);
    expect(owlbear.maxHP).toBe(59);
    expect(owlbear.multiattack).toBe(2);
    // Hand-written MM'25 goblin still wins over the SRD 5.1 goblin
    expect(new Enemy('Goblin', 0.25).maxHP).toBe(10);
  });
});
