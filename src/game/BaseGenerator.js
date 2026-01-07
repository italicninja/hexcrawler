/**
 * BaseGenerator - Shared base class for CR-based generators
 * Provides common utilities for Challenge Rating scaling, random selection, and table lookups
 */

export class BaseGenerator {
  constructor() {
    // Subclasses will populate this with their lookup tables
    this.lookupTables = {};
  }

  /**
   * Get lookup table for a given CR with fallback to closest lower CR
   * @param {number} cr - Challenge Rating
   * @param {number} maxCR - Maximum CR in tables (default 11)
   * @returns {object|null} Lookup table data or null
   */
  getCRTable(cr, maxCR = 11) {
    // Cap CR at maximum
    const lookupCR = Math.min(cr, maxCR);

    // Try exact match first
    if (this.lookupTables[lookupCR]) {
      return this.lookupTables[lookupCR];
    }

    // Fallback: Find closest lower CR
    for (let testCR = lookupCR; testCR >= 0; testCR--) {
      if (this.lookupTables[testCR]) {
        return this.lookupTables[testCR];
      }
    }

    // Last resort: Use CR 0 if it exists
    return this.lookupTables[0] || null;
  }

  /**
   * Cap CR at a maximum value
   * @param {number} cr - Challenge Rating
   * @param {number} maxCR - Maximum CR value
   * @returns {number} Capped CR
   */
  capCR(cr, maxCR = 11) {
    return Math.min(cr, maxCR);
  }

  /**
   * Generate random integer in range [min, max] (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {Function} random - Random function (0-1)
   * @returns {number} Random integer
   */
  randomInt(min, max, random = Math.random) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  /**
   * Weighted random selection from array
   * @param {Array} items - Items to choose from
   * @param {Array} weights - Weights for each item (same length as items)
   * @param {Function} random - Random function (0-1)
   * @returns {*} Selected item
   */
  weightedRandom(items, weights, random = Math.random) {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let randomValue = random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      randomValue -= weights[i];
      if (randomValue <= 0) {
        return items[i];
      }
    }

    // Fallback to last item
    return items[items.length - 1];
  }

  /**
   * Roll multiple dice and sum the results
   * @param {number} diceCount - Number of dice to roll
   * @param {number} diceSides - Number of sides per die
   * @param {Function} random - Random function (0-1)
   * @returns {number} Total rolled value
   */
  rollDice(diceCount, diceSides, random = Math.random) {
    let total = 0;
    for (let i = 0; i < diceCount; i++) {
      total += Math.floor(random() * diceSides) + 1;
    }
    return total;
  }

  /**
   * Calculate a DC (Difficulty Class) based on CR
   * Uses standard D&D 5e progression: DC = 10 + (CR / 3)
   * @param {number} cr - Challenge Rating
   * @returns {number} DC value
   */
  calculateDC(cr) {
    const baseDC = 10;
    const increment = Math.floor(cr / 3);
    return baseDC + increment;
  }

  /**
   * Select random item from array
   * @param {Array} array - Array to choose from
   * @param {Function} random - Random function (0-1)
   * @returns {*} Selected item or null if array is empty
   */
  randomChoice(array, random = Math.random) {
    if (!array || array.length === 0) return null;
    const index = Math.floor(random() * array.length);
    return array[index];
  }
}

export default BaseGenerator;
