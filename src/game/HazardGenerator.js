/**
 * HazardGenerator - Generates traps and environmental hazards
 * Difficulty and damage scale with Challenge Rating
 */

import { BaseGenerator } from './BaseGenerator.js';

export class HazardGenerator extends BaseGenerator {
  constructor() {
    super();

    // Hazard type definitions
    this.hazardTypes = {
      // Traps
      trap: {
        'pit trap': {
          description: 'A concealed pit opens beneath your feet!',
          saveType: 'dexterity',
          damageType: 'falling'
        },
        'arrow trap': {
          description: 'Arrows shoot from hidden holes in the walls!',
          saveType: 'dexterity',
          damageType: 'piercing'
        },
        'poison dart': {
          description: 'A poisoned dart shoots from the wall!',
          saveType: 'dexterity',
          damageType: 'poison'
        },
        'swinging blade': {
          description: 'A massive blade swings down from above!',
          saveType: 'dexterity',
          damageType: 'slashing'
        },
        'falling net': {
          description: 'A net drops from the ceiling, attempting to entangle you!',
          saveType: 'dexterity',
          damageType: 'restraint'
        },
        'spiked floor': {
          description: 'Spikes shoot up from the floor!',
          saveType: 'dexterity',
          damageType: 'piercing'
        }
      },
      // Environmental hazards
      environmental: {
        'lava pool': {
          description: 'You step too close to a pool of molten lava!',
          saveType: 'dexterity',
          damageType: 'fire'
        },
        'toxic gas': {
          description: 'Noxious gas fills the area!',
          saveType: 'constitution',
          damageType: 'poison'
        },
        'falling rocks': {
          description: 'The ceiling collapses above you!',
          saveType: 'dexterity',
          damageType: 'bludgeoning'
        },
        'unstable floor': {
          description: 'The floor crumbles beneath your feet!',
          saveType: 'dexterity',
          damageType: 'falling'
        },
        'freezing water': {
          description: 'You fall into freezing cold water!',
          saveType: 'constitution',
          damageType: 'cold'
        },
        'steam vent': {
          description: 'Superheated steam erupts from a crack in the ground!',
          saveType: 'dexterity',
          damageType: 'fire'
        }
      },
      // Magical hazards
      magical: {
        'arcane rune': {
          description: 'A magical rune glows brightly and discharges energy!',
          saveType: 'dexterity',
          damageType: 'force'
        },
        'curse zone': {
          description: 'Dark energy swirls around you, attempting to drain your vitality!',
          saveType: 'wisdom',
          damageType: 'necrotic'
        },
        'teleportation trap': {
          description: 'Magic circles glow beneath your feet!',
          saveType: 'wisdom',
          damageType: 'teleport'
        },
        'mind fog': {
          description: 'Your mind becomes clouded with confusion!',
          saveType: 'intelligence',
          damageType: 'psychic'
        },
        'lightning rune': {
          description: 'Electricity crackles through the air!',
          saveType: 'dexterity',
          damageType: 'lightning'
        },
        'shadow tendril': {
          description: 'Dark tendrils reach out from the shadows!',
          saveType: 'wisdom',
          damageType: 'necrotic'
        }
      }
    };
  }

  /**
   * Generate a random hazard
   * @param {number} cr - Challenge Rating
   * @param {Function} random - Random function (0-1)
   * @returns {object} Hazard object
   */
  generateHazard(cr, random = Math.random) {
    // Pick hazard category using base class weighted random
    const categories = ['trap', 'environmental', 'magical'];
    const weights = [0.5, 0.35, 0.15]; // Traps most common, magical least common

    const category = this.weightedRandom(categories, weights, random);

    // Pick specific hazard from category
    const hazardList = this.hazardTypes[category];
    const hazardNames = Object.keys(hazardList);
    const hazardName = this.randomChoice(hazardNames, random);
    const hazardData = hazardList[hazardName];

    // Calculate DC based on CR (uses base class method)
    const dc = this.calculateDC(cr);

    // Calculate damage based on CR
    const damage = this.calculateDamage(cr, random);

    return {
      type: hazardName,
      category: category,
      description: hazardData.description,
      saveType: hazardData.saveType,
      damageType: hazardData.damageType,
      dc: dc,
      damage: damage,
      triggered: false
    };
  }

  /**
   * Calculate damage based on CR
   * @param {number} cr
   * @param {Function} random
   * @returns {number} Damage amount
   */
  calculateDamage(cr, random = Math.random) {
    // Damage scales with CR
    // CR 0-2: 1d6 (1-6)
    // CR 3-5: 2d6 (2-12)
    // CR 6-8: 3d6 (3-18)
    // CR 9-11: 4d6 (4-24)
    // CR 12+: 5d6+ (5-30+)

    let diceCount = Math.max(1, Math.floor(cr / 3) + 1);
    diceCount = Math.min(diceCount, 6); // Cap at 6d6

    // Use base class rollDice method
    return this.rollDice(diceCount, 6, random);
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
   * Format hazard for display
   * @param {object} hazard
   * @returns {string} Formatted string
   */
  formatHazard(hazard) {
    return `${hazard.description}\n\nDC ${hazard.dc} ${hazard.saveType.toUpperCase()} save or take ${hazard.damage} ${hazard.damageType} damage!`;
  }
}

export default HazardGenerator;
