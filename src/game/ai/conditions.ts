// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * conditions.js - AI Condition Registry
 * Functions that return true/false for behavior tree conditions
 */

import { getHexDistance } from '../../contexts/GameStateContext';
import { checkLineOfSight } from '../LineOfSight';
import logger from '../../utils/logger';

/**
 * Condition context passed to all condition functions
 * @typedef {Object} ConditionContext
 * @property {Object} combatant - Current combatant object
 * @property {Object} battlefield - Battlefield grid
 * @property {Array} turnOrder - All combatants in combat
 * @property {number} movementRemaining - Movement remaining this turn
 * @property {Object} params - Condition parameters from JSON
 */

/**
 * Check if combatant's HP is below a threshold
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function hpBelow(context) {
  const { combatant, params } = context;
  const threshold = params.value || 0.25;
  const hpPercent = combatant.currentHP / combatant.maxHP;
  return hpPercent < threshold;
}

/**
 * Check if combatant's HP is above a threshold
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function hpAbove(context) {
  const { combatant, params } = context;
  const threshold = params.value || 0.75;
  const hpPercent = combatant.currentHP / combatant.maxHP;
  return hpPercent > threshold;
}

/**
 * Check if combatant has a specific ability
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function hasAbility(context) {
  const { combatant, params } = context;
  const enemy = combatant.enemy || combatant.character;

  // If specific ability name provided, check for it
  if (params.ability) {
    return enemy.specialAbilities?.some(a => a.name === params.ability) || false;
  }

  // Otherwise, check if has any abilities
  return enemy.specialAbilities?.length > 0 || false;
}

/**
 * Check if ability has uses remaining
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function abilityReady(context) {
  const { combatant, params } = context;
  const enemy = combatant.enemy || combatant.character;

  if (!params.ability) return false;

  const ability = enemy.specialAbilities?.find(a => a.name === params.ability);
  if (!ability) return false;

  // If ability has uses, check if any remaining
  if (ability.uses !== undefined) {
    return (ability.usesRemaining || ability.uses) > 0;
  }

  // No use limit = always ready
  return true;
}

/**
 * Random chance check (0.0 - 1.0)
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function randomChance(context) {
  const { params } = context;
  const probability = params.value || 0.5;
  return Math.random() < probability;
}

/**
 * Check if any enemy is within melee range (1 hex)
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function inMeleeRange(context) {
  const { combatant, turnOrder } = context;

  if (!combatant.position) return false;

  // Get all living enemies (opposite faction)
  const enemies = turnOrder.filter(c => {
    if (combatant.isEnemy) {
      return c.isAlly && c.currentHP > 0;
    } else {
      return c.isEnemy && c.currentHP > 0;
    }
  });

  // Check if any enemy is adjacent (1 hex away)
  return enemies.some(enemy => {
    if (!enemy.position) return false;

    const distance = getHexDistance(
      combatant.position.col,
      combatant.position.row,
      enemy.position.col,
      enemy.position.row
    );

    return distance <= 1;
  });
}

/**
 * Check if combatant is in range of any enemy
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function inRange(context) {
  const { combatant, turnOrder, params } = context;
  const range = params.value || 12; // Default 12 hexes (60 feet)

  if (!combatant.position) return false;

  // Get all living enemies
  const enemies = turnOrder.filter(c => {
    if (combatant.isEnemy) {
      return c.isAlly && c.currentHP > 0;
    } else {
      return c.isEnemy && c.currentHP > 0;
    }
  });

  return enemies.some(enemy => {
    if (!enemy.position) return false;

    const distance = getHexDistance(
      combatant.position.col,
      combatant.position.row,
      enemy.position.col,
      enemy.position.row
    );

    return distance <= range;
  });
}

/**
 * Check if combatant has line of sight to any enemy
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function hasLineOfSight(context) {
  const { combatant, turnOrder, battlefield } = context;

  if (!combatant.position || !battlefield) return false;

  // Get all living enemies
  const enemies = turnOrder.filter(c => {
    if (combatant.isEnemy) {
      return c.isAlly && c.currentHP > 0;
    } else {
      return c.isEnemy && c.currentHP > 0;
    }
  });

  return enemies.some(enemy => {
    if (!enemy.position) return false;
    return checkLineOfSight(combatant.position, enemy.position, battlefield);
  });
}

/**
 * Check if combatant is an ally (for future NPC allies)
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function isAlly(context) {
  const { combatant } = context;
  return combatant.isAlly === true;
}

/**
 * Check if combatant is an enemy
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function isEnemy(context) {
  const { combatant } = context;
  return combatant.isEnemy === true;
}

/**
 * Check if combatant is NOT in backline
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function notInBackline(context) {
  const { combatant, battlefield } = context;

  if (!combatant.position || !battlefield) return true;

  // Backline is the back third of battlefield
  const backlineThreshold = Math.floor((battlefield.height * 2) / 3);
  return combatant.position.row < backlineThreshold;
}

/**
 * Check if combatant has ranged attacks
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function hasRangedAttack(context) {
  const { combatant } = context;
  const enemy = combatant.enemy || combatant.character;

  if (!enemy) return false;

  // Check if enemy has ranged attacks
  if (enemy.attacks) {
    return enemy.attacks.some(attack => attack.range && attack.range > 1);
  }

  // Check enemy.range property (set by CR stat table)
  return enemy.range > 1;
}

/**
 * Condition registry - maps condition names to functions
 */
export const CONDITIONS = {
  hpBelow,
  hpAbove,
  hasAbility,
  abilityReady,
  randomChance,
  inMeleeRange,
  inRange,
  hasLineOfSight,
  isAlly,
  isEnemy,
  notInBackline,
  hasRangedAttack,
};

/**
 * Execute a condition by name
 * @param {string} conditionName - Name of condition to execute
 * @param {ConditionContext} context - Condition context
 * @returns {boolean} Condition result
 */
export function executeCondition(conditionName, context) {
  const condition = CONDITIONS[conditionName];

  if (!condition) {
    logger.combat.error(`[AI] Unknown condition: ${conditionName}`);
    return false;
  }

  return condition(context);
}

export default CONDITIONS;
