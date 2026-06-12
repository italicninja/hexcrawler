/* eslint-disable @typescript-eslint/no-explicit-any -- loose boundary, see TODO.md */
/**
 * SurvivalManager.ts
 * Manages food, water, and exhaustion mechanics for D&D 5e hexcrawl survival.
 */

export interface ExhaustionEffect {
  description: string;
  penalties: string[];
}

/**
 * D&D 5e Exhaustion Effects (levels 1-6)
 */
export function getExhaustionEffects(level: number): ExhaustionEffect {
  const effects: Record<number, ExhaustionEffect> = {
    0: { description: 'No exhaustion', penalties: [] },
    1: { description: 'Disadvantage on ability checks', penalties: ['disadvantage_checks'] },
    2: { description: 'Speed halved', penalties: ['disadvantage_checks', 'speed_halved'] },
    3: {
      description: 'Disadvantage on attack rolls and saving throws',
      penalties: ['disadvantage_checks', 'speed_halved', 'disadvantage_attacks_saves'],
    },
    4: {
      description: 'Hit point maximum halved',
      penalties: [
        'disadvantage_checks',
        'speed_halved',
        'disadvantage_attacks_saves',
        'hp_max_halved',
      ],
    },
    5: {
      description: 'Speed reduced to 0',
      penalties: [
        'disadvantage_checks',
        'speed_halved',
        'disadvantage_attacks_saves',
        'hp_max_halved',
        'speed_zero',
      ],
    },
    6: { description: 'Death', penalties: ['death'] },
  };
  return effects[level] || effects[0];
}

/**
 * Consume 1 day's ration (called during long rest)
 */
 
export function consumeRations(character: any): {
  success: boolean;
  message: string;
  remaining?: number;
  daysWithout?: number;
} {
  if (!character) {
    return { success: false, message: 'No character provided' };
  }

  if (character.rations > 0) {
    character.rations--;
    character.daysWithoutFood = 0;
    return {
      success: true,
      message: `Consumed 1 day's ration. ${character.rations} days remaining.`,
      remaining: character.rations,
    };
  } else {
    character.daysWithoutFood++;
    return {
      success: false,
      message: `No rations available! Days without food: ${character.daysWithoutFood}`,
      daysWithout: character.daysWithoutFood,
    };
  }
}

/**
 * Consume 1 day's water (DEPRECATED - water removed from survival system)
 */
 
export function consumeWater(_character: any): {
  success: boolean;
  message: string;
  remaining: number;
} {
  return {
    success: true,
    message: 'Water consumption removed from survival system.',
    remaining: 0,
  };
}

/**
 * Apply starvation exhaustion (3+ days without food)
 */
 
export function applyStarvation(character: any): {
  exhaustionGained: number;
  message: string;
  newLevel?: number;
  effects?: string;
} {
  if (!character) {
    return { exhaustionGained: 0, message: 'No character provided' };
  }

  const conModifier = character.getModifier('constitution');
  const daysBeforeStarvation = Math.max(1, 3 + conModifier);

  if (character.daysWithoutFood >= daysBeforeStarvation) {
    const exhaustionToGain = 1;
    const oldLevel = character.exhaustionLevel;
    character.exhaustionLevel = Math.min(6, character.exhaustionLevel + exhaustionToGain);

    const effects = getExhaustionEffects(character.exhaustionLevel);

    return {
      exhaustionGained: exhaustionToGain,
      message: `Starvation! Exhaustion level ${oldLevel} → ${character.exhaustionLevel}. ${effects.description}`,
      newLevel: character.exhaustionLevel,
      effects: effects.description,
    };
  }

  return { exhaustionGained: 0, message: 'No starvation effects' };
}

/**
 * Apply dehydration exhaustion (DEPRECATED - water removed from survival system)
 */
 
export function applyDehydration(
  _character: any,
  _terrain = 'grassland'
): { exhaustionGained: number; message: string } {
  return { exhaustionGained: 0, message: 'Dehydration removed from survival system' };
}

/**
 * Forage for food (Survival check - Wisdom based)
 */
 
export function forage(
  character: any,
  hexes: any[],
  diceRoller: any,
  _currentDay: number
): {
  success: boolean;
  rationsGained: number;
  message: string;
  roll?: any;
  hexesForaged: string[];
  hexCount?: number;
  goodHexCount?: number;
} {
  if (!character || !diceRoller || !hexes || hexes.length === 0) {
    return { success: false, rationsGained: 0, message: 'Invalid parameters', hexesForaged: [] };
  }

  const forageDCs: Record<string, number> = {
    grassland: 10,
    forest: 10,
    hills: 12,
    mountains: 15,
    desert: 20,
    swamp: 12,
    tundra: 15,
    water: 20,
    river: 12,
  };

  const validHexes = hexes.filter(hex => {
    const terrainKey = hex?.terrain?.key;
    return terrainKey && terrainKey !== 'water';
  });

  if (validHexes.length === 0) {
    return {
      success: false,
      rationsGained: 0,
      message: 'No valid terrain to forage',
      hexesForaged: [],
    };
  }

  let totalDC = 0;
  let goodHexCount = 0;

  validHexes.forEach((hex: any) => {
    const terrainKey = hex.terrain.key;
    const hexDC = forageDCs[terrainKey] || 15;
    totalDC += hexDC;
    if (hexDC <= 10) goodHexCount++;
  });

  const averageDC = Math.ceil(totalDC / validHexes.length);

  const wisdomScore = character.abilities.wisdom;
  const result = diceRoller.skillCheck(
    { wisdom: wisdomScore, proficiencyBonus: character.proficiencyBonus },
    'wisdom',
    true,
    averageDC,
    'normal',
    'Survival'
  );

  const hexesForaged = validHexes.map((hex: any) => `${hex.col},${hex.row}`);

  if (result.success) {
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
      goodHexCount,
    };
  } else {
    return {
      success: false,
      rationsGained: 0,
      message: `Foraging failed. No food found in ${validHexes.length} hexes.`,
      roll: result,
      hexesForaged,
      hexCount: validHexes.length,
    };
  }
}

/**
 * Find water source (DEPRECATED - water removed from survival system)
 */
 
export function findWater(
  _character: any,
  _terrainKey: string,
  _diceRoller: any
): { success: boolean; waterGained: number; message: string; roll: null } {
  return {
    success: false,
    waterGained: 0,
    message: 'Water finding removed from survival system.',
    roll: null,
  };
}

/**
 * Reduce exhaustion level (during long rest with food and water)
 */
 
export function reduceExhaustion(character: any): {
  reduced: boolean;
  message: string;
  newLevel?: number;
  effects?: string;
} {
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
      effects: effects.description,
    };
  }

  return { reduced: false, message: 'No exhaustion to reduce' };
}

/**
 * Check if character is affected by exhaustion penalties
 */
 
export function getActiveExhaustionPenalties(character: any): {
  level: number;
  penalties: string[];
  description: string;
} {
  if (!character) {
    return { level: 0, penalties: [], description: 'No exhaustion' };
  }

  const effects = getExhaustionEffects(character.exhaustionLevel);

  return {
    level: character.exhaustionLevel,
    penalties: effects.penalties,
    description: effects.description,
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
  getActiveExhaustionPenalties,
};
