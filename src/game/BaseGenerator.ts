/**
 * BaseGenerator - Shared base class for CR-based generators
 * Provides common utilities for Challenge Rating scaling, random selection, and table lookups
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LookupTable = Record<number, any>;

export class BaseGenerator {
  protected lookupTables: LookupTable;

  constructor() {
    // Subclasses will populate this with their lookup tables
    this.lookupTables = {};
  }

  /**
   * Get lookup table for a given CR with fallback to closest lower CR
   * @param cr - Challenge Rating
   * @param maxCR - Maximum CR in tables (default 11)
   * @returns Lookup table data or null
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCRTable(cr: number, maxCR = 11): any | null {
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
   * @param cr - Challenge Rating
   * @param maxCR - Maximum CR value
   * @returns Capped CR
   */
  capCR(cr: number, maxCR = 11): number {
    return Math.min(cr, maxCR);
  }

  /**
   * Generate random integer in range [min, max] (inclusive)
   * @param min - Minimum value
   * @param max - Maximum value
   * @param random - Random function (0-1)
   * @returns Random integer
   */
  randomInt(min: number, max: number, random: () => number = Math.random): number {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  /**
   * Weighted random selection from array
   * @param items - Items to choose from
   * @param weights - Weights for each item (same length as items)
   * @param random - Random function (0-1)
   * @returns Selected item
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weightedRandom<T = any>(items: T[], weights: number[], random: () => number = Math.random): T {
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
   * @param diceCount - Number of dice to roll
   * @param diceSides - Number of sides per die
   * @param random - Random function (0-1)
   * @returns Total rolled value
   */
  rollDice(diceCount: number, diceSides: number, random: () => number = Math.random): number {
    let total = 0;
    for (let i = 0; i < diceCount; i++) {
      total += Math.floor(random() * diceSides) + 1;
    }
    return total;
  }

  /**
   * Calculate a DC (Difficulty Class) based on CR
   * Uses standard D&D 5e progression: DC = 10 + (CR / 3)
   * @param cr - Challenge Rating
   * @returns DC value
   */
  calculateDC(cr: number): number {
    const baseDC = 10;
    const increment = Math.floor(cr / 3);
    return baseDC + increment;
  }

  /**
   * Select random item from array
   * @param array - Array to choose from
   * @param random - Random function (0-1)
   * @returns Selected item or null if array is empty
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  randomChoice<T = any>(array: T[], random: () => number = Math.random): T | null {
    if (!array || array.length === 0) return null;
    const index = Math.floor(random() * array.length);
    return array[index];
  }
}

export default BaseGenerator;
