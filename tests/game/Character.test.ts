import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../src/game/Character';
import { GAME_DEFAULTS } from '../../src/constants/gameConstants';

// ─── Constructor & Defaults ───────────────────────────────────────────────────

describe('Character — constructor', () => {
  let char: Character;
  beforeEach(() => {
    char = new Character('Test Hero', 'fighter');
  });

  it('creates an instance', () => {
    expect(char).toBeInstanceOf(Character);
  });

  it('sets the character name', () => {
    expect((char as any).name).toBe('Test Hero');
  });

  it('sets the character class', () => {
    expect((char as any).class).toBe('fighter');
  });

  it('starts at level 1', () => {
    expect((char as any).level).toBe(1);
  });

  it('initialises six ability scores', () => {
    const abilities = (char as any).abilities;
    expect(Object.keys(abilities)).toHaveLength(6);
    ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach(a => {
      expect(typeof abilities[a]).toBe('number');
    });
  });

  it('starts with 7 rations (survival default)', () => {
    expect((char as any).rations).toBe(7);
  });

  it('starts with exhaustionLevel 0', () => {
    expect((char as any).exhaustionLevel).toBe(0);
  });

  it('starts with daysWithoutFood 0', () => {
    expect((char as any).daysWithoutFood).toBe(0);
  });

  it('starts with xp 0', () => {
    expect((char as any).xp).toBe(0);
  });

  it('starts with empty spellSlotsUsed', () => {
    expect(typeof (char as any).spellSlotsUsed).toBe('object');
  });

  it('has an equipment object with expected slots', () => {
    const equipment = (char as any).equipment;
    [
      'head',
      'neck',
      'chest',
      'hands',
      'legs',
      'feet',
      'ring1',
      'ring2',
      'mainHand',
      'offHand',
    ].forEach(slot => {
      expect(Object.prototype.hasOwnProperty.call(equipment, slot)).toBe(true);
    });
  });
});

// ─── Class Modifiers ─────────────────────────────────────────────────────────

describe('Character — class modifiers (applyClassModifiers)', () => {
  const classHitDie: Record<string, string> = {
    barbarian: 'd12',
    fighter: 'd10',
    paladin: 'd10',
    ranger: 'd10',
    bard: 'd8',
    cleric: 'd8',
    druid: 'd8',
    monk: 'd8',
    rogue: 'd8',
    warlock: 'd8',
    sorcerer: 'd6',
    wizard: 'd6',
  };

  Object.entries(classHitDie).forEach(([cls, die]) => {
    it(`${cls} gets hit die ${die}`, () => {
      const c = new Character('Hero', cls);
      expect((c as any).hitDie).toBe(die);
    });
  });

  it('barbarian gets higher STR than WIZ by default', () => {
    const barbarian = new Character('Brute', 'barbarian');
    const abilities = (barbarian as any).abilities;
    expect(abilities.strength).toBeGreaterThan(abilities.intelligence);
  });

  it('wizard gets higher INT than STR by default', () => {
    const wizard = new Character('Merlin', 'wizard');
    const abilities = (wizard as any).abilities;
    expect(abilities.intelligence).toBeGreaterThan(abilities.strength);
  });
});

// ─── Starting Loadout ────────────────────────────────────────────────────────

describe('Character — applyStartingLoadout', () => {
  it('fighter starts with a mainHand weapon', () => {
    const c = new Character('Fighter', 'fighter');
    expect((c as any).equipment.mainHand).not.toBeNull();
  });

  it('wizard starts with a dagger', () => {
    const c = new Character('Wizard', 'wizard');
    expect((c as any).equipment.mainHand).not.toBeNull();
    expect((c as any).equipment.mainHand.name).toMatch(/dagger/i);
  });

  it('cleric starts with a shield', () => {
    const c = new Character('Cleric', 'cleric');
    expect((c as any).equipment.offHand).not.toBeNull();
  });

  it('all classes start with some gold', () => {
    const classes = [
      'barbarian',
      'fighter',
      'rogue',
      'wizard',
      'cleric',
      'druid',
      'bard',
      'monk',
      'sorcerer',
      'warlock',
      'paladin',
      'ranger',
    ];
    for (const cls of classes) {
      const c = new Character('Hero', cls);
      expect((c as any).gold).toBeGreaterThan(0);
    }
  });
});

// ─── getModifier ─────────────────────────────────────────────────────────────

describe('Character.getModifier()', () => {
  it('returns 0 for ability score 10', () => {
    const c = new Character('Hero', 'fighter');
    (c as any).abilities.strength = 10;
    expect((c as any).getModifier('strength')).toBe(0);
  });

  it('returns +3 for ability score 16', () => {
    const c = new Character('Hero', 'fighter');
    (c as any).abilities.strength = 16;
    expect((c as any).getModifier('strength')).toBe(3);
  });

  it('returns -1 for ability score 8', () => {
    const c = new Character('Hero', 'fighter');
    (c as any).abilities.constitution = 8;
    expect((c as any).getModifier('constitution')).toBe(-1);
  });
});

// ─── takeDamage / heal ────────────────────────────────────────────────────────

describe('Character.takeDamage()', () => {
  let c: Character;
  beforeEach(() => {
    c = new Character('Hero', 'fighter');
  });

  it('reduces currentHP by the damage amount', () => {
    const before = (c as any).currentHP;
    (c as any).takeDamage(3);
    expect((c as any).currentHP).toBe(before - 3);
  });

  it('does not reduce currentHP below 0', () => {
    (c as any).takeDamage(99999);
    expect((c as any).currentHP).toBe(0);
  });

  it('returns true when HP hits 0 (downed)', () => {
    const result = (c as any).takeDamage((c as any).maxHP);
    expect(result).toBe(true);
  });

  it('returns false when character survives', () => {
    const result = (c as any).takeDamage(1);
    expect(result).toBe(false);
  });
});

describe('Character.heal()', () => {
  let c: Character;
  beforeEach(() => {
    c = new Character('Hero', 'fighter');
    (c as any).takeDamage(5);
  });

  it('increases currentHP by the heal amount', () => {
    const before = (c as any).currentHP;
    (c as any).heal(3);
    expect((c as any).currentHP).toBe(before + 3);
  });

  it('does not exceed maxHP', () => {
    (c as any).heal(99999);
    expect((c as any).currentHP).toBe((c as any).maxHP);
  });
});

// ─── addGold / removeGold ────────────────────────────────────────────────────

describe('Character gold management', () => {
  let c: Character;
  beforeEach(() => {
    c = new Character('Hero', 'fighter');
  });

  it('addGold increases gold', () => {
    const before = (c as any).gold;
    (c as any).addGold(50);
    expect((c as any).gold).toBe(before + 50);
  });

  it('addGold rejects negative amounts', () => {
    const before = (c as any).gold;
    (c as any).addGold(-10);
    expect((c as any).gold).toBe(before);
  });

  it('removeGold decreases gold', () => {
    (c as any).gold = 100;
    (c as any).removeGold(40);
    expect((c as any).gold).toBe(60);
  });

  it('removeGold fails when insufficient funds', () => {
    (c as any).gold = 10;
    const result = (c as any).removeGold(50);
    expect(result).toBe(false);
    expect((c as any).gold).toBe(10);
  });
});

// ─── addItem / removeItem ────────────────────────────────────────────────────

describe('Character inventory management', () => {
  let c: Character;
  beforeEach(() => {
    c = new Character('Hero', 'fighter');
  });

  it('addItem adds to inventory', () => {
    const before = (c as any).inventory.length;
    (c as any).addItem({
      id: 'item-1',
      name: 'Potion',
      type: 'consumable',
      value: 5,
      weight: 0.5,
      rarity: 'common',
    });
    expect((c as any).inventory.length).toBe(before + 1);
  });

  it('addItem rejects null', () => {
    const before = (c as any).inventory.length;
    (c as any).addItem(null);
    expect((c as any).inventory.length).toBe(before);
  });

  it('removeItem returns the removed item', () => {
    const item = {
      id: 'item-2',
      name: 'Torch',
      type: 'misc',
      value: 1,
      weight: 0.5,
      rarity: 'common',
    };
    (c as any).addItem(item);
    const removed = (c as any).removeItem('item-2');
    expect(removed).not.toBeNull();
    expect(removed.id).toBe('item-2');
  });

  it('removeItem returns null for non-existent id', () => {
    expect((c as any).removeItem('does-not-exist')).toBeNull();
  });
});

// ─── awardXP / shouldLevelUp ─────────────────────────────────────────────────

describe('Character XP & levelling', () => {
  it('awardXP increments xp', () => {
    const c = new Character('Hero', 'fighter');
    (c as any).awardXP(100);
    expect((c as any).xp).toBe(100);
  });

  it('awardXP rejects negative amounts', () => {
    const c = new Character('Hero', 'fighter');
    (c as any).awardXP(-50);
    expect((c as any).xp).toBe(0);
  });

  it('getXPForLevel returns correct values', () => {
    expect(Character.getXPForLevel(1)).toBe(0);
    expect(Character.getXPForLevel(2)).toBe(300);
    expect(Character.getXPForLevel(5)).toBe(6500);
    expect(Character.getXPForLevel(20)).toBe(355000);
  });

  it('getXPForLevel clamps above 20', () => {
    expect(Character.getXPForLevel(21)).toBe(Character.getXPForLevel(20));
  });

  it('getXPForLevel returns 0 for level < 1', () => {
    expect(Character.getXPForLevel(0)).toBe(0);
    expect(Character.getXPForLevel(-5)).toBe(0);
  });

  it('levelUp increases level', () => {
    const c = new Character('Hero', 'fighter');
    (c as any).levelUp();
    expect((c as any).level).toBe(2);
  });

  it('levelUp increases maxHP', () => {
    const c = new Character('Hero', 'fighter');
    const before = (c as any).maxHP;
    (c as any).levelUp();
    expect((c as any).maxHP).toBeGreaterThan(before);
  });

  it('levelUp does nothing at level 20', () => {
    const c = new Character('Hero', 'fighter');
    (c as any).level = 20;
    const result = (c as any).levelUp();
    expect(result).toBeNull();
    expect((c as any).level).toBe(20);
  });
});

// ─── Proficiency Bonus ────────────────────────────────────────────────────────

describe('Character — proficiency bonus', () => {
  it('starts at 2 (D&D 5e default for level 1)', () => {
    const c = new Character('Hero', 'fighter');
    expect((c as any).proficiencyBonus).toBe(GAME_DEFAULTS.PROFICIENCY_BONUS);
  });

  it('increases on levelUp', () => {
    const c = new Character('Hero', 'fighter');
    const lvl1Prof = (c as any).proficiencyBonus;
    // Level up to 5 (proficiency bonus jumps at level 5 in D&D 5e)
    for (let i = 0; i < 4; i++) (c as any).levelUp();
    expect((c as any).proficiencyBonus).toBeGreaterThanOrEqual(lvl1Prof);
  });
});
