/**
 * Enemy - D&D 5e Enemy/Monster Class
 * Represents hostile creatures in combat with CR-based stat generation
 */

import { DiceRoller } from './DiceRoller.js';

export class Enemy {
  constructor(name, cr, type = 'generic') {
    this.name = name;
    this.cr = cr;
    this.type = type; // beast, humanoid, undead, dragon, etc.

    // Apply CR-based stats
    this.applyStatsByCR(cr);

    // Current HP starts at max
    this.currentHP = this.maxHP;

    // Combat state
    this.isDead = false;

    // Special abilities (for tactical AI)
    this.specialAbilities = [];
    this.range = 1; // Default melee range (set by stat table)
  }

  /**
   * Apply stats based on Challenge Rating
   * Uses D&D 5e Monster Statistics by Challenge Rating guidelines
   */
  applyStatsByCR(cr) {
    const statTable = this.getStatTableByCR(cr);

    this.maxHP = statTable.hp;
    this.ac = statTable.ac;
    this.attackBonus = statTable.attackBonus;
    this.damagePerRound = statTable.damagePerRound;
    this.saveDC = statTable.saveDC;

    // Ability scores (estimated based on CR)
    this.abilities = {
      strength: statTable.strength,
      dexterity: statTable.dexterity,
      constitution: statTable.constitution,
      intelligence: statTable.intelligence,
      wisdom: statTable.wisdom,
      charisma: statTable.charisma
    };

    // Attack configuration
    this.attacks = statTable.attacks;
    this.multiattack = statTable.multiattack || 1;
  }

  /**
   * Get stat table by CR (based on DMG p. 274)
   */
  getStatTableByCR(cr) {
    const tables = {
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
        range: 1
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
        range: 1
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
        range: 1
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
        range: 1
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
        range: 1
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
        range: 1
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
        range: 1
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
        attacks: [{ name: 'Boulder', damage: '3d10+4', damageType: 'bludgeoning' }],
        multiattack: 2,
        range: 20
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
        range: 1
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
        range: 1
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
        attacks: [{ name: 'Breath Weapon', damage: '5d10+6', damageType: 'fire' }],
        multiattack: 2,
        range: 20
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
        range: 1
      }
    };

    // Return exact CR or nearest lower CR
    if (tables[cr]) {
      return tables[cr];
    }

    // Find nearest lower CR
    const availableCRs = Object.keys(tables).map(Number).sort((a, b) => a - b);
    for (let i = availableCRs.length - 1; i >= 0; i--) {
      if (availableCRs[i] <= cr) {
        return tables[availableCRs[i]];
      }
    }

    // Fallback to CR 0
    return tables[0];
  }

  /**
   * Take damage
   * @param {number} amount - Damage to take
   * @returns {boolean} True if enemy dies
   */
  takeDamage(amount) {
    this.currentHP = Math.max(0, this.currentHP - amount);

    if (this.currentHP === 0) {
      this.isDead = true;
      return true;
    }

    return false;
  }

  /**
   * Check if enemy is dead
   * @returns {boolean}
   */
  checkIsDead() {
    return this.isDead || this.currentHP <= 0;
  }

  /**
   * Roll attack against target
   * @param {object} target - Character or Enemy to attack
   * @param {DiceRoller} diceRoller - DiceRoller instance
   * @returns {object} Attack result { hit, crit, roll, total }
   */
  rollAttack(target, diceRoller) {
    const roll = diceRoller.rollD20();
    const total = roll + this.attackBonus;

    // Natural 20 is always a hit (and crit)
    // Natural 1 is always a miss
    const hit = roll === 20 || (roll !== 1 && total >= target.armorClass);
    const crit = roll === 20;

    return {
      roll,
      modifier: this.attackBonus,
      total,
      hit,
      crit,
      targetAC: target.armorClass
    };
  }

  /**
   * Roll damage for attack
   * @param {boolean} isCrit - Whether this is a critical hit
   * @param {DiceRoller} diceRoller - DiceRoller instance
   * @param {number} attackIndex - Which attack to use (for multiattack)
   * @returns {object} Damage result { damage, damageType, attackName }
   */
  rollDamage(isCrit, diceRoller, attackIndex = 0) {
    const attack = this.attacks[attackIndex] || this.attacks[0];

    // Roll damage dice
    let damage = diceRoller.damageRoll(attack.damage);

    // Double damage on crit (D&D 5e rule: double dice, not modifiers)
    if (isCrit) {
      damage += diceRoller.damageRoll(attack.damage);
    }

    return {
      damage,
      damageType: attack.damageType,
      attackName: attack.name
    };
  }

  /**
   * Get ability modifier
   */
  getModifier(ability) {
    const score = this.abilities[ability];
    return Math.floor((score - 10) / 2);
  }

  /**
   * Add a special ability to this enemy
   */
  addSpecialAbility(ability) {
    this.specialAbilities.push(ability);
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      name: this.name,
      cr: this.cr,
      type: this.type,
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
      range: this.range
    };
  }

  /**
   * Load from JSON
   */
  static fromJSON(data) {
    const enemy = new Enemy(data.name, data.cr, data.type);
    enemy.currentHP = data.currentHP;
    enemy.isDead = data.isDead || false;
    enemy.specialAbilities = data.specialAbilities || [];
    enemy.range = data.range || 1;
    return enemy;
  }

  /**
   * Parse creature string (e.g., "2d4 Goblins") into Enemy instances
   * @param {string} creatureString - String like "2d4 Goblins", "1 Young Dragon"
   * @param {number} cr - Challenge Rating for the encounter
   * @param {DiceRoller} diceRoller - DiceRoller instance for random generation
   * @returns {Array<Enemy>} Array of Enemy instances
   */
  static parseCreatureString(creatureString, cr, diceRoller) {
    // Parse patterns like "2d4 Goblins", "1 Young Dragon", "1d2 Hill Giants"
    const match = creatureString.match(/^(\d+d\d+|\d+)\s+(.+)$/i);

    if (!match) {
      // Fallback: create a single enemy with the full string as name
      return [new Enemy(creatureString, cr)];
    }

    const countPart = match[1];
    const namePart = match[2];

    // Determine count
    let count;
    if (countPart.includes('d')) {
      // Roll dice (e.g., "2d4")
      const [numDice, diceSize] = countPart.split('d').map(Number);
      count = diceRoller.rollDice(diceSize, numDice);
    } else {
      // Fixed number
      count = parseInt(countPart);
    }

    // Create enemies
    const enemies = [];
    for (let i = 0; i < count; i++) {
      const enemyName = count > 1 ? `${namePart} #${i + 1}` : namePart;
      enemies.push(new Enemy(enemyName, cr));
    }

    return enemies;
  }
}

export default Enemy;
