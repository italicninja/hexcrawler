// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * actions.js - AI Action Registry
 * Functions that return action objects for the combat system
 */

import { findPath } from '../Pathfinding';
import { getHexDistance } from '../../utils/hexMath';
import logger from '../../utils/logger';

/**
 * Action context passed to all action functions
 * @typedef {Object} ActionContext
 * @property {Object} combatant - Current combatant object
 * @property {Object} battlefield - Battlefield grid
 * @property {Array} turnOrder - All combatants in combat
 * @property {number} movementRemaining - Movement remaining this turn
 * @property {Object} params - Action parameters from JSON
 * @property {Object} target - Target combatant (if selected by utility scorer)
 */

/**
 * Attack action (melee or ranged)
 * @param {ActionContext} context
 * @returns {Object} Attack action
 */
export function attack(context) {
  const { combatant, params, target } = context;

  if (!target) {
    logger.combat.warn('Attack action called without target', { combatant: combatant.name });
    return { type: 'wait' };
  }

  const attackType = params.attackType || 'melee';

  logger.combat.debug('AI attack action', {
    combatant: combatant.name,
    target: target.name,
    attackType,
  });

  return {
    type: 'attack',
    target,
    attackType,
  };
}

/**
 * Use special ability action
 * @param {ActionContext} context
 * @returns {Object} Ability action
 */
export function useAbility(context) {
  const { combatant, params, target } = context;
  const enemy = combatant.enemy || combatant.character;

  // Get ability to use (either from params or first available)
  let ability = null;

  if (params.ability) {
    ability = enemy.specialAbilities?.find(a => a.name === params.ability);
  } else if (enemy.specialAbilities?.length > 0) {
    // Use first available ability
    ability = enemy.specialAbilities[0];
  }

  if (!ability) {
    logger.combat.warn('No ability found for useAbility action', {
      combatant: combatant.name,
      requestedAbility: params.ability,
    });
    return { type: 'wait' };
  }

  logger.combat.debug('AI ability action', {
    combatant: combatant.name,
    ability: ability.name,
    target: target?.name,
  });

  return {
    type: 'ability',
    ability: ability.name,
    target,
  };
}

/**
 * Build a hex lookup map from the flat hexes array.
 * Called once per action so the inner loops are O(1) per hex lookup.
 */
function buildHexMap(hexes) {
  const map = new Map();
  hexes.forEach(h => map.set(`${h.col},${h.row}`, h));
  return map;
}

/**
 * Get all valid, unblocked hex neighbours for a given position.
 * Uses the same row-parity offset scheme as Pathfinding.ts so both systems
 * agree on adjacency.
 */
function getNeighbours(pos, battlefield, hexMap) {
  const { col, row } = pos;
  const { width, height } = battlefield;

  // Same offsets as Pathfinding.getHexNeighbors — row-parity (even/odd row)
  const offsets =
    Math.abs(row % 2) === 0
      ? [
          [-1, -1],
          [0, -1],
          [-1, 0],
          [1, 0],
          [-1, 1],
          [0, 1],
        ] // even row
      : [
          [0, -1],
          [1, -1],
          [-1, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]; // odd row

  const neighbours = [];
  for (const [dc, dr] of offsets) {
    const nc = col + dc;
    const nr = row + dr;
    if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
    const hex = hexMap.get(`${nc},${nr}`);
    if (!hex || hex.blocked) continue;
    neighbours.push({ col: nc, row: nr });
  }
  return neighbours;
}

/**
 * Move toward target action — weighted random walk.
 * Scores each reachable neighbour by:
 *   score = cos(angle_toward_target) * 0.75 + random * 0.25
 * Picks the highest-scored unoccupied neighbour that is reachable.
 * Repeats step-by-step up to maxMoveHexes, building a path.
 *
 * This gives natural-looking movement that generally converges on the
 * target while occasionally deviating one hex off the optimal line,
 * preventing enemies from queuing up in single-file columns.
 *
 * @param {ActionContext} context
 * @returns {Object} Move action
 */
export function moveTo(context) {
  const { combatant, battlefield, turnOrder, movementRemaining, target } = context;

  if (!combatant.position) {
    logger.combat.error('MoveTo action: combatant has no position', {
      combatant: combatant.name,
    });
    return { type: 'wait' };
  }

  if (!target || !target.position) {
    logger.combat.warn('MoveTo action: no valid target', { combatant: combatant.name });
    return { type: 'wait' };
  }

  const maxMoveHexes = Math.floor(movementRemaining / 5); // Convert feet to hexes
  if (maxMoveHexes <= 0) return { type: 'wait' };

  // Build lookup structures once
  const hexMap = buildHexMap(battlefield.hexes);

  // Build an occupancy set for fast lookup
  const occupiedSet = new Set(
    turnOrder
      .filter(c => c.position && c.id !== combatant.id)
      .map(c => `${c.position.col},${c.position.row}`)
  );

  // Direction vector toward target
  const dx = target.position.col - combatant.position.col;
  const dy = target.position.row - combatant.position.row;
  const targetDist = Math.sqrt(dx * dx + dy * dy);

  // Walk step-by-step, building path
  const path = [combatant.position];
  let current = combatant.position;

  for (let step = 0; step < maxMoveHexes; step++) {
    // Stop one hex away from target so we don't move onto the target's hex
    const distToTarget = getHexDistance(
      current.col,
      current.row,
      target.position.col,
      target.position.row
    );
    if (distToTarget <= 1) break;

    const neighbours = getNeighbours(current, battlefield, hexMap);

    // Score each unoccupied neighbour
    const candidates = neighbours
      .filter(n => !occupiedSet.has(`${n.col},${n.row}`))
      .map(n => {
        // Vector from current to this neighbour
        const ndx = n.col - current.col;
        const ndy = n.row - current.row;
        const nLen = Math.sqrt(ndx * ndx + ndy * ndy) || 1;

        // Cosine similarity toward target direction (ranges -1 to +1)
        let cosAngle = 0;
        if (targetDist > 0) {
          cosAngle = (ndx / nLen) * (dx / targetDist) + (ndy / nLen) * (dy / targetDist);
        }

        // Normalise to 0–1 range, weight toward target (0.75) + randomness (0.25)
        const score = ((cosAngle + 1) / 2) * 0.75 + Math.random() * 0.25;
        return { hex: n, score };
      });

    if (candidates.length === 0) break;

    // Sort descending and pick the top candidate
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0].hex;

    occupiedSet.add(`${chosen.col},${chosen.row}`);
    path.push(chosen);
    current = chosen;
  }

  if (path.length <= 1) {
    logger.combat.debug('MoveTo action: no movement possible', { combatant: combatant.name });
    return { type: 'wait' };
  }

  const destination = path[path.length - 1];
  const actualDistance = path.length - 1;

  logger.combat.debug('AI move action (weighted walk)', {
    combatant: combatant.name,
    from: combatant.position,
    to: destination,
    steps: actualDistance,
  });

  return {
    type: 'move',
    destination,
    path,
    moveCost: actualDistance,
  };
}

/**
 * Flee action — move away from the nearest enemy.
 * Computes the direction vector away from the nearest threat and uses the
 * weighted random walk (same logic as moveTo) but inverted: prefers hexes
 * that move away from enemies rather than toward them.
 *
 * @param {ActionContext} context
 * @returns {Object} Move action
 */
export function flee(context) {
  const { combatant, battlefield, turnOrder, movementRemaining } = context;

  if (!combatant.position || !battlefield) {
    logger.combat.error('Flee action: invalid position/battlefield', {
      combatant: combatant.name,
    });
    return { type: 'wait' };
  }

  const maxMoveHexes = Math.floor(movementRemaining / 5);
  if (maxMoveHexes <= 0) return { type: 'wait' };

  // Find nearest enemy (opposite faction)
  const threats = turnOrder.filter(c => {
    if (!c.position || c.currentHP <= 0) return false;
    return combatant.isEnemy ? c.isAlly : c.isEnemy;
  });

  if (threats.length === 0) return { type: 'wait' };

  // Find closest threat
  const nearest = threats.reduce((closest, c) => {
    const d = getHexDistance(
      combatant.position.col,
      combatant.position.row,
      c.position.col,
      c.position.row
    );
    const dc = getHexDistance(
      combatant.position.col,
      combatant.position.row,
      closest.position.col,
      closest.position.row
    );
    return d < dc ? c : closest;
  });

  // Direction AWAY from nearest threat
  const dx = combatant.position.col - nearest.position.col;
  const dy = combatant.position.row - nearest.position.row;
  const threatDist = Math.sqrt(dx * dx + dy * dy) || 1;

  const hexMap = buildHexMap(battlefield.hexes);

  const occupiedSet = new Set(
    turnOrder
      .filter(c => c.position && c.id !== combatant.id)
      .map(c => `${c.position.col},${c.position.row}`)
  );

  const path = [combatant.position];
  let current = combatant.position;

  for (let step = 0; step < maxMoveHexes; step++) {
    const neighbours = getNeighbours(current, battlefield, hexMap);

    const candidates = neighbours
      .filter(n => !occupiedSet.has(`${n.col},${n.row}`))
      .map(n => {
        const ndx = n.col - current.col;
        const ndy = n.row - current.row;
        const nLen = Math.sqrt(ndx * ndx + ndy * ndy) || 1;

        // Cosine similarity in the AWAY direction
        const cosAngle = (ndx / nLen) * (dx / threatDist) + (ndy / nLen) * (dy / threatDist);
        const score = ((cosAngle + 1) / 2) * 0.75 + Math.random() * 0.25;
        return { hex: n, score };
      });

    if (candidates.length === 0) break;

    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0].hex;

    occupiedSet.add(`${chosen.col},${chosen.row}`);
    path.push(chosen);
    current = chosen;
  }

  if (path.length <= 1) {
    logger.combat.debug('Flee action: no movement possible', { combatant: combatant.name });
    return { type: 'wait' };
  }

  const destination = path[path.length - 1];
  const actualDistance = path.length - 1;

  logger.combat.info('AI fleeing away from threat', {
    combatant: combatant.name,
    fleeingFrom: nearest.name,
    from: combatant.position,
    to: destination,
  });

  return {
    type: 'move',
    destination,
    path,
    moveCost: actualDistance,
  };
}

/**
 * Dodge action (defensive stance)
 * @param {ActionContext} context
 * @returns {Object} Dodge action
 */
export function dodge(context) {
  const { combatant } = context;

  logger.combat.debug('AI dodge action', { combatant: combatant.name });

  return {
    type: 'dodge',
  };
}

/**
 * Dash action (double movement)
 * @param {ActionContext} context
 * @returns {Object} Dash action
 */
export function dash(context) {
  const { combatant } = context;

  logger.combat.debug('AI dash action', { combatant: combatant.name });

  return {
    type: 'dash',
  };
}

/**
 * Wait/pass turn action
 * @param {ActionContext} context
 * @returns {Object} Wait action
 */
export function wait(context) {
  const { combatant } = context;

  logger.combat.debug('AI wait action', { combatant: combatant.name });

  return {
    type: 'wait',
  };
}

/**
 * Action registry - maps action names to functions
 */
export const ACTIONS = {
  attack,
  useAbility,
  moveTo,
  flee,
  dodge,
  dash,
  wait,
};

/**
 * Execute an action by name
 * @param {string} actionName - Name of action to execute
 * @param {ActionContext} context - Action context
 * @returns {Object} Action object
 */
export function executeAction(actionName, context) {
  const action = ACTIONS[actionName];

  if (!action) {
    logger.combat.error('Unknown action', { actionName });
    return { type: 'wait' };
  }

  return action(context);
}

export default ACTIONS;
