/* eslint-disable @typescript-eslint/no-explicit-any */
// Combat.ts is intentionally loosely typed (file-level no-explicit-any) — these tests
// exercise the public API as it actually behaves, mirroring how combatReducer drives it.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Combat, getXPForCR, CR_TO_XP } from '../../src/game/Combat';
import { Character } from '../../src/game/Character';
import { Enemy } from '../../src/game/Enemy';
import { DiceRoller } from '../../src/game/DiceRoller';
import { combatReducer } from '../../src/contexts/reducers/combatReducer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A fighter with fixed, known stats so attack math is deterministic. */
function makeHero(name = 'Hero', overrides: Record<string, unknown> = {}) {
  const hero = new Character(name, 'fighter');
  hero.abilities = {
    strength: 16, // +3
    dexterity: 14, // +2
    constitution: 12,
    intelligence: 10,
    wisdom: 10,
    charisma: 8,
  };
  hero.proficiencyBonus = 2; // melee attack modifier = +5
  hero.maxHP = 20;
  hero.currentHP = 20;
  hero.armorClass = 14;
  (hero.equipment as any).mainHand = {
    name: 'Longsword',
    damage: '1d8',
    damageType: 'slashing',
    range: 1,
  };
  Object.assign(hero, overrides);
  return hero;
}

/** Goblin: HP 10, AC 15, attackBonus +4, Scimitar 1d6+2 slashing, DEX 15 (+2). */
function makeGoblin(name = 'Goblin') {
  return new Enemy(name, 0.25, 'goblinoid');
}

/** Zombie: HP 22, AC 8, attackBonus +3, Slam 1d6+1 bludgeoning, DEX 6 (−2). */
function makeZombie(name = 'Zombie') {
  return new Enemy(name, 0.25, 'undead');
}

/** Hero turn-order entry in the shape combatReducer builds (character set, enemy null). */
function heroEntry(id: string, hero: any, position: { col: number; row: number } | null) {
  return {
    id,
    name: hero.name,
    character: hero,
    enemy: null,
    isAlly: true,
    isEnemy: false,
    hp: hero.currentHP,
    maxHp: hero.maxHP,
    currentHP: hero.currentHP,
    maxHP: hero.maxHP,
    position,
    statusEffects: [] as any[],
  };
}

/** Enemy turn-order entry in the shape combatReducer builds (enemy set, character null). */
function enemyEntry(id: string, enemy: any, position: { col: number; row: number } | null) {
  return {
    id,
    name: enemy.name,
    character: null,
    enemy,
    isAlly: false,
    isEnemy: true,
    hp: enemy.currentHP,
    maxHp: enemy.maxHP,
    currentHP: enemy.currentHP,
    maxHP: enemy.maxHP,
    position,
    statusEffects: [] as any[],
  };
}

/** Build a 1v1 hex combat: hero at (2,2), enemy adjacent at (3,2). */
function makeHexCombat(hero = makeHero(), enemy = makeGoblin()) {
  const combat = new Combat([hero], [enemy]);
  const ally = heroEntry('ally-0', hero, { col: 2, row: 2 });
  const foe = enemyEntry('enemy-0', enemy, { col: 3, row: 2 });
  combat.turnOrder = [ally, foe] as any;
  return { combat, hero, enemy, ally, foe };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. Combat initialization ─────────────────────────────────────────────────

describe('Combat — initialization', () => {
  it('registers party members as ally combatants with ids and HP snapshots', () => {
    const heroA = makeHero('Alice');
    const heroB = makeHero('Bob', { currentHP: 15 });
    const combat = new Combat([heroA, heroB], [makeGoblin()]);

    expect(combat.allies).toHaveLength(2);
    expect(combat.allies[0]).toMatchObject({
      id: 'ally-0',
      hp: 20,
      maxHp: 20,
      isEnemy: false,
      position: null,
    });
    expect(combat.allies[1]).toMatchObject({ id: 'ally-1', hp: 15, maxHp: 20 });
    expect(combat.allies[0].character).toBe(heroA);
    expect(combat.allies[0].statusEffects).toEqual([]);
  });

  it('registers enemies as enemy combatants with ids and HP snapshots', () => {
    const goblin = makeGoblin();
    const zombie = makeZombie();
    const combat = new Combat([makeHero()], [goblin, zombie]);

    expect(combat.enemyCombatants).toHaveLength(2);
    expect(combat.enemyCombatants[0]).toMatchObject({
      id: 'enemy-0',
      hp: 10,
      maxHp: 10,
      isEnemy: true,
      position: null,
    });
    expect(combat.enemyCombatants[1]).toMatchObject({ id: 'enemy-1', hp: 22, maxHp: 22 });
    expect(combat.enemyCombatants[0].character).toBe(goblin);
  });

  it('stores the battlefield and starts with empty turn order, round 0, index 0', () => {
    const battlefield = { hexes: [{ col: 0, row: 0 }] };
    const combat = new Combat([makeHero()], [makeGoblin()], battlefield);

    expect(combat.battlefield).toBe(battlefield);
    expect(combat.turnOrder).toEqual([]);
    expect(combat.currentTurnIndex).toBe(0);
    expect(combat.round).toBe(0);
    expect(combat.combatLog).toEqual([]);
    expect(combat.fleeAttempted).toBe(false);
  });

  it('supports the legacy (characters, enemies, options) signature', () => {
    const combat = new Combat([makeHero()], [makeGoblin()], { canFlee: false } as any);
    expect(combat.battlefield).toBeNull();
    expect(combat.canFlee).toBe(false);
  });

  it('canFlee defaults to true and fleeDC derives from average CR', () => {
    const combat = new Combat([makeHero()], [makeGoblin()]); // avg CR 0.25
    expect(combat.canFlee).toBe(true);
    expect(combat.fleeDC).toBe(10); // 10 + floor(0.25 / 2)
  });

  it('getAverageCR averages enemy CR and returns 0 with no enemies', () => {
    const e1 = makeGoblin();
    const e2 = makeGoblin('Goblin 2');
    (e2 as any).cr = 1.75;
    expect(new Combat([makeHero()], [e1, e2]).getAverageCR()).toBe(1);
    expect(new Combat([makeHero()], []).getAverageCR()).toBe(0);
  });
});

// ─── 2. Initiative & turn order ───────────────────────────────────────────────

describe('Combat — rollInitiative()', () => {
  it('is deterministic with a seeded DiceRoller', () => {
    const roll = () => {
      const combat = new Combat(
        [makeHero('Alice'), makeHero('Bob')],
        [makeGoblin(), makeZombie()]
      );
      combat.diceRoller = new DiceRoller('initiative-seed');
      return combat.rollInitiative();
    };

    const first = roll();
    const second = roll();
    expect(first.map(i => i.combatant.name)).toEqual(second.map(i => i.combatant.name));
    expect(first.map(i => i.initiative)).toEqual(second.map(i => i.initiative));
    expect(first).toHaveLength(4);
  });

  it('sorts combatants by initiative, highest first', () => {
    const combat = new Combat([makeHero('Alice'), makeHero('Bob')], [makeGoblin(), makeZombie()]);
    combat.diceRoller = new DiceRoller('sort-seed');
    const order = combat.rollInitiative();

    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].initiative).toBeGreaterThanOrEqual(order[i].initiative);
    }
  });

  it('adds DEX modifier to the d20 roll (characters roll before enemies)', () => {
    const hero = makeHero(); // DEX 14 → +2
    const goblin = makeGoblin(); // DEX 15 → +2
    const combat = new Combat([hero], [goblin]);
    vi.spyOn(combat.diceRoller, 'rollD20')
      .mockReturnValueOnce(20) // hero
      .mockReturnValueOnce(1); // goblin

    const order = combat.rollInitiative();
    expect(order[0].combatant).toBe(hero);
    expect(order[0]).toMatchObject({ type: 'character', roll: 20, initiative: 22 });
    expect(order[1].combatant).toBe(goblin);
    expect(order[1]).toMatchObject({ type: 'enemy', roll: 1, initiative: 3 });
  });

  it('includes item initiative bonus for characters', () => {
    const hero = makeHero('Quick', { initiativeBonus: 5 });
    const combat = new Combat([hero], [makeGoblin()]);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(10);

    const order = combat.rollInitiative();
    const heroInit = order.find(i => i.combatant === hero)!;
    expect(heroInit.initiative).toBe(17); // 10 + 2 (DEX) + 5 (item)
  });

  it('excludes downed characters and dead enemies', () => {
    const downed = makeHero('Downed', { currentHP: 0 });
    const alive = makeHero('Alive');
    const deadGoblin = makeGoblin('Dead Goblin');
    deadGoblin.takeDamage(999);
    const liveGoblin = makeGoblin('Live Goblin');

    const combat = new Combat([downed, alive], [deadGoblin, liveGoblin]);
    combat.diceRoller = new DiceRoller('exclude-seed');
    const order = combat.rollInitiative();

    expect(order).toHaveLength(2);
    expect(order.map(i => i.combatant.name).sort()).toEqual(['Alive', 'Live Goblin']);
  });

  it('writes an initiative header to the combat log', () => {
    const combat = new Combat([makeHero()], [makeGoblin()]);
    combat.diceRoller = new DiceRoller('log-seed');
    combat.rollInitiative();
    expect(combat.combatLog).toContain('=== INITIATIVE ===');
  });
});

// ─── 3. Attack resolution (hex combat: processAttack) ────────────────────────

describe('Combat — processAttack(): hero attacker', () => {
  it('hits when roll + modifiers meets target AC and applies damage to target HP', () => {
    const { combat, enemy, foe } = makeHexCombat();
    // STR +3 + prof +2 = +5; 10 + 5 = 15 vs goblin AC 15 → hit, not crit
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(10);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(5); // 1d8 → 5

    const result = combat.processAttack('ally-0', 'enemy-0');

    expect(result.success).toBe(true);
    expect(result.hit).toBe(true);
    expect(result.critical).toBe(false);
    expect(result.damage).toBe(8); // 1d8 (5) + STR mod (3)
    expect(foe.hp).toBe(2); // 10 − 8
    expect(enemy.currentHP).toBe(2); // synced to underlying Enemy
  });

  it('misses when total is below target AC and deals no damage', () => {
    const { combat, enemy, foe } = makeHexCombat();
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(9); // 9 + 5 = 14 < AC 15
    const damageSpy = vi.spyOn(combat.diceRoller, 'rollDice');

    const result = combat.processAttack('ally-0', 'enemy-0');

    expect(result.success).toBe(true);
    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
    expect(foe.hp).toBe(10);
    expect(enemy.currentHP).toBe(10);
    expect(damageSpy).not.toHaveBeenCalled();
  });

  it('natural 20 is a critical hit that rolls weapon dice twice', () => {
    const { combat, foe } = makeHexCombat();
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(20);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(5);

    const result = combat.processAttack('ally-0', 'enemy-0');

    expect(result.hit).toBe(true);
    expect(result.critical).toBe(true);
    expect(result.damage).toBe(13); // (1d8+3 → 8) + crit 1d8 (5)
    expect(foe.hp).toBe(0); // 10 − 13, clamped at 0
  });

  it('natural 20 hits even against impossible AC', () => {
    const hero = makeHero();
    const tank = makeGoblin();
    (tank as any).ac = 100;
    const { combat } = makeHexCombat(hero, tank);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(20);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(1);

    const result = combat.processAttack('ally-0', 'enemy-0');
    expect(result.hit).toBe(true);
    expect(result.critical).toBe(true);
  });

  it('natural 1 always misses even when modifiers would beat AC', () => {
    const { combat } = makeHexCombat(makeHero(), makeZombie()); // AC 8, +5 to hit
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(1); // 1 + 5 = 6... but nat 1 anyway

    const result = combat.processAttack('ally-0', 'enemy-0');
    expect(result.hit).toBe(false);
    expect(result.critical).toBe(false);
  });

  it('clamps target HP at 0 instead of going negative', () => {
    const enemy = makeGoblin();
    const { combat, foe } = makeHexCombat(makeHero(), enemy);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(20);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(8); // crit: (8+3) + 8 = 19 vs 10 HP

    combat.processAttack('ally-0', 'enemy-0');
    expect(foe.hp).toBe(0);
    expect(enemy.currentHP).toBe(0);
    expect(enemy.checkIsDead()).toBe(true);
  });

  it('Rage on the attacker grants advantage and bonus melee damage', () => {
    const { combat, ally, foe } = makeHexCombat();
    ally.statusEffects.push({
      name: 'Rage',
      effects: { strengthAdvantage: true, rageDamageBonus: 2, physicalResistance: true },
    });
    // Advantage → two d20 rolls, keep highest
    const d20 = vi
      .spyOn(combat.diceRoller, 'rollD20')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(3);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(5);

    const result = combat.processAttack('ally-0', 'enemy-0');

    expect(d20).toHaveBeenCalledTimes(2); // advantage pair
    expect(result.hit).toBe(true); // kept 10 → 15 vs AC 15
    expect(result.damage).toBe(10); // 1d8(5) + STR(3) + rage(2)
    expect(foe.hp).toBe(0);
    expect(ally.statusEffects[0].extendedThisTurn).toBe(true);
  });
});

describe('Combat — processAttack(): enemy attacker', () => {
  it('uses the enemy attack bonus and stat-block weapon, syncing hero HP', () => {
    const hero = makeHero(); // AC 14
    const { combat, ally } = makeHexCombat(hero);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(10); // 10 + 4 = 14 ≥ AC 14 → hit
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(3); // scimitar 1d6+2 → 5

    const result = combat.processAttack('enemy-0', 'ally-0');

    expect(result.success).toBe(true);
    expect(result.hit).toBe(true);
    expect(result.damage).toBe(5);
    expect(ally.hp).toBe(15); // 20 − 5
    expect(hero.currentHP).toBe(15); // synced to underlying Character
  });

  it('misses when roll + attack bonus is below hero AC', () => {
    const hero = makeHero();
    const { combat, ally } = makeHexCombat(hero);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(9); // 9 + 4 = 13 < 14

    const result = combat.processAttack('enemy-0', 'ally-0');
    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
    expect(ally.hp).toBe(20);
  });

  it('enemy natural 20 doubles weapon dice', () => {
    const hero = makeHero();
    const { combat, ally } = makeHexCombat(hero);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(20);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(3); // (1d6+2 → 5) + (1d6+2 → 5)

    const result = combat.processAttack('enemy-0', 'ally-0');
    expect(result.critical).toBe(true);
    expect(result.damage).toBe(10);
    expect(ally.hp).toBe(10);
  });

  it('attacks against a dodging target are rolled with disadvantage', () => {
    const hero = makeHero();
    const { combat, ally } = makeHexCombat(hero);
    const dodge = combat.processDodge('ally-0');
    expect(dodge.success).toBe(true);
    expect(ally.statusEffects.some(e => e.name === 'Dodge')).toBe(true);

    const d20 = vi
      .spyOn(combat.diceRoller, 'rollD20')
      .mockReturnValueOnce(18)
      .mockReturnValueOnce(4); // disadvantage keeps the 4 → 4 + 4 = 8 < AC 14

    const result = combat.processAttack('enemy-0', 'ally-0');
    expect(d20).toHaveBeenCalledTimes(2);
    expect(result.hit).toBe(false);
    expect(ally.hp).toBe(20);
  });
});

describe('Combat — processAttack(): validation, range and line of sight', () => {
  it('fails for unknown attacker or target ids', () => {
    const { combat } = makeHexCombat();
    expect(combat.processAttack('nope', 'enemy-0')).toMatchObject({
      success: false,
      hit: false,
      damage: 0,
      message: 'Invalid attacker or target',
    });
    expect(combat.processAttack('ally-0', 'nope').success).toBe(false);
  });

  it('fails when a combatant has no position', () => {
    const hero = makeHero();
    const goblin = makeGoblin();
    const combat = new Combat([hero], [goblin]);
    combat.turnOrder = [heroEntry('ally-0', hero, null), enemyEntry('enemy-0', goblin, { col: 0, row: 0 })] as any;

    const result = combat.processAttack('ally-0', 'enemy-0');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Attacker or target has no position');
  });

  it('fails when the target is beyond weapon range', () => {
    const hero = makeHero(); // melee range 1
    const goblin = makeGoblin();
    const combat = new Combat([hero], [goblin]);
    combat.turnOrder = [
      heroEntry('ally-0', hero, { col: 2, row: 2 }),
      enemyEntry('enemy-0', goblin, { col: 5, row: 2 }), // 3 hexes away
    ] as any;

    const result = combat.processAttack('ally-0', 'enemy-0');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/out of range/i);
  });

  it('ranged attacks succeed with clear line of sight', () => {
    const hero = makeHero('Archer');
    (hero.equipment as any).mainHand = {
      name: 'Shortbow',
      damage: '1d6',
      damageType: 'piercing',
      range: 16,
    };
    const goblin = makeGoblin();
    const battlefield = {
      hexes: [0, 1, 2, 3].map(col => ({ col, row: 0, blocked: false })),
    };
    const combat = new Combat([hero], [goblin], battlefield);
    combat.turnOrder = [
      heroEntry('ally-0', hero, { col: 0, row: 0 }),
      enemyEntry('enemy-0', goblin, { col: 3, row: 0 }),
    ] as any;
    // Ranged uses DEX: +2 + prof +2 = +4 → 11 + 4 = 15 ≥ AC 15
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(11);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(4);

    const result = combat.processAttack('ally-0', 'enemy-0');
    expect(result.success).toBe(true);
    expect(result.hit).toBe(true);
    expect(result.damage).toBe(6); // 1d6 (4) + DEX (2)
  });

  it('ranged attacks are blocked without line of sight', () => {
    const hero = makeHero('Archer');
    (hero.equipment as any).mainHand = {
      name: 'Shortbow',
      damage: '1d6',
      damageType: 'piercing',
      range: 16,
    };
    const goblin = makeGoblin();
    const battlefield = {
      hexes: [
        { col: 0, row: 0, blocked: false },
        { col: 1, row: 0, blocked: true }, // wall
        { col: 2, row: 0, blocked: true }, // wall
        { col: 3, row: 0, blocked: false },
      ],
    };
    const combat = new Combat([hero], [goblin], battlefield);
    combat.turnOrder = [
      heroEntry('ally-0', hero, { col: 0, row: 0 }),
      enemyEntry('enemy-0', goblin, { col: 3, row: 0 }),
    ] as any;

    const result = combat.processAttack('ally-0', 'enemy-0');
    expect(result.success).toBe(false);
    expect(result.message).toBe('No line of sight to target');
  });
});

// ─── 4. Death, defeat and combat end detection ───────────────────────────────

describe('Combat — victory/defeat detection', () => {
  it('checkVictory is true only when every enemy is dead', () => {
    const g1 = makeGoblin('G1');
    const g2 = makeGoblin('G2');
    const combat = new Combat([makeHero()], [g1, g2]);

    expect(combat.checkVictory()).toBe(false);
    g1.takeDamage(999);
    expect(combat.checkVictory()).toBe(false);
    g2.takeDamage(999);
    expect(combat.checkVictory()).toBe(true);
  });

  it('checkDefeat is true only when every character is at 0 HP', () => {
    const a = makeHero('A');
    const b = makeHero('B');
    const combat = new Combat([a, b], [makeGoblin()]);

    expect(combat.checkDefeat()).toBe(false);
    a.takeDamage(999);
    expect(combat.checkDefeat()).toBe(false);
    b.takeDamage(999);
    expect(combat.checkDefeat()).toBe(true);
  });

  it('simulateCombat ends with victory, awards XP, and reports enemy as dead', () => {
    const hero = makeHero();
    const goblin = makeGoblin(); // CR 1/4 → 50 XP
    const combat = new Combat([hero], [goblin]);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(20); // hero crits first
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(8); // crit: 8 + 3 + 8 = 19 ≥ 10 HP

    const result = combat.simulateCombat();

    expect(result.victory).toBe(true);
    expect(result.fled).toBe(false);
    expect(result.rounds).toBe(1);
    expect(result.totalXP).toBe(50);
    expect(result.xpPerCharacter).toBe(50);
    expect(result.enemyStates[0]).toMatchObject({ name: 'Goblin', currentHP: 0, alive: false });
    expect(result.characterStates[0].alive).toBe(true);
    expect(result.combatLog).toContain('=== VICTORY ===');
    expect(goblin.checkIsDead()).toBe(true);
  });

  it('simulateCombat ends with defeat when the party is wiped out', () => {
    const hero = makeHero('Doomed', { currentHP: 5, armorClass: 5 });
    const zombie = makeZombie(); // AC 8, +3 to hit, Slam 1d6+1
    const combat = new Combat([hero], [zombie]);
    // Hero: 2 + 5 = 7 < AC 8 → miss. Zombie: 2 + 3 = 5 ≥ AC 5 → hit for 6+1=7 ≥ 5 HP.
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(2);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(6);

    const result = combat.simulateCombat();

    expect(result.victory).toBe(false);
    expect(result.fled).toBe(false);
    expect(result.totalXP).toBe(0);
    expect(result.characterStates[0]).toMatchObject({ currentHP: 0, alive: false });
    expect(result.combatLog).toContain('=== DEFEAT ===');
    expect(hero.currentHP).toBe(0);
  });

  it('getCombatSummary reflects victory results and XP', () => {
    const combat = new Combat([makeHero()], [makeGoblin()]);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(20);
    vi.spyOn(combat.diceRoller, 'rollDice').mockReturnValue(8);

    const summary = combat.getCombatSummary(combat.simulateCombat());
    expect(summary).toContain('VICTORY!');
    expect(summary).toContain('Total XP: 50');
  });
});

describe('Combat — fleeing', () => {
  it('attemptFlee fails immediately when canFlee is false', () => {
    const combat = new Combat([makeHero()], [makeGoblin()], { canFlee: false } as any);
    const d20 = vi.spyOn(combat.diceRoller, 'rollD20');

    expect(combat.attemptFlee()).toBe(false);
    expect(d20).not.toHaveBeenCalled();
    expect(combat.combatLog).toContain('Cannot flee from this combat!');
  });

  it('attemptFlee succeeds when enough of the party beats the flee DC', () => {
    const combat = new Combat([makeHero()], [makeGoblin()]); // fleeDC 10
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(20); // 20 + 2 = 22 ≥ 10

    expect(combat.attemptFlee()).toBe(true);
    expect(combat.fleeAttempted).toBe(true);
  });

  it('attemptFlee fails when the party rolls too low', () => {
    const combat = new Combat([makeHero()], [makeGoblin()]);
    vi.spyOn(combat.diceRoller, 'rollD20').mockReturnValue(1); // 1 + 2 = 3 < 10

    expect(combat.attemptFlee()).toBe(false);
  });
});

// ─── 5. Turn cycling & round increments (Combat.simulateRound) ───────────────

describe('Combat — simulateRound()', () => {
  it('executes turns in initiative order and increments the round each call', () => {
    const hero = makeHero();
    const goblin = makeGoblin();
    const combat = new Combat([hero], [goblin]);
    const sequence: string[] = [];
    vi.spyOn(combat, 'executeEnemyTurn').mockImplementation(() => {
      sequence.push('enemy');
    });
    vi.spyOn(combat, 'executeCharacterTurn').mockImplementation(() => {
      sequence.push('character');
    });

    const order = [
      { type: 'enemy', combatant: goblin },
      { type: 'character', combatant: hero },
    ];

    expect(combat.round).toBe(0);
    const continues = combat.simulateRound(order);
    expect(continues).toBe(true);
    expect(combat.round).toBe(1);
    expect(sequence).toEqual(['enemy', 'character']); // initiative order respected

    combat.simulateRound(order);
    expect(combat.round).toBe(2);
    expect(combat.combatLog).toContain('=== ROUND 2 ===');
  });

  it('skips dead combatants', () => {
    const dead = makeHero('Dead', { currentHP: 0 });
    const alive = makeHero('Alive');
    const goblin = makeGoblin();
    const combat = new Combat([dead, alive], [goblin]);
    const charSpy = vi.spyOn(combat, 'executeCharacterTurn').mockImplementation(() => {});
    vi.spyOn(combat, 'executeEnemyTurn').mockImplementation(() => {});

    combat.simulateRound([
      { type: 'character', combatant: dead },
      { type: 'character', combatant: alive },
      { type: 'enemy', combatant: goblin },
    ]);

    expect(charSpy).toHaveBeenCalledTimes(1);
    expect(charSpy).toHaveBeenCalledWith(alive);
  });

  it('stops mid-round and returns false as soon as victory is reached', () => {
    const hero = makeHero();
    const goblin = makeGoblin();
    const combat = new Combat([hero], [goblin]);
    vi.spyOn(combat, 'executeCharacterTurn').mockImplementation(() => {
      goblin.takeDamage(999);
    });
    const enemySpy = vi.spyOn(combat, 'executeEnemyTurn').mockImplementation(() => {});

    const continues = combat.simulateRound([
      { type: 'character', combatant: hero },
      { type: 'enemy', combatant: goblin },
    ]);

    expect(continues).toBe(false);
    expect(enemySpy).not.toHaveBeenCalled(); // goblin never gets a turn
  });
});

// ─── 5+6. Action economy & turn advancement (combatReducer) ──────────────────
// Per-turn action economy (action / bonus action / movement) and ADVANCE_COMBAT_TURN
// live in the combat reducer, which drives the Combat instance.

const ACTION_NAMES = [
  'USE_COMBAT_ACTION',
  'USE_COMBAT_BONUS_ACTION',
  'USE_COMBAT_REACTION',
  'USE_COMBAT_MOVEMENT',
  'USE_FREE_OBJECT_INTERACTION',
  'RESET_COMBAT_TURN_STATE',
  'INCREMENT_ATTACK_COUNT',
  'ADVANCE_COMBAT_TURN',
  'END_COMBAT',
] as const;

const ACTIONS: Record<string, string> = Object.fromEntries(ACTION_NAMES.map(n => [n, n]));

function freshTurnState(overrides: Record<string, unknown> = {}) {
  return {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    freeObjectUsed: false,
    attacksMade: 0,
    conditions: [] as any[],
    readyAction: null,
    ...overrides,
  };
}

function reducerCombatant(id: string, opts: Record<string, unknown> = {}) {
  const isEnemy = id.startsWith('enemy');
  return {
    id,
    name: id,
    currentHP: 10,
    maxHP: 10,
    isAlly: !isEnemy,
    isEnemy,
    character: isEnemy ? null : { moveDistance: 6 },
    enemy: isEnemy ? { moveDistance: 6 } : null,
    position: { col: 0, row: 0 },
    statusEffects: [] as any[],
    conditions: [] as any[],
    ...opts,
  };
}

function makeReducerState(
  turnOrder: any[],
  combatStateOverrides: Record<string, unknown> = {}
): any {
  return {
    combatState: {
      active: true,
      combat: null,
      battlefield: null,
      turnOrder,
      currentTurnIndex: 0,
      round: 1,
      movementRemaining: 30,
      waitingForPlayerAction: true,
      turnState: freshTurnState(),
      ...combatStateOverrides,
    },
  };
}

describe('combatReducer — action economy (per-turn consumption)', () => {
  it('USE_COMBAT_ACTION consumes the action without touching the bonus action', () => {
    const state = makeReducerState([reducerCombatant('ally-0')]);
    const next = combatReducer(
      state,
      { type: 'USE_COMBAT_ACTION', payload: { actionType: 'action' } } as any,
      ACTIONS
    )!;

    expect(next.combatState!.turnState.actionUsed).toBe(true);
    expect(next.combatState!.turnState.bonusActionUsed).toBe(false);
    expect(state.combatState.turnState.actionUsed).toBe(false); // immutable update
  });

  it('USE_COMBAT_ACTION with actionType bonusAction consumes the bonus action', () => {
    const state = makeReducerState([reducerCombatant('ally-0')]);
    const next = combatReducer(
      state,
      { type: 'USE_COMBAT_ACTION', payload: { actionType: 'bonusAction' } } as any,
      ACTIONS
    )!;

    expect(next.combatState!.turnState.actionUsed).toBe(false);
    expect(next.combatState!.turnState.bonusActionUsed).toBe(true);
  });

  it('USE_COMBAT_BONUS_ACTION and USE_COMBAT_REACTION mark their slots used', () => {
    const state = makeReducerState([reducerCombatant('ally-0')]);
    const afterBonus = combatReducer(
      state,
      { type: 'USE_COMBAT_BONUS_ACTION', payload: {} } as any,
      ACTIONS
    )!;
    const afterReaction = combatReducer(
      afterBonus,
      { type: 'USE_COMBAT_REACTION', payload: {} } as any,
      ACTIONS
    )!;

    expect(afterReaction.combatState!.turnState.bonusActionUsed).toBe(true);
    expect(afterReaction.combatState!.turnState.reactionUsed).toBe(true);
  });

  it('USE_COMBAT_MOVEMENT deducts movement and accumulates movementUsed', () => {
    const state = makeReducerState([reducerCombatant('ally-0')]);
    const next = combatReducer(
      state,
      { type: 'USE_COMBAT_MOVEMENT', payload: { moveCost: 10 } } as any,
      ACTIONS
    )!;

    expect(next.combatState!.movementRemaining).toBe(20); // 30 − 10
    expect(next.combatState!.turnState.movementUsed).toBe(10);
  });

  it('USE_COMBAT_MOVEMENT clamps remaining movement at 0', () => {
    const state = makeReducerState([reducerCombatant('ally-0')]);
    const next = combatReducer(
      state,
      { type: 'USE_COMBAT_MOVEMENT', payload: { moveCost: 100 } } as any,
      ACTIONS
    )!;

    expect(next.combatState!.movementRemaining).toBe(0);
  });

  it('INCREMENT_ATTACK_COUNT tracks attacks made this turn', () => {
    const state = makeReducerState([reducerCombatant('ally-0')]);
    const next = combatReducer(
      state,
      { type: 'INCREMENT_ATTACK_COUNT', payload: {} } as any,
      ACTIONS
    )!;
    expect(next.combatState!.turnState.attacksMade).toBe(1);
  });

  it('RESET_COMBAT_TURN_STATE restores the full action economy and movement', () => {
    const state = makeReducerState([reducerCombatant('ally-0')], {
      movementRemaining: 0,
      turnState: freshTurnState({
        actionUsed: true,
        bonusActionUsed: true,
        reactionUsed: true,
        movementUsed: 30,
        attacksMade: 2,
      }),
    });

    const next = combatReducer(
      state,
      { type: 'RESET_COMBAT_TURN_STATE', payload: {} } as any,
      ACTIONS
    )!;

    expect(next.combatState!.turnState).toMatchObject({
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      attacksMade: 0,
    });
    expect(next.combatState!.movementRemaining).toBe(30); // moveDistance 6 × 5 ft
  });
});

describe('combatReducer — ADVANCE_COMBAT_TURN (turn advancement)', () => {
  it('advances to the next combatant and resets the turn state', () => {
    const state = makeReducerState(
      [reducerCombatant('ally-0'), reducerCombatant('enemy-0'), reducerCombatant('ally-1')],
      { turnState: freshTurnState({ actionUsed: true, attacksMade: 1, movementUsed: 15 }) }
    );

    const next = combatReducer(state, { type: 'ADVANCE_COMBAT_TURN', payload: {} } as any, ACTIONS)!;

    expect(next.combatState!.currentTurnIndex).toBe(1);
    expect(next.combatState!.round).toBe(1); // no wrap yet
    expect(next.combatState!.turnState).toMatchObject({
      actionUsed: false,
      bonusActionUsed: false,
      movementUsed: 0,
      attacksMade: 0,
    });
  });

  it('increments the round when the order wraps back to the start', () => {
    const state = makeReducerState(
      [reducerCombatant('ally-0'), reducerCombatant('enemy-0')],
      { currentTurnIndex: 1 }
    );

    const next = combatReducer(state, { type: 'ADVANCE_COMBAT_TURN', payload: {} } as any, ACTIONS)!;

    expect(next.combatState!.currentTurnIndex).toBe(0);
    expect(next.combatState!.round).toBe(2);
  });

  it('skips dead combatants when advancing', () => {
    const state = makeReducerState([
      reducerCombatant('ally-0'),
      reducerCombatant('enemy-0', { currentHP: 0 }),
      reducerCombatant('ally-1'),
    ]);

    const next = combatReducer(state, { type: 'ADVANCE_COMBAT_TURN', payload: {} } as any, ACTIONS)!;
    expect(next.combatState!.currentTurnIndex).toBe(2);
  });

  it('refreshes movement from the next combatant moveDistance and sets player-waiting flag', () => {
    const state = makeReducerState(
      [
        reducerCombatant('ally-0'),
        reducerCombatant('enemy-0', { enemy: { moveDistance: 4 } }),
      ],
      { movementRemaining: 5 }
    );

    const next = combatReducer(state, { type: 'ADVANCE_COMBAT_TURN', payload: {} } as any, ACTIONS)!;
    expect(next.combatState!.movementRemaining).toBe(20); // 4 hexes × 5 ft
    expect(next.combatState!.waitingForPlayerAction).toBe(false); // enemy turn

    const wrapped = combatReducer(next, { type: 'ADVANCE_COMBAT_TURN', payload: {} } as any, ACTIONS)!;
    expect(wrapped.combatState!.movementRemaining).toBe(30); // ally moveDistance 6 × 5
    expect(wrapped.combatState!.waitingForPlayerAction).toBe(true);
  });

  it('drops end_of_turn conditions but keeps longer-lived ones on advance', () => {
    const state = makeReducerState([reducerCombatant('ally-0'), reducerCombatant('enemy-0')], {
      turnState: freshTurnState({
        conditions: [
          { type: 'blessed', duration: 'end_of_turn' },
          { type: 'poisoned', duration: 'permanent' },
        ],
      }),
    });

    const next = combatReducer(state, { type: 'ADVANCE_COMBAT_TURN', payload: {} } as any, ACTIONS)!;
    expect(next.combatState!.turnState.conditions).toEqual([
      { type: 'poisoned', duration: 'permanent' },
    ]);
  });

  it('END_COMBAT clears combat state and returns to the overworld', () => {
    const state = makeReducerState([reducerCombatant('ally-0')]);
    const next = combatReducer(state, { type: 'END_COMBAT', payload: {} } as any, ACTIONS)!;
    expect(next.combatState).toBeNull();
    expect(next.currentScene).toBe('overworld');
  });

  it('returns null for actions it does not handle', () => {
    const state = makeReducerState([reducerCombatant('ally-0')]);
    expect(combatReducer(state, { type: 'NOT_A_COMBAT_ACTION', payload: {} } as any, ACTIONS)).toBeNull();
  });
});

// ─── Status effects & per-turn ticking on the Combat instance ────────────────

describe('Combat — status effects', () => {
  it('addStatusEffect / removeStatusEffect manage the combatant effect list', () => {
    const { combat, ally } = makeHexCombat();
    combat.addStatusEffect(ally as any, { name: 'Blessed', duration: 3 });
    combat.addStatusEffect(ally as any, { name: 'Poisoned', duration: 2 });
    expect(ally.statusEffects).toHaveLength(2);

    combat.removeStatusEffect(ally as any, 'Blessed');
    expect(ally.statusEffects).toEqual([{ name: 'Poisoned', duration: 2 }]);
  });

  it('tickStatusEffects decrements durations and removes expired effects', () => {
    const { combat, ally } = makeHexCombat();
    combat.addStatusEffect(ally as any, { name: 'Dodge', duration: 1 });
    combat.addStatusEffect(ally as any, { name: 'Curse', duration: 2 });
    combat.addStatusEffect(ally as any, { name: 'Permanent', effects: {} }); // no duration

    combat.tickStatusEffects(ally as any);
    expect(ally.statusEffects.map(e => e.name)).toEqual(['Curse', 'Permanent']);
    expect(ally.statusEffects[0].duration).toBe(1);

    combat.tickStatusEffects(ally as any);
    expect(ally.statusEffects.map(e => e.name)).toEqual(['Permanent']);
  });

  it('processDodge grants the 1-turn Dodge effect that expires on tick', () => {
    const { combat, ally } = makeHexCombat();
    const result = combat.processDodge('ally-0');

    expect(result.success).toBe(true);
    expect(ally.statusEffects[0]).toMatchObject({ name: 'Dodge', duration: 1 });

    combat.tickStatusEffects(ally as any); // start of the dodger's next turn
    expect(ally.statusEffects).toHaveLength(0);
  });

  it('processDodge and processDash fail for unknown combatants', () => {
    const { combat } = makeHexCombat();
    expect(combat.processDodge('ghost').success).toBe(false);
    expect(combat.processDash('ghost').success).toBe(false);
  });

  it('processDash succeeds for a known combatant', () => {
    const { combat } = makeHexCombat();
    const result = combat.processDash('ally-0');
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Dash/);
  });

  it('getRollTypeForAbilityCheck: Rage grants advantage on STR, Dodge on DEX saves', () => {
    const { combat, ally } = makeHexCombat();
    expect(combat.getRollTypeForAbilityCheck(ally as any, 'strength')).toBe('normal');

    ally.statusEffects.push({ name: 'Rage', effects: { strengthAdvantage: true } });
    expect(combat.getRollTypeForAbilityCheck(ally as any, 'strength')).toBe('advantage');
    expect(combat.getRollTypeForAbilityCheck(ally as any, 'dexterity')).toBe('normal');

    ally.statusEffects.push({ name: 'Dodge', duration: 1 });
    expect(combat.getRollTypeForAbilityCheck(ally as any, 'dexterity')).toBe('advantage');
  });
});

// ─── Misc public API ─────────────────────────────────────────────────────────

describe('Combat — misc public API', () => {
  it('getCombatantById finds combatants in the turn order', () => {
    const { combat, ally, foe } = makeHexCombat();
    expect(combat.getCombatantById('ally-0')).toBe(ally);
    expect(combat.getCombatantById('enemy-0')).toBe(foe);
    expect(combat.getCombatantById('missing')).toBeNull();
  });

  it('getXPForCR maps CR to XP and returns 0 for unknown CR', () => {
    expect(getXPForCR(0.25)).toBe(50);
    expect(getXPForCR(1)).toBe(200);
    expect(getXPForCR(5)).toBe(1800);
    expect(getXPForCR(0.3)).toBe(0);
    expect(CR_TO_XP[20]).toBe(25000);
  });

  it('_calculateXP sums XP across all enemies', () => {
    const combat = new Combat([makeHero()], [makeGoblin(), makeZombie()]); // 50 + 50
    expect(combat._calculateXP()).toBe(100);
  });

  it('generateCombatLog joins log lines with newlines', () => {
    const combat = new Combat([makeHero()], [makeGoblin()]);
    combat.log('line one');
    combat.log('line two');
    expect(combat.generateCombatLog()).toBe('line one\nline two');
  });

  it('processAbility fails cleanly for unknown combatants and unknown abilities', () => {
    const { combat } = makeHexCombat();
    expect(combat.processAbility('ghost', 'Second Wind').success).toBe(false);
    const result = combat.processAbility('ally-0', 'Totally Made Up');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/does not have ability/);
  });

  it('processSpell fails cleanly for unknown casters and unknown spells', () => {
    const { combat } = makeHexCombat();
    expect(combat.processSpell('ghost', 'Fire Bolt').success).toBe(false);
    const result = combat.processSpell('ally-0', 'Definitely Not A Spell');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Spell not found/);
  });
});
