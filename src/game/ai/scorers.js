/**
 * scorers.js - Utility AI Scorer Registry
 * Functions that return 0.0-1.0 scores for target selection
 */

import { getHexDistance } from '../../contexts/GameStateContext';

/**
 * Scorer context passed to all scorer functions
 * @typedef {Object} ScorerContext
 * @property {Object} combatant - Current combatant object
 * @property {Object} target - Target being scored
 * @property {Object} battlefield - Battlefield grid
 * @property {Array} turnOrder - All combatants in combat
 * @property {Object} params - Scorer parameters from JSON (weight, curve, etc.)
 */

/**
 * Apply curve transformation to raw score
 * @param {number} value - Raw score (0.0-1.0)
 * @param {string} curve - Curve type ('linear', 'inverse', 'quadratic', 'step')
 * @param {number} threshold - Threshold for step curve
 * @returns {number} Transformed score (0.0-1.0)
 */
function applyCurve(value, curve = 'linear', threshold = 0.5) {
  switch (curve) {
    case 'linear':
      return value;

    case 'inverse':
      return 1.0 - value;

    case 'quadratic':
      return value * value;

    case 'step':
      return value >= threshold ? 1.0 : 0.0;

    default:
      return value;
  }
}

/**
 * Score based on target's HP percentage
 * @param {ScorerContext} context
 * @returns {number} Score 0.0-1.0
 */
export function targetHP(context) {
  const { target, params } = context;

  if (!target || target.currentHP === undefined || target.maxHP === undefined) {
    return 0.0;
  }

  const hpPercent = target.currentHP / target.maxHP;
  const curve = params.curve || 'linear';

  return applyCurve(hpPercent, curve);
}

/**
 * Score based on distance to target
 * @param {ScorerContext} context
 * @returns {number} Score 0.0-1.0
 */
export function distance(context) {
  const { combatant, target, params } = context;

  if (!combatant.position || !target.position) {
    return 0.0;
  }

  const dist = getHexDistance(
    combatant.position.col,
    combatant.position.row,
    target.position.col,
    target.position.row
  );

  // Normalize distance (assume max 20 hexes)
  const maxDistance = params.maxDistance || 20;
  const normalizedDist = Math.min(dist / maxDistance, 1.0);

  const curve = params.curve || 'linear';
  return applyCurve(normalizedDist, curve);
}

/**
 * Score based on target's threat level (damage potential)
 * @param {ScorerContext} context
 * @returns {number} Score 0.0-1.0
 */
export function targetThreat(context) {
  const { target, params } = context;

  if (!target) return 0.0;

  const character = target.character || target.enemy;
  if (!character) return 0.0;

  // Estimate threat based on level or CR
  const level = character.level || character.cr || 1;
  const maxLevel = params.maxLevel || 20;
  const normalizedThreat = Math.min(level / maxLevel, 1.0);

  const curve = params.curve || 'linear';
  return applyCurve(normalizedThreat, curve);
}

/**
 * Score based on target's AC (prefer low AC)
 * @param {ScorerContext} context
 * @returns {number} Score 0.0-1.0
 */
export function targetAC(context) {
  const { target, params } = context;

  if (!target) return 0.0;

  const character = target.character || target.enemy;
  if (!character) return 0.0;

  const ac = character.armorClass || character.ac || 10;
  const maxAC = params.maxAC || 25;
  const normalizedAC = Math.min(ac / maxAC, 1.0);

  const curve = params.curve || 'linear';
  return applyCurve(normalizedAC, curve);
}

/**
 * Score 1.0 if target is melee, 0.0 if ranged
 * @param {ScorerContext} context
 * @returns {number} Score 0.0 or 1.0
 */
export function targetIsMelee(context) {
  const { target } = context;

  if (!target) return 0.0;

  const character = target.character || target.enemy;
  if (!character) return 0.0;

  // Check if target has ranged attacks
  const hasRanged = character.attacks?.some(a => a.range && a.range > 1) || character.range > 1;

  return hasRanged ? 0.0 : 1.0;
}

/**
 * Score 1.0 if target is spellcaster, 0.0 otherwise
 * @param {ScorerContext} context
 * @returns {number} Score 0.0 or 1.0
 */
export function targetIsSpellcaster(context) {
  const { target } = context;

  if (!target) return 0.0;

  const character = target.character || target.enemy;
  if (!character) return 0.0;

  // Check if character has spells or spell slots
  const hasSpells = character.spells?.length > 0 || character.spellSlots?.length > 0;

  return hasSpells ? 1.0 : 0.0;
}

/**
 * Random score (adds unpredictability)
 * @param {ScorerContext} context
 * @returns {number} Score 0.0-1.0
 */
export function random(context) {
  return Math.random();
}

/**
 * Score based on number of nearby allies
 * @param {ScorerContext} context
 * @returns {number} Score 0.0-1.0
 */
export function allyCount(context) {
  const { combatant, turnOrder, params } = context;

  if (!combatant.position) return 0.0;

  const range = params.range || 3; // Default 3 hexes
  const maxAllies = params.maxAllies || 5;

  // Count nearby allies
  const nearbyAllies = turnOrder.filter(c => {
    if (!c.position || c.id === combatant.id) return false;

    // Same faction
    const isSameFaction = combatant.isEnemy ? c.isEnemy : c.isAlly;
    if (!isSameFaction) return false;

    const dist = getHexDistance(
      combatant.position.col,
      combatant.position.row,
      c.position.col,
      c.position.row
    );

    return dist <= range && c.currentHP > 0;
  });

  const normalizedCount = Math.min(nearbyAllies.length / maxAllies, 1.0);
  const curve = params.curve || 'linear';

  return applyCurve(normalizedCount, curve);
}

/**
 * Score based on number of nearby enemies
 * @param {ScorerContext} context
 * @returns {number} Score 0.0-1.0
 */
export function enemyCount(context) {
  const { combatant, turnOrder, params } = context;

  if (!combatant.position) return 0.0;

  const range = params.range || 3; // Default 3 hexes
  const maxEnemies = params.maxEnemies || 5;

  // Count nearby enemies
  const nearbyEnemies = turnOrder.filter(c => {
    if (!c.position) return false;

    // Opposite faction
    const isOpposite = combatant.isEnemy ? c.isAlly : c.isEnemy;
    if (!isOpposite) return false;

    const dist = getHexDistance(
      combatant.position.col,
      combatant.position.row,
      c.position.col,
      c.position.row
    );

    return dist <= range && c.currentHP > 0;
  });

  const normalizedCount = Math.min(nearbyEnemies.length / maxEnemies, 1.0);
  const curve = params.curve || 'linear';

  return applyCurve(normalizedCount, curve);
}

/**
 * Scorer registry - maps scorer names to functions
 */
export const SCORERS = {
  targetHP,
  distance,
  targetThreat,
  targetAC,
  targetIsMelee,
  targetIsSpellcaster,
  random,
  allyCount,
  enemyCount,
};

/**
 * Calculate total utility score for a target
 * @param {Array} scorerConfigs - Array of scorer configs from JSON
 * @param {ScorerContext} context - Scorer context
 * @returns {number} Total weighted score
 */
export function calculateScore(scorerConfigs, context) {
  if (!scorerConfigs || scorerConfigs.length === 0) {
    return Math.random(); // Fallback to random if no scorers
  }

  let totalScore = 0;
  let totalWeight = 0;

  for (const config of scorerConfigs) {
    const scorerFunc = SCORERS[config.type];

    if (!scorerFunc) {
      console.warn(`[AI] Unknown scorer type: ${config.type}`);
      continue;
    }

    const weight = config.weight || 1.0;
    const contextWithParams = { ...context, params: config };
    const score = scorerFunc(contextWithParams);

    totalScore += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

export default SCORERS;
