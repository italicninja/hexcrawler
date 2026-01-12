/**
 * HazardGenerator - Generates traps and environmental hazards
 * Uses official D&D 5e SRD traps with level-based scaling
 */

import { BaseGenerator } from './BaseGenerator.js';
import { SRD_TRAPS, getScaledTrap } from './data/GameTableData.js';
import logger from '../utils/logger.js';

export class HazardGenerator extends BaseGenerator {
  constructor() {
    super();

    // SRD trap weights for weighted random selection
    this.trapWeights = {
      'Collapsing Roof': 0.15,
      'Falling Net': 0.15,
      'Fire-Casting Statue': 0.15,
      'Hidden Pit': 0.15,
      'Poisoned Darts': 0.15,
      'Poisoned Needle': 0.10,
      'Spiked Pit': 0.10,
      'Rolling Stone': 0.05 // High-level only
    };
  }

  /**
   * Generate a random hazard using SRD traps
   * @param {number} cr - Challenge Rating
   * @param {Function} random - Random function (0-1)
   * @returns {object} Hazard object
   */
  generateHazard(cr, random = Math.random) {
    // Convert CR to character level
    const level = this._crToLevel(cr);

    // Select random trap using weighted selection
    const trapName = this._selectRandomTrap(level, random);

    // Get scaled trap data for this level
    const scaledTrap = getScaledTrap(trapName, level);

    // Calculate actual damage value
    const damage = this._calculateTrapDamage(scaledTrap, random);

    return {
      type: trapName,
      category: scaledTrap.type,
      description: scaledTrap.description,
      trigger: scaledTrap.trigger,
      saveType: scaledTrap.saveType,
      damageType: scaledTrap.damageType,
      dc: scaledTrap.saveDC,
      damage: damage,
      triggered: false,
      discovered: false,
      resets: scaledTrap.resets,
      effects: scaledTrap.effects,
      condition: scaledTrap.condition,
      detectDC: scaledTrap.detectDC,
      detectSkill: scaledTrap.detectSkill
    };
  }

  /**
   * Convert CR to character level tier
   * @param {number} cr - Challenge Rating
   * @returns {number} Character level (1, 5, 11, or 17)
   * @private
   */
  _crToLevel(cr) {
    if (cr <= 4) return 1 + Math.floor(cr); // CR 0-4 → level 1-4
    if (cr <= 10) return 5 + Math.floor((cr - 5) / 2); // CR 5-10 → level 5-10
    if (cr <= 16) return 11 + Math.floor((cr - 11) / 2); // CR 11-16 → level 11-16
    return 17 + Math.floor((cr - 17) / 2); // CR 17+ → level 17-20
  }

  /**
   * Select random trap using weighted selection
   * @param {number} level - Character level
   * @param {Function} random - Random function
   * @returns {string} Trap name
   * @private
   */
  _selectRandomTrap(level, random) {
    // Adjust weights based on level (Rolling Stone only at high levels)
    const weights = { ...this.trapWeights };
    
    if (level < 11) {
      // Remove Rolling Stone for low levels and redistribute weight
      const rollingStoneWeight = weights['Rolling Stone'];
      delete weights['Rolling Stone'];
      
      // Distribute the weight evenly among remaining traps
      const numTraps = Object.keys(weights).length;
      const extraWeight = rollingStoneWeight / numTraps;
      for (const trap in weights) {
        weights[trap] += extraWeight;
      }
    }

    // Convert to arrays for weighted random
    const traps = Object.keys(weights);
    const trapWeights = Object.values(weights);

    return this.weightedRandom(traps, trapWeights, random);
  }

  /**
   * Calculate actual trap damage by rolling dice
   * @param {object} scaledTrap - Scaled trap data
   * @param {Function} random - Random function
   * @returns {number} Total damage
   * @private
   */
  _calculateTrapDamage(scaledTrap, random) {
    // Use scaledDamage instead of damage (scaledDamage is the string for the level)
    const damageString = scaledTrap.scaledDamage || scaledTrap.damage;
    
    // Check if damageString is actually a string
    if (typeof damageString !== 'string') {
      logger.mapgen.error('Invalid damage string for trap', { trap: scaledTrap.type, damageString });
      return 0;
    }

    // Handle special cases
    if (damageString === '0' || damageString === 'none') {
      return 0; // Falling Net does no damage
    }

    // Handle combined damage (e.g., "1d6 falling + 1d6 piercing")
    if (damageString.includes('+')) {
      const parts = damageString.split('+').map(s => s.trim());
      let totalDamage = 0;
      for (const part of parts) {
        const dice = part.split(' ')[0]; // Extract dice notation
        totalDamage += this._rollDamage(dice, random);
      }
      return totalDamage;
    }

    // Handle poisoned darts (multiple darts with damage per dart)
    if (damageString.includes('per dart')) {
      // Format: "1d4 piercing per dart (1d3 darts)"
      const dartDiceMatch = damageString.match(/\((\d+d\d+) darts?\)/);
      const damageDiceMatch = damageString.match(/^(\d+d\d+)/);
      
      if (dartDiceMatch && damageDiceMatch) {
        const numDarts = this._rollDamage(dartDiceMatch[1], random);
        const damagePerDart = damageDiceMatch[1];
        let totalDamage = 0;
        for (let i = 0; i < numDarts; i++) {
          totalDamage += this._rollDamage(damagePerDart, random);
        }
        return totalDamage;
      }
    }

    // Standard damage (e.g., "2d10 bludgeoning")
    const dice = damageString.split(' ')[0];
    return this._rollDamage(dice, random);
  }

  /**
   * Roll damage dice from notation (e.g., "2d6", "1d10")
   * @param {string} diceString - Dice notation
   * @param {Function} random - Random function
   * @returns {number} Rolled damage
   * @private
   */
  _rollDamage(diceString, random) {
    // Handle single numbers
    if (!diceString.includes('d')) {
      return parseInt(diceString);
    }

    const [numDice, diceSize] = diceString.split('d').map(s => parseInt(s));
    return this.rollDice(numDice, diceSize, random);
  }



  /**
   * Get hazard category color for display
   * @param {string} category
   * @returns {string} Hex color
   */
  getCategoryColor(category) {
    const colors = {
      'trap': '#e67e22',
      'environmental': '#e74c3c',
      'magical': '#9b59b6'
    };
    return colors[category] || colors.trap;
  }

  /**
   * Get damage type color for display
   * @param {string} damageType
   * @returns {string} Hex color
   */
  getDamageTypeColor(damageType) {
    const colors = {
      'fire': '#e74c3c',
      'cold': '#3498db',
      'lightning': '#f1c40f',
      'poison': '#27ae60',
      'necrotic': '#8e44ad',
      'force': '#9b59b6',
      'psychic': '#e91e63',
      'piercing': '#95a5a6',
      'slashing': '#95a5a6',
      'bludgeoning': '#95a5a6',
      'falling': '#7f8c8d',
      'restraint': '#34495e',
      'teleport': '#9b59b6'
    };
    return colors[damageType] || colors.piercing;
  }

  /**
   * Format hazard for display with save result
   * @param {object} hazard - Hazard object
   * @param {object} saveResult - Optional save result {success: boolean, roll: number, modifier: number}
   * @returns {string} Formatted string
   */
  formatHazard(hazard, saveResult = null) {
    let output = `${hazard.description}\n`;
    output += `Trigger: ${hazard.trigger}\n\n`;

    if (!hazard.discovered) {
      output += `Hidden trap (DC ${hazard.detectDC} ${hazard.detectSkill} to detect)\n\n`;
    }

    if (saveResult) {
      const total = saveResult.roll + saveResult.modifier;
      output += `${hazard.saveType.toUpperCase()} save: ${saveResult.roll}+${saveResult.modifier}=${total} vs DC ${hazard.dc}\n`;
      
      if (saveResult.success) {
        output += `Success! `;
        if (hazard.damage > 0) {
          output += `Take ${Math.floor(hazard.damage / 2)} ${hazard.damageType} damage (half damage)`;
        } else {
          output += `Avoided the trap!`;
        }
      } else {
        output += `Failed! `;
        if (hazard.damage > 0) {
          output += `Take ${hazard.damage} ${hazard.damageType} damage`;
        }
        if (hazard.condition) {
          output += ` and ${hazard.condition} condition`;
        }
        if (hazard.effects) {
          output += `\n${hazard.effects}`;
        }
      }
    } else {
      // No save result yet - show what will happen
      output += `DC ${hazard.dc} ${hazard.saveType.toUpperCase()} save required\n`;
      if (hazard.damage > 0) {
        output += `Damage: ${hazard.damageType}`;
      }
      if (hazard.condition) {
        output += `\nCondition: ${hazard.condition}`;
      }
      if (hazard.effects) {
        output += `\nEffect: ${hazard.effects}`;
      }
    }

    return output;
  }
}

export default HazardGenerator;
