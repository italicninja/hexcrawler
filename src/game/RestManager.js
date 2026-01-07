/**
 * RestManager - Handles D&D 5e rest mechanics
 */
export class RestManager {
  /**
   * Perform a short rest (1 hour)
   * - Character can spend hit dice to recover HP
   * - Some class abilities recover on short rest
   *
   * @param {Character} character - The character resting
   * @param {number} hitDiceToSpend - Number of hit dice to spend (optional)
   * @returns {Object} - Result of the rest { hpRecovered, hitDiceSpent, message }
   */
  static shortRest(character, hitDiceToSpend = 0) {
    if (!this.canShortRest(character)) {
      return {
        success: false,
        hpRecovered: 0,
        hitDiceSpent: 0,
        message: 'Cannot short rest - no hit dice remaining!'
      };
    }

    // Validate hit dice amount
    const diceToSpend = Math.min(
      hitDiceToSpend,
      character.hitDiceRemaining,
      character.level // Can't spend more than level
    );

    if (diceToSpend === 0) {
      return {
        success: true,
        hpRecovered: 0,
        hitDiceSpent: 0,
        message: 'Short rest completed. No hit dice spent.'
      };
    }

    // Roll hit dice and recover HP
    let hpRecovered = 0;
    const hitDieValue = parseInt(character.hitDie.substring(1)); // Extract number from "d8", "d10", etc.
    const conModifier = character.getModifier('constitution');

    for (let i = 0; i < diceToSpend; i++) {
      // Roll hit die (use average rounded up for consistency)
      const roll = Math.floor(hitDieValue / 2) + 1;
      hpRecovered += Math.max(1, roll + conModifier); // Minimum 1 HP per die
    }

    // Apply HP recovery
    const hpBefore = character.currentHP;
    character.heal(hpRecovered);
    const actualRecovery = character.currentHP - hpBefore;

    // Spend hit dice
    character.useHitDice(diceToSpend);

    // Recover some class abilities (Divine Sense, Lay on Hands, etc.)
    this.recoverShortRestAbilities(character);

    return {
      success: true,
      hpRecovered: actualRecovery,
      hitDiceSpent: diceToSpend,
      hitDiceRemaining: character.hitDiceRemaining,
      message: `Short rest completed. Recovered ${actualRecovery} HP using ${diceToSpend} hit dice.`
    };
  }

  /**
   * Perform a long rest (8 hours)
   * - Recover all HP
   * - Recover half of max hit dice (minimum 1)
   * - Recover all class abilities and spell slots
   * - Can only long rest once per 24 hours
   *
   * @param {Character} character - The character resting
   * @param {number} currentGameTime - Current game time in hours since start
   * @returns {Object} - Result of the rest
   */
  static longRest(character, currentGameTime = 0) {
    const canRest = this.canLongRest(character, currentGameTime);

    if (!canRest.allowed) {
      return {
        success: false,
        hpRecovered: 0,
        hitDiceRecovered: 0,
        message: canRest.reason
      };
    }

    // Store HP before rest
    const hpBefore = character.currentHP;

    // Recover all HP
    character.currentHP = character.maxHP;
    const hpRecovered = character.maxHP - hpBefore;

    // Recover hit dice (half of max, minimum 1)
    const maxHitDice = character.level;
    const hitDiceMissing = maxHitDice - character.hitDiceRemaining;
    const hitDiceToRecover = Math.max(1, Math.floor(maxHitDice / 2));
    const actualHitDiceRecovered = Math.min(hitDiceToRecover, hitDiceMissing);

    character.recoverHitDice(actualHitDiceRecovered);

    // Recover all class abilities
    this.recoverLongRestAbilities(character);

    // Update last long rest time
    character.lastLongRest = currentGameTime;

    return {
      success: true,
      hpRecovered,
      hitDiceRecovered: actualHitDiceRecovered,
      hitDiceRemaining: character.hitDiceRemaining,
      message: `Long rest completed. Fully recovered HP and ${actualHitDiceRecovered} hit dice.`
    };
  }

  /**
   * Check if character can short rest
   * @param {Character} character
   * @returns {boolean}
   */
  static canShortRest(character) {
    return character.hitDiceRemaining > 0;
  }

  /**
   * Check if character can long rest
   * @param {Character} character
   * @param {number} currentGameTime - Current game time in hours
   * @returns {Object} - { allowed: boolean, reason: string }
   */
  static canLongRest(character, currentGameTime = 0) {
    // Check if 24 hours have passed since last long rest
    // If lastLongRest is 0 (game start), allow the first rest
    if (character.lastLongRest === 0) {
      return {
        allowed: true,
        reason: 'Can long rest.'
      };
    }

    const hoursSinceLastRest = currentGameTime - character.lastLongRest;
    const minHoursBetweenRests = 24;

    if (hoursSinceLastRest < minHoursBetweenRests) {
      const hoursRemaining = Math.ceil(minHoursBetweenRests - hoursSinceLastRest);
      return {
        allowed: false,
        reason: `Cannot long rest again for ${hoursRemaining} more hours.`
      };
    }

    return {
      allowed: true,
      reason: 'Can long rest.'
    };
  }

  /**
   * Recover abilities that recharge on short rest
   * @param {Character} character
   */
  static recoverShortRestAbilities(character) {
    if (character.abilities_list && Array.isArray(character.abilities_list)) {
      character.abilities_list = character.abilities_list.map(ability => {
        // For now, recover all abilities on short rest
        // In a more complex system, you'd check ability.restType
        if (ability.maxUses && ability.uses < ability.maxUses) {
          return {
            ...ability,
            uses: ability.maxUses
          };
        }
        return ability;
      });
    }
  }

  /**
   * Recover abilities that recharge on long rest
   * @param {Character} character
   */
  static recoverLongRestAbilities(character) {
    // Recover all class abilities
    if (character.abilities_list && Array.isArray(character.abilities_list)) {
      character.abilities_list = character.abilities_list.map(ability => ({
        ...ability,
        uses: ability.maxUses || ability.uses
      }));
    }

    // Recover spell slots (for future spell system)
    if (character.spellSlotsUsed) {
      character.spellSlotsUsed = {};
    }
  }

  /**
   * Calculate rest interruption chance
   * @param {string} terrainType - Type of terrain
   * @param {number} terrainDifficulty - Difficulty of terrain (1-3)
   * @returns {number} - Percentage chance of interruption (0-100)
   */
  static calculateInterruptionChance(terrainType, terrainDifficulty = 1) {
    let baseChance = 10; // 10% base chance

    // Increase chance based on terrain difficulty
    baseChance += (terrainDifficulty - 1) * 5; // +5% per difficulty level above 1

    // Adjust based on terrain type
    const terrainModifiers = {
      'water': 0, // Safe
      'grassland': 0,
      'desert': 5,
      'hills': 5,
      'forest': 10,
      'mountain': 15,
      'swamp': 15
    };

    const modifier = terrainModifiers[terrainType] || 5;
    baseChance += modifier;

    // Cap at 30%
    return Math.min(30, baseChance);
  }

  /**
   * Determine if rest is interrupted (for long rest)
   * @param {string} terrainType
   * @param {number} terrainDifficulty
   * @returns {boolean}
   */
  static isRestInterrupted(terrainType, terrainDifficulty) {
    const chance = this.calculateInterruptionChance(terrainType, terrainDifficulty);
    const roll = Math.random() * 100;
    return roll < chance;
  }

  /**
   * Perform an inn rest (guaranteed safe long rest)
   * - Costs gold per party member (10 gold per person)
   * - Recover all HP
   * - Recover all hit dice (not just half)
   * - Recover all class abilities
   * - NO interruption chance (guaranteed safe)
   * - Includes free meal and water (no consumption needed)
   *
   * @param {Character} character - The character resting
   * @param {Party} party - The party (to count living members)
   * @param {number} costPerPerson - Cost per living party member (default 10 gold)
   * @param {number} currentGameTime - Current game time in hours since start
   * @returns {Object} - Result of the rest
   */
  static innRest(character, party, costPerPerson = 10, currentGameTime = 0) {
    // Count living party members (player + living NPCs)
    const livingMembers = party ? party.getLivingMembers().length : 1;
    const totalCost = livingMembers * costPerPerson;

    // Check if player has enough gold
    if (character.gold < totalCost) {
      return {
        success: false,
        hpRecovered: 0,
        hitDiceRecovered: 0,
        goldSpent: 0,
        message: `Not enough gold! Inn rest costs ${totalCost} gold (${costPerPerson} per party member).`
      };
    }

    // Check if already at full HP
    if (character.currentHP >= character.maxHP) {
      return {
        success: false,
        hpRecovered: 0,
        hitDiceRecovered: 0,
        goldSpent: 0,
        message: 'Your party is already fully rested.'
      };
    }

    // Store HP before rest
    const hpBefore = character.currentHP;

    // Deduct gold
    character.removeGold(totalCost);

    // Recover all HP
    character.currentHP = character.maxHP;
    const hpRecovered = character.maxHP - hpBefore;

    // Recover ALL hit dice (not just half - inn rest is premium)
    const maxHitDice = character.level;
    const hitDiceMissing = maxHitDice - character.hitDiceRemaining;
    character.recoverHitDice(hitDiceMissing);

    // Recover all class abilities
    this.recoverLongRestAbilities(character);

    // Update last long rest time
    character.lastLongRest = currentGameTime;

    // NOTE: Food and water are NOT consumed during inn rest (included in price)
    // This is handled by the INN_REST action in GameStateContext, which skips consumption

    return {
      success: true,
      hpRecovered,
      hitDiceRecovered: hitDiceMissing,
      goldSpent: totalCost,
      livingMembers,
      message: `Rested at the inn for ${totalCost} gold. Fully recovered! (Meal and water included)`
    };
  }
}
