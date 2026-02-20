// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * TreasureGenerator - Generates treasure hoards using official DMG treasure tables
 * Implements D&D 5e treasure hoard tables with CR-based scaling
 * Converts all coinage to gold and gems/art objects to gold values
 * Generates consumables (potions/scrolls) from magic item tables
 */

import { BaseGenerator } from './BaseGenerator';
import {
  TREASURE_HOARD_TABLES,
  GEMSTONE_TABLES,
  ART_OBJECT_TABLES,
  MAGIC_ITEM_TABLES,
  getCRBracket,
} from './data/GameTableData';

export class TreasureGenerator extends BaseGenerator {
  constructor() {
    super();

    // Coin conversion rates to gold pieces
    this.COIN_TO_GOLD = {
      cp: 0.01, // 100 CP = 1 GP
      sp: 0.1, // 10 SP = 1 GP
      ep: 0.5, // 2 EP = 1 GP
      gp: 1, // 1 GP = 1 GP
      pp: 10, // 1 PP = 10 GP
    };
  }

  /**
   * Generate treasure hoard based on CR using DMG treasure tables
   * @param {number} cr - Challenge Rating (0-30)
   * @param {number} partySize - Number of party members (default 4)
   * @param {Function} random - Random function (0-1)
   * @returns {object} { type: 'chest', gold: number, consumables: string[], rarity: string }
   */
  generateTreasureHoard(cr, partySize = 4, random = Math.random) {
    // TODO: Replace with actual implementation once GameTableData.js is created
    // For now, return a placeholder structure

    // Determine rarity based on CR
    const rarity = this._determineRarity(cr);

    // TODO: Get CR bracket and treasure table
    // const crBracket = getCRBracket(cr);
    // const treasureTable = TREASURE_HOARD_TABLES[crBracket];

    // TODO: Roll coins and convert to gold
    // const coinsGold = this._rollCoins(treasureTable.coins, random);

    // TODO: Roll gems and convert to gold value
    // const gemsGold = this._calculateGemValue(treasureTable.gems, random);

    // TODO: Roll art objects and convert to gold value
    // const artGold = this._calculateArtValue(treasureTable.artObjects, random);

    // TODO: Roll consumables from magic item tables
    // const consumables = this._rollConsumables(treasureTable.magicItems, random);

    // Scale treasure to party size (DMG assumes 4 party members)
    const partyScalar = partySize / 4.0;

    // Placeholder gold calculation
    const baseGold = this.randomInt(10, 100, random) * (cr + 1);
    const totalGold = Math.floor(baseGold * partyScalar);

    return {
      type: 'chest',
      gold: totalGold,
      consumables: [], // TODO: Replace with actual consumables
      rarity,
    };
  }

  /**
   * Roll coins from treasure table and convert to gold
   * @param {object} coinTable - Coin table with CP/SP/EP/GP/PP entries
   * @param {Function} random - Random function (0-1)
   * @returns {number} Total gold value
   * @private
   */
  _rollCoins(coinTable, random = Math.random) {
    let totalGold = 0;

    // Iterate through each coin type in the table
    for (const [coinType, diceString] of Object.entries(coinTable)) {
      if (!diceString) continue;

      // Roll the dice for this coin type
      const coinAmount = this._parseDiceRoll(diceString, 1, random);

      // Convert to gold pieces
      const coinTypeKey = coinType.toLowerCase();
      const goldValue = coinAmount * (this.COIN_TO_GOLD[coinTypeKey] || 0);

      totalGold += goldValue;
    }

    return Math.floor(totalGold);
  }

  /**
   * Calculate gem value from treasure table
   * @param {object} gemData - Gem data with count and value table
   * @param {Function} random - Random function (0-1)
   * @returns {number} Total gold value of gems
   * @private
   */
  _calculateGemValue(gemData, random = Math.random) {
    if (!gemData || !gemData.count) return 0;

    // Roll gem count
    const gemCount = this._parseDiceRoll(gemData.count, 1, random);
    if (gemCount === 0) return 0;

    // TODO: Look up gem value from GEMSTONE_TABLES
    // const gemValue = GEMSTONE_TABLES[gemData.valueTable];

    // Placeholder: Assume 50gp per gem
    const gemValue = 50;

    return gemCount * gemValue;
  }

  /**
   * Calculate art object value from treasure table
   * @param {object} artData - Art object data with count and value table
   * @param {Function} random - Random function (0-1)
   * @returns {number} Total gold value of art objects
   * @private
   */
  _calculateArtValue(artData, random = Math.random) {
    if (!artData || !artData.count) return 0;

    // Roll art object count
    const artCount = this._parseDiceRoll(artData.count, 1, random);
    if (artCount === 0) return 0;

    // TODO: Look up art object value from ART_OBJECT_TABLES
    // const artValue = ART_OBJECT_TABLES[artData.valueTable];

    // Placeholder: Assume 250gp per art object
    const artValue = 250;

    return artCount * artValue;
  }

  /**
   * Roll consumables (potions/scrolls) from magic item tables
   * @param {object} magicItemData - Magic item table data
   * @param {Function} random - Random function (0-1)
   * @returns {string[]} Array of consumable item names
   * @private
   */
  _rollConsumables(magicItemData, random = Math.random) {
    if (!magicItemData || !magicItemData.count) return [];

    const consumables = [];

    // Roll magic item count
    const itemCount = this._parseDiceRoll(magicItemData.count, 1, random);

    for (let i = 0; i < itemCount; i++) {
      // TODO: Roll on magic item table and filter for consumables
      // const magicItemTable = MAGIC_ITEM_TABLES[magicItemData.table];
      // const rolledItem = this.randomChoice(magicItemTable, random);
      // Filter for consumables only (potions, scrolls, etc.)
      // if (this._isConsumable(rolledItem)) {
      //   consumables.push(rolledItem.name);
      // }
      // TODO: Full magic item implementation for weapons, armor, wondrous items
    }

    return consumables;
  }

  /**
   * Parse dice roll string and apply multiplier
   * @param {string} diceString - Dice notation (e.g., "3d6", "1d4+2", "2d10*100")
   * @param {number} multiplier - Multiplier for final result (default 1)
   * @param {Function} random - Random function (0-1)
   * @returns {number} Rolled result
   * @private
   */
  _parseDiceRoll(diceString, multiplier = 1, random = Math.random) {
    if (!diceString) return 0;

    // Handle multiplier in dice string (e.g., "1d6*10")
    let finalMultiplier = multiplier;
    let cleanDiceString = diceString;

    const multMatch = diceString.match(/\*(\d+)/);
    if (multMatch) {
      finalMultiplier *= parseInt(multMatch[1]);
      cleanDiceString = diceString.replace(/\*\d+/, '');
    }

    // Parse dice notation: XdY or XdY+Z
    const match = cleanDiceString.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) {
      // If not dice notation, try to parse as integer
      const value = parseInt(diceString);
      return isNaN(value) ? 0 : value * finalMultiplier;
    }

    const diceCount = parseInt(match[1]);
    const diceSides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    // Roll dice using base class method
    const rolled = this.rollDice(diceCount, diceSides, random);

    return Math.floor((rolled + modifier) * finalMultiplier);
  }

  /**
   * Determine treasure rarity based on CR
   * @param {number} cr - Challenge Rating
   * @returns {string} Rarity tier
   * @private
   */
  _determineRarity(cr) {
    if (cr >= 17) return 'very rare';
    if (cr >= 11) return 'rare';
    if (cr >= 5) return 'uncommon';
    return 'common';
  }
}

export default TreasureGenerator;
