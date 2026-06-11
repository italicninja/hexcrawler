/**
 * conditions.js - AI Condition Registry
 * Functions that return true/false for behavior tree conditions
 */

import { getHexDistance } from '../../contexts/GameStateContext';
import { checkLineOfSight } from '../LineOfSight';
import logger from '../../utils/logger';

interface HexPos {
  col: number;
  row: number;
}

interface AIEntity {
  specialAbilities?: Array<{ name: string; uses?: number; usesRemaining?: number }>;
  attacks?: Array<{ range?: number }>;
  range?: number;
}

interface AICombatant {
  currentHP: number;
  maxHP: number;
  isEnemy?: boolean;
  isAlly?: boolean;
  position?: HexPos;
  enemy?: AIEntity;
  character?: AIEntity;
}

interface ConditionBattlefield {
  height: number;
  width?: number;
  hexes: Array<{ col: number; row: number; blocked?: boolean }>;
}

interface ConditionParams {
  value?: number;
  ability?: string;
  [key: string]: unknown;
}

export interface ConditionContext {
  combatant: AICombatant;
  battlefield?: ConditionBattlefield;
  turnOrder: AICombatant[];
  movementRemaining?: number;
  params: ConditionParams;
}

/**
 * Check if combatant's HP is below a threshold
 */
export function hpBelow(context: ConditionContext): boolean {
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
export function hpAbove(context: ConditionContext): boolean {
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
export function hasAbility(context: ConditionContext): boolean {
  const { combatant, params } = context;
  const enemy = combatant.enemy || combatant.character;

  // If specific ability name provided, check for it
  if (params.ability) {
    return enemy?.specialAbilities?.some(a => a.name === params.ability) || false;
  }

  // Otherwise, check if has any abilities
  return (enemy?.specialAbilities?.length ?? 0) > 0;
}

/**
 * Check if ability has uses remaining
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function abilityReady(context: ConditionContext): boolean {
  const { combatant, params } = context;
  const enemy = combatant.enemy || combatant.character;

  if (!params.ability) return false;

  const ability = enemy?.specialAbilities?.find(a => a.name === params.ability);
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
export function randomChance(context: ConditionContext): boolean {
  const { params } = context;
  const probability = params.value || 0.5;
  return Math.random() < probability;
}

/**
 * Check if any enemy is within melee range (1 hex)
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function inMeleeRange(context: ConditionContext): boolean {
  const { combatant, turnOrder } = context;

  const pos = combatant.position;
  if (!pos) return false;

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
      pos.col,
      pos.row,
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
export function inRange(context: ConditionContext): boolean {
  const { combatant, turnOrder, params } = context;
  const range = params.value || 12; // Default 12 hexes (60 feet)

  const pos = combatant.position;
  if (!pos) return false;

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
      pos.col,
      pos.row,
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
export function hasLineOfSight(context: ConditionContext): boolean {
  const { combatant, turnOrder, battlefield } = context;

  const pos = combatant.position;
  if (!pos || !battlefield) return false;

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
    return checkLineOfSight(pos, enemy.position, battlefield);
  });
}

/**
 * Check if combatant is an ally (for future NPC allies)
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function isAlly(context: ConditionContext): boolean {
  const { combatant } = context;
  return combatant.isAlly === true;
}

/**
 * Check if combatant is an enemy
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function isEnemy(context: ConditionContext): boolean {
  const { combatant } = context;
  return combatant.isEnemy === true;
}

/**
 * Check if combatant is NOT in backline
 * @param {ConditionContext} context
 * @returns {boolean}
 */
export function notInBackline(context: ConditionContext): boolean {
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
export function hasRangedAttack(context: ConditionContext): boolean {
  const { combatant } = context;
  const enemy = combatant.enemy || combatant.character;

  if (!enemy) return false;

  // Check if enemy has ranged attacks
  if (enemy.attacks) {
    return enemy.attacks.some(attack => attack.range && attack.range > 1);
  }

  // Check enemy.range property (set by CR stat table)
  return (enemy.range ?? 0) > 1;
}

/**
 * Condition registry - maps condition names to functions
 */
export const CONDITIONS: Record<string, (context: ConditionContext) => boolean> = {
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
export function executeCondition(conditionName: string, context: ConditionContext): boolean {
  const condition = CONDITIONS[conditionName];

  if (!condition) {
    logger.combat.error(`[AI] Unknown condition: ${conditionName}`);
    return false;
  }

  return condition(context);
}

export default CONDITIONS;
