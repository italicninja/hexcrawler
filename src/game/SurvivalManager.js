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
 * Consume 1 day's water (called during long rest)
 * @param {Character} character - Character object
 * @returns {object} Result of consumption { success, message }
 */
export function consumeWater(character) {
  if (!character) {
    return { success: false, message: 'No character provided' };
  }

  if (character.water > 0) {
    character.water--;
    character.daysWithoutWater = 0; // Reset dehydration counter
    return {
      success: true,
      message: `Consumed 1 day's water. ${character.water} days remaining.`,
      remaining: character.water
    };
  } else {
    character.daysWithoutWater++;
    return {
      success: false,
      message: `No water available! Days without water: ${character.daysWithoutWater}`,
      daysWithout: character.daysWithoutWater
    };
  }
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
 * Apply dehydration exhaustion (1+ days without water)
 * D&D 5e: A character needs 1 gallon per day (2 gallons in hot weather)
 * Going without water causes exhaustion after 1 day
 * @param {Character} character - Character object
 * @param {string} terrain - Current terrain type (for hot weather check)
 * @returns {object} Result { exhaustionGained, message }
 */
export function applyDehydration(character, terrain = 'grassland') {
  if (!character) {
    return { exhaustionGained: 0, message: 'No character provided' };
  }

  // In desert terrain, dehydration is more severe
  const isHotWeather = terrain === 'desert';
  const daysBeforeDehydration = isHotWeather ? 0.5 : 1; // Half day in desert

  if (character.daysWithoutWater >= daysBeforeDehydration) {
    // Gain exhaustion (more severe in desert)
    const exhaustionToGain = isHotWeather ? 2 : 1;
    const oldLevel = character.exhaustionLevel;
    character.exhaustionLevel = Math.min(6, character.exhaustionLevel + exhaustionToGain);

    const effects = getExhaustionEffects(character.exhaustionLevel);

    return {
      exhaustionGained: exhaustionToGain,
      message: `Dehydration! Exhaustion level ${oldLevel} → ${character.exhaustionLevel}. ${effects.description}`,
      newLevel: character.exhaustionLevel,
      effects: effects.description
    };
  }

  return { exhaustionGained: 0, message: 'No dehydration effects' };
}

/**
 * Forage for food (Survival check - Wisdom based)
 * DC varies by terrain type
 * @param {Character} character - Character object
 * @param {string} terrainKey - Terrain type key
 * @param {DiceRoller} diceRoller - DiceRoller instance
 * @returns {object} Result { success, rationsGained, message, roll }
 */
export function forage(character, terrainKey, diceRoller) {
  if (!character || !diceRoller) {
    return { success: false, rationsGained: 0, message: 'Invalid parameters' };
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

  const dc = forageDCs[terrainKey] || 15;

  // Survival check (Wisdom + Proficiency if proficient in Survival)
  // For simplicity, assume all characters are proficient in Survival
  const wisdomScore = character.abilities.wisdom;
  const result = diceRoller.skillCheck(
    { wisdom: wisdomScore, proficiencyBonus: character.proficiencyBonus },
    'wisdom',
    true, // Proficient in Survival
    dc,
    'normal'
  );

  if (result.success) {
    // Success - gain 1d4 rations (1-4 days)
    const rationsGained = diceRoller.rollDice(4);
    character.rations += rationsGained;

    return {
      success: true,
      rationsGained,
      message: `Foraging successful! Found ${rationsGained} day(s) of food. (Roll: ${result.roll} + ${result.modifier} = ${result.total} vs DC ${dc})`,
      roll: result
    };
  } else {
    // Failure - no food found
    return {
      success: false,
      rationsGained: 0,
      message: `Foraging failed. No food found. (Roll: ${result.roll} + ${result.modifier} = ${result.total} vs DC ${dc})`,
      roll: result
    };
  }
}

/**
 * Find water source (Survival check - Wisdom based)
 * DC varies by terrain, easier near rivers and forests
 * @param {Character} character - Character object
 * @param {string} terrainKey - Terrain type key
 * @param {DiceRoller} diceRoller - DiceRoller instance
 * @returns {object} Result { success, waterGained, message, roll }
 */
export function findWater(character, terrainKey, diceRoller) {
  if (!character || !diceRoller) {
    return { success: false, waterGained: 0, message: 'Invalid parameters' };
  }

  // Terrain-based DCs for finding water
  const waterDCs = {
    river: 5,      // Very easy near rivers
    water: 5,      // Very easy near water
    swamp: 8,      // Easy in swamps (but might be unclean)
    forest: 10,    // Moderate in forests
    grassland: 12, // Moderate in grasslands
    hills: 15,     // Hard in hills
    mountains: 15, // Hard in mountains
    tundra: 18,    // Very hard in tundra (frozen)
    desert: 20     // Extremely hard in desert
  };

  const dc = waterDCs[terrainKey] || 15;

  // Survival check (Wisdom + Proficiency)
  const wisdomScore = character.abilities.wisdom;
  const result = diceRoller.skillCheck(
    { wisdom: wisdomScore, proficiencyBonus: character.proficiencyBonus },
    'wisdom',
    true, // Proficient in Survival
    dc,
    'normal'
  );

  if (result.success) {
    // Success - gain 1d4 + 1 days of water (2-5 days)
    const waterGained = diceRoller.rollDice(4) + 1;
    character.water += waterGained;

    return {
      success: true,
      waterGained,
      message: `Found water! Gained ${waterGained} day(s) of water. (Roll: ${result.roll} + ${result.modifier} = ${result.total} vs DC ${dc})`,
      roll: result
    };
  } else {
    // Failure - no water found
    return {
      success: false,
      waterGained: 0,
      message: `No water source found. (Roll: ${result.roll} + ${result.modifier} = ${result.total} vs DC ${dc})`,
      roll: result
    };
  }
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
