/**
 * DiceRoller - D&D 5e Dice Rolling System
 * Handles d20 rolls, skill checks, saving throws, and damage rolls
 */

import logger from '../utils/logger.js';

export class DiceRoller {
  constructor(seed = null, logger = null) {
    this.seed = seed;
    this.rng = seed !== null ? this.createSeededRNG(seed) : null;
    this.logger = logger; // Optional callback function (message, type) => void
  }

  /**
   * Create a seeded random number generator
   * Uses same approach as TerrainGenerator for consistency
   */
  createSeededRNG(seed) {
    let seedValue = 0;
    for (let i = 0; i < seed.length; i++) {
      seedValue = (seedValue << 5) - seedValue + seed.charCodeAt(i);
      seedValue = seedValue & seedValue; // Convert to 32bit integer
    }

    return () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
  }

  /**
   * Get random number (0-1)
   * Uses seeded RNG if available, otherwise Math.random()
   */
  random() {
    return this.rng ? this.rng() : Math.random();
  }

  /**
   * Log a dice roll result to the logger if available
   * @param {string} message - Log message
   * @param {string} type - Message type ('info', 'success', 'warning', 'error')
   */
  log(message, type = 'info') {
    if (this.logger) {
      this.logger(message, type);
    }
  }

  /**
   * Roll a d20
   * @returns {number} 1-20
   */
  rollD20() {
    return Math.floor(this.random() * 20) + 1;
  }

  /**
   * Roll NdX dice (e.g., 3d6, 2d8)
   * @param {number} sides - Number of sides per die
   * @param {number} count - Number of dice to roll
   * @returns {number} Total of all dice
   */
  rollDice(sides, count = 1) {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(this.random() * sides) + 1;
    }
    return total;
  }

  /**
   * Roll with advantage (roll twice, take higher)
   * @returns {number} Higher of two d20 rolls
   */
  rollWithAdvantage() {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    return Math.max(roll1, roll2);
  }

  /**
   * Roll with disadvantage (roll twice, take lower)
   * @returns {number} Lower of two d20 rolls
   */
  rollWithDisadvantage() {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    return Math.min(roll1, roll2);
  }

  /**
   * Get ability modifier from ability score
   * @param {number} abilityScore - Ability score (1-30)
   * @returns {number} Modifier (-5 to +10)
   */
  getAbilityModifier(abilityScore) {
    return Math.floor((abilityScore - 10) / 2);
  }

  /**
   * Perform a skill check
   * @param {object} character - Character object with ability scores
   * @param {string} ability - Ability name ('strength', 'dexterity', etc.)
   * @param {boolean} proficient - Whether character is proficient in this skill
   * @param {number} dc - Difficulty class
   * @param {string} rollType - 'normal', 'advantage', 'disadvantage'
   * @param {string} skillName - Optional skill name for logging (e.g., 'Perception', 'Stealth')
   * @returns {object} { roll, modifier, total, success, dc }
   */
  skillCheck(character, ability, proficient = false, dc = 10, rollType = 'normal', skillName = null) {
    // Validate character object
    if (!character) {
      throw new Error('DiceRoller.skillCheck: character is required');
    }

    // Get ability score
    const abilityScore = character[ability] || 10;
    const modifier = this.getAbilityModifier(abilityScore);
    const proficiencyBonus = proficient ? (character.proficiencyBonus || 2) : 0;

    // Roll d20
    let roll;
    let rollText = '';
    if (rollType === 'advantage') {
      roll = this.rollWithAdvantage();
      rollText = ' (advantage)';
    } else if (rollType === 'disadvantage') {
      roll = this.rollWithDisadvantage();
      rollText = ' (disadvantage)';
    } else {
      roll = this.rollD20();
    }

    const total = roll + modifier + proficiencyBonus;
    const success = total >= dc;

    // Log if logger is available and DC > 0 (DC=0 means manual logging is handled elsewhere)
    if (this.logger && skillName && dc > 0) {
      const displayName = skillName || ability.charAt(0).toUpperCase() + ability.slice(1);
      const result = success ? 'Success' : 'Failed';
      this.log(
        `${displayName}${rollText} ${roll}+${modifier + proficiencyBonus}=${total} vs DC ${dc}: ${result}`,
        success ? 'success' : 'warning'
      );
    }

    return {
      roll,
      modifier: modifier + proficiencyBonus,
      total,
      success,
      dc
    };
  }

  /**
   * Perception check (Wisdom-based)
   * @param {object} character - Character object
   * @param {number} dc - Difficulty class (default 10)
   * @param {string} rollType - 'normal', 'advantage', 'disadvantage'
   * @returns {object} Check result
   */
  perceptionCheck(character, dc = 10, rollType = 'normal') {
    return this.skillCheck(character, 'wisdom', true, dc, rollType, 'Perception');
  }

  /**
   * Investigation check (Intelligence-based)
   * @param {object} character - Character object
   * @param {number} dc - Difficulty class (default 10)
   * @param {string} rollType - 'normal', 'advantage', 'disadvantage'
   * @returns {object} Check result
   */
  investigationCheck(character, dc = 10, rollType = 'normal') {
    return this.skillCheck(character, 'intelligence', true, dc, rollType, 'Investigation');
  }

  /**
   * Saving throw
   * @param {object} character - Character object
   * @param {string} ability - Save type ('strength', 'dexterity', 'constitution', etc.)
   * @param {number} dc - Difficulty class
   * @param {string} rollType - 'normal', 'advantage', 'disadvantage'
   * @returns {object} Save result
   */
  savingThrow(character, ability, dc = 10, rollType = 'normal') {
    // Validate character object
    if (!character) {
      throw new Error('DiceRoller.savingThrow: character is required');
    }

    // Check if character has proficiency in this save
    const saveProficiencies = character.saveProficiencies || [];
    const proficient = saveProficiencies.includes(ability);

    const saveName = ability.charAt(0).toUpperCase() + ability.slice(1) + ' Save';
    return this.skillCheck(character, ability, proficient, dc, rollType, saveName);
  }

  /**
   * Attack roll
   * @param {object} character - Character object
   * @param {string} attackType - 'melee' or 'ranged'
   * @param {number} targetAC - Target armor class
   * @param {string} attackName - Optional attack name for logging (e.g., 'Longsword', 'Shortbow')
   * @returns {object} Attack result
   */
  attackRoll(character, attackType = 'melee', targetAC = 10, attackName = null) {
    // Validate character object
    if (!character) {
      throw new Error('DiceRoller.attackRoll: character is required');
    }

    const ability = attackType === 'melee' ? 'strength' : 'dexterity';
    const abilityScore = character[ability] || 10;
    const modifier = this.getAbilityModifier(abilityScore);
    const proficiencyBonus = character.proficiencyBonus || 2;

    const roll = this.rollD20();
    const total = roll + modifier + proficiencyBonus;

    // Natural 20 is always a hit (and crit)
    // Natural 1 is always a miss
    const hit = roll === 20 || (roll !== 1 && total >= targetAC);
    const crit = roll === 20;

    // Log if logger is available
    if (this.logger && attackName) {
      const displayName = attackName || (attackType === 'melee' ? 'Melee Attack' : 'Ranged Attack');
      if (crit) {
        this.log(`${displayName} CRITICAL HIT! ${roll}+${modifier + proficiencyBonus}=${total} vs AC ${targetAC}`, 'success');
      } else if (hit) {
        this.log(`${displayName} ${roll}+${modifier + proficiencyBonus}=${total} vs AC ${targetAC}: Hit`, 'success');
      } else {
        this.log(`${displayName} ${roll}+${modifier + proficiencyBonus}=${total} vs AC ${targetAC}: Miss`, 'warning');
      }
    }

    return {
      roll,
      modifier: modifier + proficiencyBonus,
      total,
      hit,
      crit,
      targetAC
    };
  }

  /**
   * Damage roll
   * @param {string} diceString - Dice notation (e.g., "2d6+3", "1d8")
   * @param {string} damageType - Optional damage type for logging (e.g., 'slashing', 'fire')
   * @returns {number} Total damage
   */
  damageRoll(diceString, damageType = null) {
    // Parse dice string (e.g., "2d6+3")
    const match = diceString.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) {
      logger.general.error('Invalid dice string', { diceString });
      return 0;
    }

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const bonus = match[3] ? parseInt(match[3]) : 0;

    const damage = this.rollDice(sides, count) + bonus;

    // Log if logger is available
    if (this.logger && damageType) {
      this.log(`${damage} ${damageType} damage (${diceString})`, 'info');
    }

    return damage;
  }
}

export default DiceRoller;
