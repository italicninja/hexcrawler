/**
 * SurvivalManager.js
 * Manages food, water, and exhaustion mechanics for D&D 5e hexcrawl survival.
 * Based on D&D 5e PHB rules for food, water, and exhaustion.
 */

/**
 * D&D 5e Exhaustion Effects (levels 1-6)
 * @param {number} level - Exhaustion level (0-6)
 * @returns {object} Exhaustion effects description
 */
export function getExhaustionEffects(level) {
  const effects = {
    0: { description: 'No exhaustion', penalties: [] },
    1: { description: 'Disadvantage on ability checks', penalties: ['disadvantage_checks'] },
    2: { description: 'Speed halved', penalties: ['disadvantage_checks', 'speed_halved'] },
    3: { description: 'Disadvantage on attack rolls and saving throws', penalties: ['disadvantage_checks', 'speed_halved', 'disadvantage_attacks_saves'] },
    4: { description: 'Hit point maximum halved', penalties: ['disadvantage_checks', 'speed_halved', 'disadvantage_attacks_saves', 'hp_max_halved'] },
    5: { description: 'Speed reduced to 0', penalties: ['disadvantage_checks', 'speed_halved', 'disadvantage_attacks_saves', 'hp_max_halved', 'speed_zero'] },
    6: { description: 'Death', penalties: ['death'] }
  };

  return effects[level] || effects[0];
}

/**
 * Consume 1 day's ration (called during long rest)
 * @param {Character} character - Character object
 * @returns {object} Result of consumption { success, message }
 */
export function consumeRations(character) {
  if (!character) {
    return { success: false, message: 'No character provided' };
  }

  if (character.rations > 0) {
    character.rations--;
    character.daysWithoutFood = 0; // Reset starvation counter
    return {
      success: true,
      message: `Consumed 1 day's ration. ${character.rations} days remaining.`,
      remaining: character.rations
    };
  } else {
    character.daysWithoutFood++;
    return {
      success: false,
      message: `No rations available! Days without food: ${character.daysWithoutFood}`,
      daysWithout: character.daysWithoutFood
    };
  }
}

/**
 * Consume 1 day's water (DEPRECATED - water removed from survival system)
 * @param {Character} character - Character object
 * @returns {object} Result of consumption { success, message }
 */
export function consumeWater(character) {
  // Water consumption removed - always returns success
  return {
    success: true,
    message: 'Water consumption removed from survival system.',
    remaining: 0
  };
}

/**
 * Apply starvation exhaustion (3+ days without food)
 * D&D 5e: A character can go 3 + CON modifier days without food before suffering exhaustion
 * @param {Character} character - Character object
 * @returns {object} Result { exhaustionGained, message }
 */
export function applyStarvation(character) {
  if (!character) {
    return { exhaustionGained: 0, message: 'No character provided' };
  }

  // Calculate days before starvation (3 + CON modifier, minimum 1)
  const conModifier = character.getModifier('constitution');
  const daysBeforeStarvation = Math.max(1, 3 + conModifier);

  if (character.daysWithoutFood >= daysBeforeStarvation) {
    // Gain 1 exhaustion level per day after threshold
    const exhaustionToGain = 1;
    const oldLevel = character.exhaustionLevel;
    character.exhaustionLevel = Math.min(6, character.exhaustionLevel + exhaustionToGain);

    const effects = getExhaustionEffects(character.exhaustionLevel);

    return {
      exhaustionGained: exhaustionToGain,
      message: `Starvation! Exhaustion level ${oldLevel} → ${character.exhaustionLevel}. ${effects.description}`,
      newLevel: character.exhaustionLevel,
      effects: effects.description
    };
  }

  return { exhaustionGained: 0, message: 'No starvation effects' };
}

/**
 * Apply dehydration exhaustion (DEPRECATED - water removed from survival system)
 * @param {Character} character - Character object
 * @param {string} terrain - Current terrain type (for hot weather check)
 * @returns {object} Result { exhaustionGained, message }
 */
export function applyDehydration(character, terrain = 'grassland') {
  // Dehydration removed - always returns no exhaustion
  return { exhaustionGained: 0, message: 'Dehydration removed from survival system' };
}

/**
 * Forage for food (Survival check - Wisdom based)
 * Forages current hex + all adjacent hexes (7 total)
 * DC is averaged across all hexes
 * 3-day cooldown per hex
 * @param {Character} character - Character object
 * @param {Array} hexes - Array of hex objects {terrain: {key: string}}
 * @param {DiceRoller} diceRoller - DiceRoller instance
 * @param {number} currentDay - Current game day for cooldown tracking
 * @returns {object} Result { success, rationsGained, message, roll, hexesForaged }
 */
export function forage(character, hexes, diceRoller, currentDay) {
  if (!character || !diceRoller || !hexes || hexes.length === 0) {
    return { success: false, rationsGained: 0, message: 'Invalid parameters', hexesForaged: [] };
  }

  // Terrain-based DCs for foraging
  const forageDCs = {
    grassland: 10,
    forest: 10,
    hills: 12,
    mountains: 15,
    desert: 20,
    swamp: 12,
    tundra: 15,
    water: 20,
    river: 12
  };

  // Filter out water/impassable hexes and calculate average DC
  const validHexes = hexes.filter(hex => {
    const terrainKey = hex?.terrain?.key;
    return terrainKey && terrainKey !== 'water';
  });

  if (validHexes.length === 0) {
    return { success: false, rationsGained: 0, message: 'No valid terrain to forage', hexesForaged: [] };
  }

  // Calculate average DC
  let totalDC = 0;
  let goodHexCount = 0; // Hexes with DC <= 10
  
  validHexes.forEach(hex => {
    const terrainKey = hex.terrain.key;
    const hexDC = forageDCs[terrainKey] || 15;
    totalDC += hexDC;
    
    if (hexDC <= 10) {
      goodHexCount++;
    }
  });

  const averageDC = Math.ceil(totalDC / validHexes.length);

  // Survival check (Wisdom + Proficiency if proficient in Survival)
  // For simplicity, assume all characters are proficient in Survival
  const wisdomScore = character.abilities.wisdom;
  const result = diceRoller.skillCheck(
    { wisdom: wisdomScore, proficiencyBonus: character.proficiencyBonus },
    'wisdom',
    true, // Proficient in Survival
    averageDC,
    'normal'
  );

  // Create list of hex keys for cooldown tracking
  const hexesForaged = validHexes.map(hex => `${hex.col},${hex.row}`);

  if (result.success) {
    // Success - gain 1d4 + number of good hexes (DC <= 10)
    const baseRations = diceRoller.rollDice(4);
    const rationsGained = baseRations + goodHexCount;
    character.rations += rationsGained;

    return {
      success: true,
      rationsGained,
      message: `Foraging successful! Found ${rationsGained} day(s) of food (${baseRations} base + ${goodHexCount} from rich terrain). Searched ${validHexes.length} hexes.`,
      roll: result,
      hexesForaged,
      hexCount: validHexes.length,
      goodHexCount
    };
  } else {
    // Failure - no food found
    return {
      success: false,
      rationsGained: 0,
      message: `Foraging failed. No food found in ${validHexes.length} hexes.`,
      roll: result,
      hexesForaged,
      hexCount: validHexes.length
    };
  }
}

/**
 * Find water source (DEPRECATED - water removed from survival system)
 * @param {Character} character - Character object
 * @param {string} terrainKey - Terrain type key
 * @param {DiceRoller} diceRoller - DiceRoller instance
 * @returns {object} Result { success, waterGained, message, roll }
 */
export function findWater(character, terrainKey, diceRoller) {
  return {
    success: false,
    waterGained: 0,
    message: 'Water finding removed from survival system.',
    roll: null
  };
}

/**
 * Reduce exhaustion level (during long rest with food and water)
 * D&D 5e: A long rest reduces exhaustion by 1 level
 * @param {Character} character - Character object
 * @returns {object} Result { reduced, message }
 */
export function reduceExhaustion(character) {
  if (!character) {
    return { reduced: false, message: 'No character provided' };
  }

  if (character.exhaustionLevel > 0) {
    const oldLevel = character.exhaustionLevel;
    character.exhaustionLevel = Math.max(0, character.exhaustionLevel - 1);

    const effects = getExhaustionEffects(character.exhaustionLevel);

    return {
      reduced: true,
      message: `Exhaustion reduced: Level ${oldLevel} → ${character.exhaustionLevel}. ${effects.description}`,
      newLevel: character.exhaustionLevel,
      effects: effects.description
    };
  }

  return { reduced: false, message: 'No exhaustion to reduce' };
}

/**
 * Check if character is affected by exhaustion penalties
 * @param {Character} character - Character object
 * @returns {object} Active penalties
 */
export function getActiveExhaustionPenalties(character) {
  if (!character) {
    return { level: 0, penalties: [], description: 'No exhaustion' };
  }

  const effects = getExhaustionEffects(character.exhaustionLevel);

  return {
    level: character.exhaustionLevel,
    penalties: effects.penalties,
    description: effects.description
  };
}

export default {
  getExhaustionEffects,
  consumeRations,
  consumeWater,
  applyStarvation,
  applyDehydration,
  forage,
  findWater,
  reduceExhaustion,
  getActiveExhaustionPenalties
};
