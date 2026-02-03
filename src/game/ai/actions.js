/**
 * actions.js - AI Action Registry
 * Functions that return action objects for the combat system
 */

import { findPath } from '../Pathfinding.js';
import { getHexDistance } from '../../contexts/GameStateContext';
import logger from '../../utils/logger.js';

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
 * Move toward target action
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

  // Try to find path to adjacent hex near target
  const path = findPath(combatant.position, target.position, battlefield, maxMoveHexes);

  if (!path || path.length <= 1) {
    logger.combat.debug('MoveTo action: no path found', {
      combatant: combatant.name,
      target: target.name,
    });
    return { type: 'wait' };
  }

  // Find furthest unoccupied hex along path
  let destination = null;
  let actualDistance = 0;

  for (let i = 1; i < path.length && i <= maxMoveHexes; i++) {
    const hex = path[i];
    const occupied = turnOrder.some(
      c => c.position && c.position.col === hex.col && c.position.row === hex.row
    );

    if (occupied) {
      break; // Stop before occupied hex
    }

    destination = hex;
    actualDistance = i;
  }

  if (!destination || actualDistance === 0) {
    logger.combat.debug('MoveTo action: path blocked', { combatant: combatant.name });
    return { type: 'wait' };
  }

  logger.combat.debug('AI move action', {
    combatant: combatant.name,
    from: combatant.position,
    to: destination,
    distance: actualDistance,
  });

  return {
    type: 'move',
    destination,
    path: path.slice(0, actualDistance + 1),
    moveCost: actualDistance,
  };
}

/**
 * Flee to backline action
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

  // Find furthest unoccupied hex in backline
  const backlineRow = battlefield.height - 1;
  const targetCol = Math.floor(battlefield.width / 2); // Center column

  const targetPos = { col: targetCol, row: backlineRow };
  const path = findPath(combatant.position, targetPos, battlefield, maxMoveHexes);

  if (!path || path.length <= 1) {
    logger.combat.debug('Flee action: no path to backline', {
      combatant: combatant.name,
    });
    return { type: 'wait' };
  }

  // Find furthest unoccupied hex along path
  let destination = null;
  let actualDistance = 0;

  for (let i = 1; i < path.length && i <= maxMoveHexes; i++) {
    const hex = path[i];
    const occupied = turnOrder.some(
      c => c.position && c.position.col === hex.col && c.position.row === hex.row
    );

    if (occupied) break;

    destination = hex;
    actualDistance = i;
  }

  if (!destination || actualDistance === 0) {
    logger.combat.debug('Flee action: path blocked', { combatant: combatant.name });
    return { type: 'wait' };
  }

  logger.combat.info('AI fleeing to backline', {
    combatant: combatant.name,
    from: combatant.position,
    to: destination,
  });

  return {
    type: 'move',
    destination,
    path: path.slice(0, actualDistance + 1),
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
