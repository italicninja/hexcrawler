// Enemy — D&D 5e monster model
import { DiceRoller } from './DiceRoller';

interface Attack {
  name: string;
  damage: string;
  damageType: string;
  range?: number;
}

interface EnemyAbilities {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

interface StatTable {
  hp: number;
  ac: number;
  attackBonus: number;
  damagePerRound: number;
  saveDC: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  attacks: Attack[];
  multiattack?: number;
  moveDistance?: number;
  range?: number;
  // Tolerate per-creature extra fields without tripping excess-property checks
  [key: string]: unknown;
}

interface AttackResult {
  roll: number;
  modifier: number;
  total: number;
  hit: boolean;
  crit: boolean;
  targetAC: number;
}

export class Enemy {
  name: string;
  cr: number;
  type: string;
  family: string;
  variant: string | null;
  aiConfig: unknown;
  currentHP: number;
  isDead: boolean;
  specialAbilities: unknown[];
  // Assigned via applyStatsByCR(), called from the constructor
  maxHP!: number;
  ac!: number;
  attackBonus!: number;
  damagePerRound!: number;
  saveDC!: number;
  abilities!: EnemyAbilities;
  attacks!: Attack[];
  multiattack!: number;
  moveDistance!: number;
  range!: number;

  constructor(
    name: string,
    cr: number,
    type = 'generic',
    family: string | null = null,
    variant: string | null = null
  ) {
    this.name = name;
    this.cr = cr;
    this.type = type;

    this.family = family || this._inferFamilyFromType(type);
    this.variant = variant;
    this.aiConfig = null;

    // Pass name so applyStatsByCR can try the named creature table first
    this.applyStatsByCR(cr, name);
    this.currentHP = this.maxHP;
    this.isDead = false;
    this.specialAbilities = [];
    // Apply role overrides AFTER named/CR lookup for things like "Archer" variants
    // that share a base stat block but need different weapon loadouts.
    this._applyRoleOverrides(name);
  }

  /**
   * Apply stat overrides based on role keywords in the enemy name.
   * Runs after applyStatsByCR so role-specific values take precedence.
   * Allows named variants like "Goblin Archer" or "Skeleton Bowman" to have
   * ranged attacks without needing a separate CR table entry per role.
   */
  _applyRoleOverrides(name: string): void {
    const nameLower = (name || '').toLowerCase();

    // Skip role overrides for named creatures that already have full stat blocks —
    // their attacks are already correct from getStatTableByName().
    const hasNamedStatBlock = !!this.getStatTableByName(nameLower);
    if (hasNamedStatBlock) {
      // Only override weapons for archer/ranged roles that SHARE a base named block
      // (e.g. "Goblin Archer" shares Goblin stats but prefers shortbow)
      if (
        nameLower.includes('archer') ||
        nameLower.includes('bowman') ||
        nameLower.includes('shooter')
      ) {
        // Goblin shortbow: +4, 80/320 ft, 1d6+2 piercing (DEX mod already +2)
        this.range = 16; // 80 ft / 5 = 16 hexes (normal range)
        this.attacks = [{ name: 'Shortbow', damage: '1d6+2', damageType: 'piercing', range: 16 }];
      }
      return;
    }

    // Generic (non-named) role overrides based on name keywords
    // ── Archer / Bowman / Shooter ───────────────────────────────────────────
    if (
      nameLower.includes('archer') ||
      nameLower.includes('bowman') ||
      nameLower.includes('shooter')
    ) {
      this.range = 16; // 80-ft shortbow normal range
      this.attacks = [{ name: 'Shortbow', damage: '1d6+2', damageType: 'piercing', range: 16 }];
    }

    // ── Crossbowman ─────────────────────────────────────────────────────────
    else if (nameLower.includes('crossbow')) {
      this.range = 16; // 80-ft heavy crossbow
      this.attacks = [
        { name: 'Heavy Crossbow', damage: '1d10+1', damageType: 'piercing', range: 16 },
      ];
    }

    // ── Shaman / Mage / Wizard / Sorcerer / Warlock ─────────────────────────
    else if (
      nameLower.includes('shaman') ||
      nameLower.includes('mage') ||
      nameLower.includes('wizard') ||
      nameLower.includes('sorcerer') ||
      nameLower.includes('warlock')
    ) {
      this.range = 10; // 50-ft spell range
      this.attacks = [{ name: 'Eldritch Blast', damage: '1d10', damageType: 'force', range: 10 }];
    }

    // ── Spear / Javelin / Thrower ────────────────────────────────────────────
    else if (
      nameLower.includes('spear') ||
      nameLower.includes('javelin') ||
      nameLower.includes('thrower')
    ) {
      this.range = 6; // 30-ft thrown
      this.attacks = [{ name: 'Javelin', damage: '1d6+2', damageType: 'piercing', range: 6 }];
    }

    // ── Berserker / Warrior / Brute / Knight ────────────────────────────────
    // Explicitly melee — range stays at 1 from stat table
  }

  _inferFamilyFromType(type: string): string {
    const typeToFamily: Record<string, string> = {
      beast: 'beast',
      humanoid: 'humanoid',
      undead: 'undead',
      dragon: 'humanoid',
      goblinoid: 'goblinoid',
      generic: 'humanoid',
    };
    return typeToFamily[type.toLowerCase()] || 'humanoid';
  }

  applyStatsByCR(cr: number, name = ''): void {
    // Named lookup takes priority over generic CR bracket
    const namedTable = this.getStatTableByName(name);
    const statTable = namedTable || this.getStatTableByCR(cr);

    this.maxHP = statTable.hp;
    this.ac = statTable.ac;
    this.attackBonus = statTable.attackBonus;
    this.damagePerRound = statTable.damagePerRound;
    this.saveDC = statTable.saveDC;
    this.abilities = {
      strength: statTable.strength,
      dexterity: statTable.dexterity,
      constitution: statTable.constitution,
      intelligence: statTable.intelligence,
      wisdom: statTable.wisdom,
      charisma: statTable.charisma,
    };
    this.attacks = statTable.attacks;
    this.multiattack = statTable.multiattack || 1;
    this.moveDistance = statTable.moveDistance || 6;
    this.range = statTable.range || 1;
  }

  /**
   * Look up stats by creature name keywords.
   * Returns a full stat block if a match is found, otherwise null (fall back to CR table).
   * Stats sourced from MM 2025 / SRD 5.2.
   */
  getStatTableByName(name: string): StatTable | null {
    const n = (name || '').toLowerCase();

    // ── Goblinoid family ─────────────────────────────────────────────────────

    // Goblin (Warrior / Fighter / Scout / Archer — base goblin stats)
    // CR 1/4 | MM'25 p143
    if (
      n.includes('goblin') &&
      !n.includes('hexer') &&
      !n.includes('boss') &&
      !n.includes('king') &&
      !n.includes('warchief')
    ) {
      return {
        hp: 10, // 3d6
        ac: 15, // Leather armor + shield
        attackBonus: 4,
        damagePerRound: 5,
        saveDC: 12,
        strength: 8,
        dexterity: 15,
        constitution: 10,
        intelligence: 10,
        wisdom: 8,
        charisma: 8,
        // Default: scimitar (melee). _applyRoleOverrides will swap to shortbow for archers.
        attacks: [{ name: 'Scimitar', damage: '1d6+2', damageType: 'slashing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      };
    }

    // Goblin Hexer
    // CR 3 | MM'25 p143
    if (n.includes('goblin') && n.includes('hexer')) {
      return {
        hp: 45, // 10d6+10
        ac: 13,
        attackBonus: 5,
        damagePerRound: 12,
        saveDC: 13,
        strength: 8,
        dexterity: 16,
        constitution: 12,
        intelligence: 16,
        wisdom: 10,
        charisma: 10,
        attacks: [{ name: 'Hex Stick', damage: '2d8+3', damageType: 'psychic', range: 12 }],
        multiattack: 2,
        range: 12, // 60-ft melee-or-ranged hex stick
        moveDistance: 6,
      };
    }

    // Hobgoblin
    // CR 1/2 (treat as CR 1 for bracket purposes) | MM'25
    if (n.includes('hobgoblin') && !n.includes('warlord') && !n.includes('captain')) {
      return {
        hp: 18, // 4d8
        ac: 18, // Chain mail + shield
        attackBonus: 3,
        damagePerRound: 5,
        saveDC: 13,
        strength: 13,
        dexterity: 12,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 9,
        attacks: [{ name: 'Longsword', damage: '1d8+1', damageType: 'slashing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      };
    }

    // Bugbear
    // CR 1 | MM'25
    if (n.includes('bugbear') && !n.includes('chief')) {
      return {
        hp: 27, // 5d8+5
        ac: 14, // Hide armor
        attackBonus: 4,
        damagePerRound: 11,
        saveDC: 13,
        strength: 15,
        dexterity: 14,
        constitution: 13,
        intelligence: 8,
        wisdom: 11,
        charisma: 9,
        attacks: [{ name: 'Morningstar', damage: '2d8+2', damageType: 'piercing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      };
    }

    // ── Undead ───────────────────────────────────────────────────────────────

    // Skeleton
    // CR 1/4 | SRD 5.2
    if (n.includes('skeleton') && !n.includes('minotaur') && !n.includes('warhorse')) {
      return {
        hp: 13, // 2d8+4
        ac: 13, // Armor scraps
        attackBonus: 4,
        damagePerRound: 5,
        saveDC: 12,
        strength: 10,
        dexterity: 14,
        constitution: 15,
        intelligence: 6,
        wisdom: 8,
        charisma: 5,
        attacks: [{ name: 'Shortsword', damage: '1d6+2', damageType: 'piercing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      };
    }

    // Zombie
    // CR 1/4 | SRD 5.2
    if (n.includes('zombie')) {
      return {
        hp: 22, // 3d8+9
        ac: 8,
        attackBonus: 3,
        damagePerRound: 4,
        saveDC: 12,
        strength: 13,
        dexterity: 6,
        constitution: 16,
        intelligence: 3,
        wisdom: 6,
        charisma: 5,
        attacks: [{ name: 'Slam', damage: '1d6+1', damageType: 'bludgeoning', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 4,
      };
    }

    // Ghoul
    // CR 1 | SRD 5.2
    if (n.includes('ghoul') && !n.includes('ghast')) {
      return {
        hp: 22, // 5d8
        ac: 12,
        attackBonus: 2,
        damagePerRound: 7,
        saveDC: 10,
        strength: 13,
        dexterity: 15,
        constitution: 10,
        intelligence: 7,
        wisdom: 10,
        charisma: 6,
        attacks: [{ name: 'Claw', damage: '2d4+2', damageType: 'slashing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      };
    }

    // ── Beasts ───────────────────────────────────────────────────────────────

    // Wolf
    // CR 1/4 | SRD 5.2
    if (n.includes('wolf') && !n.includes('dire') && !n.includes('winter')) {
      return {
        hp: 11, // 2d8+2
        ac: 13, // Natural armor
        attackBonus: 4,
        damagePerRound: 7,
        saveDC: 11,
        strength: 12,
        dexterity: 15,
        constitution: 12,
        intelligence: 3,
        wisdom: 12,
        charisma: 6,
        attacks: [{ name: 'Bite', damage: '2d4+2', damageType: 'piercing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 8,
      };
    }

    // Dire Wolf
    // CR 1 | SRD 5.2
    if (n.includes('dire wolf') || (n.includes('dire') && n.includes('wolf'))) {
      return {
        hp: 37, // 5d10+10
        ac: 14,
        attackBonus: 5,
        damagePerRound: 10,
        saveDC: 13,
        strength: 17,
        dexterity: 15,
        constitution: 15,
        intelligence: 3,
        wisdom: 12,
        charisma: 7,
        attacks: [{ name: 'Bite', damage: '2d6+3', damageType: 'piercing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 10,
      };
    }

    // Brown Bear
    // CR 1 | SRD 5.2
    if (n.includes('bear') && !n.includes('polar') && !n.includes('cave') && !n.includes('black')) {
      return {
        hp: 34, // 4d10+12
        ac: 11,
        attackBonus: 5,
        damagePerRound: 11,
        saveDC: 13,
        strength: 19,
        dexterity: 10,
        constitution: 16,
        intelligence: 2,
        wisdom: 13,
        charisma: 7,
        attacks: [{ name: 'Claws', damage: '2d6+4', damageType: 'slashing', range: 1 }],
        multiattack: 2,
        range: 1,
        moveDistance: 8,
      };
    }

    // Boar
    // CR 1/4 | SRD 5.2
    if (n.includes('boar')) {
      return {
        hp: 11, // 2d8+2
        ac: 11,
        attackBonus: 3,
        damagePerRound: 5,
        saveDC: 11,
        strength: 13,
        dexterity: 11,
        constitution: 12,
        intelligence: 2,
        wisdom: 9,
        charisma: 5,
        attacks: [{ name: 'Tusk', damage: '1d6+1', damageType: 'slashing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 8,
      };
    }

    // ── Humanoid bandits / guards ─────────────────────────────────────────────

    // Bandit
    // CR 1/8 (treat similar to CR 0) | SRD 5.2
    if (n.includes('bandit') && !n.includes('captain')) {
      return {
        hp: 11, // 2d8+2
        ac: 12, // Leather armor
        attackBonus: 3,
        damagePerRound: 5,
        saveDC: 11,
        strength: 11,
        dexterity: 12,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        attacks: [{ name: 'Scimitar', damage: '1d6+1', damageType: 'slashing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      };
    }

    // Bandit Captain
    // CR 2 | SRD 5.2
    if (n.includes('bandit') && n.includes('captain')) {
      return {
        hp: 65, // 10d8+20
        ac: 15, // Studded leather
        attackBonus: 5,
        damagePerRound: 18,
        saveDC: 13,
        strength: 15,
        dexterity: 16,
        constitution: 14,
        intelligence: 14,
        wisdom: 11,
        charisma: 14,
        attacks: [{ name: 'Scimitar', damage: '1d6+3', damageType: 'slashing', range: 1 }],
        multiattack: 3,
        range: 1,
        moveDistance: 6,
      };
    }

    // Guard
    // CR 1/8 | SRD 5.2
    if (n.includes('guard') || n.includes('soldier')) {
      return {
        hp: 11,
        ac: 16, // Chain shirt + shield
        attackBonus: 3,
        damagePerRound: 4,
        saveDC: 11,
        strength: 13,
        dexterity: 12,
        constitution: 12,
        intelligence: 10,
        wisdom: 11,
        charisma: 10,
        attacks: [{ name: 'Spear', damage: '1d6+1', damageType: 'piercing', range: 1 }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      };
    }

    // No named match — fall back to CR bracket table
    return null;
  }

  getStatTableByCR(cr: number): StatTable {
    const tables: Record<number, StatTable> = {
      0: {
        hp: 7,
        ac: 13,
        attackBonus: 3,
        damagePerRound: 2,
        saveDC: 13,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 8,
        wisdom: 10,
        charisma: 8,
        attacks: [{ name: 'Slam', damage: '1d4', damageType: 'bludgeoning' }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      },
      1: {
        hp: 36,
        ac: 13,
        attackBonus: 3,
        damagePerRound: 7,
        saveDC: 13,
        strength: 12,
        dexterity: 12,
        constitution: 12,
        intelligence: 8,
        wisdom: 10,
        charisma: 8,
        attacks: [{ name: 'Strike', damage: '1d8+1', damageType: 'slashing' }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      },
      2: {
        hp: 52,
        ac: 13,
        attackBonus: 4,
        damagePerRound: 11,
        saveDC: 13,
        strength: 14,
        dexterity: 12,
        constitution: 14,
        intelligence: 8,
        wisdom: 10,
        charisma: 8,
        attacks: [{ name: 'Weapon Attack', damage: '1d8+2', damageType: 'slashing' }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      },
      3: {
        hp: 66,
        ac: 13,
        attackBonus: 4,
        damagePerRound: 15,
        saveDC: 13,
        strength: 14,
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 12,
        charisma: 10,
        attacks: [{ name: 'Claw', damage: '2d6+2', damageType: 'slashing' }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      },
      4: {
        hp: 84,
        ac: 14,
        attackBonus: 5,
        damagePerRound: 21,
        saveDC: 14,
        strength: 16,
        dexterity: 12,
        constitution: 16,
        intelligence: 10,
        wisdom: 12,
        charisma: 10,
        attacks: [{ name: 'Bite', damage: '2d8+3', damageType: 'piercing' }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      },
      5: {
        hp: 95,
        ac: 15,
        attackBonus: 6,
        damagePerRound: 27,
        saveDC: 15,
        strength: 16,
        dexterity: 14,
        constitution: 16,
        intelligence: 10,
        wisdom: 12,
        charisma: 10,
        attacks: [{ name: 'Greataxe', damage: '2d10+3', damageType: 'slashing' }],
        multiattack: 1,
        range: 1,
        moveDistance: 6,
      },
      6: {
        hp: 112,
        ac: 15,
        attackBonus: 6,
        damagePerRound: 33,
        saveDC: 15,
        strength: 18,
        dexterity: 14,
        constitution: 18,
        intelligence: 10,
        wisdom: 12,
        charisma: 10,
        attacks: [{ name: 'Tail Attack', damage: '2d10+4', damageType: 'bludgeoning' }],
        multiattack: 2,
        range: 1,
        moveDistance: 6,
      },
      7: {
        hp: 133,
        ac: 15,
        attackBonus: 6,
        damagePerRound: 39,
        saveDC: 15,
        strength: 18,
        dexterity: 14,
        constitution: 18,
        intelligence: 12,
        wisdom: 14,
        charisma: 12,
        attacks: [{ name: 'Boulder', damage: '3d10+4', damageType: 'bludgeoning', range: 20 }],
        multiattack: 2,
        range: 20,
      },
      8: {
        hp: 136,
        ac: 16,
        attackBonus: 7,
        damagePerRound: 45,
        saveDC: 16,
        strength: 20,
        dexterity: 14,
        constitution: 20,
        intelligence: 12,
        wisdom: 14,
        charisma: 12,
        attacks: [{ name: 'Greatsword', damage: '4d8+5', damageType: 'slashing' }],
        multiattack: 2,
        range: 1,
      },
      9: {
        hp: 145,
        ac: 16,
        attackBonus: 7,
        damagePerRound: 51,
        saveDC: 16,
        strength: 20,
        dexterity: 16,
        constitution: 20,
        intelligence: 14,
        wisdom: 14,
        charisma: 14,
        attacks: [{ name: 'Fang', damage: '4d10+5', damageType: 'piercing' }],
        multiattack: 2,
        range: 1,
      },
      10: {
        hp: 157,
        ac: 17,
        attackBonus: 7,
        damagePerRound: 57,
        saveDC: 16,
        strength: 22,
        dexterity: 16,
        constitution: 22,
        intelligence: 14,
        wisdom: 16,
        charisma: 14,
        attacks: [{ name: 'Breath Weapon', damage: '5d10+6', damageType: 'fire', range: 20 }],
        multiattack: 2,
        range: 20,
      },
      11: {
        hp: 175,
        ac: 17,
        attackBonus: 8,
        damagePerRound: 63,
        saveDC: 17,
        strength: 22,
        dexterity: 16,
        constitution: 22,
        intelligence: 16,
        wisdom: 16,
        charisma: 16,
        attacks: [{ name: 'Legendary Strike', damage: '6d10+6', damageType: 'force' }],
        multiattack: 3,
        range: 1,
      },
    };

    if (tables[cr]) return tables[cr];

    const availableCRs = Object.keys(tables)
      .map(Number)
      .sort((a, b) => a - b);
    for (let i = availableCRs.length - 1; i >= 0; i--) {
      if (availableCRs[i] <= cr) return tables[availableCRs[i]];
    }
    return tables[0];
  }

  takeDamage(amount: number): boolean {
    this.currentHP = Math.max(0, this.currentHP - amount);
    if (this.currentHP === 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  checkIsDead(): boolean {
    return this.isDead || this.currentHP <= 0;
  }

  rollAttack(target: { armorClass: number }, diceRoller: DiceRoller): AttackResult {
    const roll = diceRoller.rollD20();
    const total = roll + this.attackBonus;
    const hit = roll === 20 || (roll !== 1 && total >= target.armorClass);
    const crit = roll === 20;
    return { roll, modifier: this.attackBonus, total, hit, crit, targetAC: target.armorClass };
  }

  rollDamage(
    isCrit: boolean,
    diceRoller: DiceRoller,
    attackIndex = 0
  ): { damage: number; damageType: string; attackName: string } {
    const attack = this.attacks[attackIndex] || this.attacks[0];
    let damage = diceRoller.damageRoll(attack.damage);
    if (isCrit) {
      damage += diceRoller.damageRoll(attack.damage);
    }
    return { damage, damageType: attack.damageType, attackName: attack.name };
  }

  getModifier(ability: keyof EnemyAbilities): number {
    const score = this.abilities[ability];
    return Math.floor((score - 10) / 2);
  }

  addSpecialAbility(ability: unknown): void {
    this.specialAbilities.push(ability);
  }

  toJSON() {
    return {
      name: this.name,
      cr: this.cr,
      type: this.type,
      family: this.family,
      variant: this.variant,
      maxHP: this.maxHP,
      currentHP: this.currentHP,
      ac: this.ac,
      attackBonus: this.attackBonus,
      damagePerRound: this.damagePerRound,
      saveDC: this.saveDC,
      abilities: { ...this.abilities },
      attacks: [...this.attacks],
      multiattack: this.multiattack,
      isDead: this.isDead,
      specialAbilities: [...this.specialAbilities],
      range: this.range,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): Enemy {
    const enemy = new Enemy(data.name, data.cr, data.type, data.family, data.variant);
    enemy.currentHP = data.currentHP;
    enemy.isDead = data.isDead || false;
    enemy.specialAbilities = data.specialAbilities || [];
    enemy.range = data.range || 1;
    return enemy;
  }

  static parseCreatureString(
    creatureString: string,
    cr: number,
    diceRoller: DiceRoller,
    family: string | null = null,
    variant: string | null = null
  ): Enemy[] {
    const match = creatureString.match(/^(\d+d\d+|\d+)\s+(.+)$/i);

    if (!match) {
      return [new Enemy(creatureString, cr, 'generic', family, variant)];
    }

    const countPart = match[1];
    const namePart = match[2];

    let count: number;
    if (countPart.includes('d')) {
      const [numDice, diceSize] = countPart.split('d').map(Number);
      count = diceRoller.rollDice(diceSize, numDice);
    } else {
      count = parseInt(countPart, 10);
    }

    const inferredType = this._inferTypeFromName(namePart);

    const enemies: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const enemyName = count > 1 ? `${namePart} #${i + 1}` : namePart;
      enemies.push(new Enemy(enemyName, cr, inferredType, family, variant));
    }

    return enemies;
  }

  static _inferTypeFromName(name: string): string {
    const nameLower = name.toLowerCase();
    if (
      nameLower.includes('goblin') ||
      nameLower.includes('hobgoblin') ||
      nameLower.includes('bugbear')
    )
      return 'goblinoid';
    if (nameLower.includes('wolf') || nameLower.includes('bear') || nameLower.includes('boar'))
      return 'beast';
    if (
      nameLower.includes('skeleton') ||
      nameLower.includes('zombie') ||
      nameLower.includes('undead')
    )
      return 'undead';
    if (nameLower.includes('dragon')) return 'dragon';
    return 'humanoid';
  }
}

export default Enemy;
