/**
 * actions.js - AI Action Registry
 * Functions that return action objects for the combat system
 */

import { getHexDistance, getHexNeighbors } from '../../utils/hexMath';
import logger from '../../utils/logger';

interface HexPos {
  col: number;
  row: number;
}

interface BattlefieldHex {
  col: number;
  row: number;
  blocked?: boolean;
  [key: string]: unknown;
}

interface ActionBattlefield {
  width: number;
  height: number;
  hexes: BattlefieldHex[];
}

interface ActionEntity {
  specialAbilities?: Array<{ name: string }>;
}

interface ActionCombatant {
  name?: string;
  id?: string | number;
  currentHP?: number;
  isEnemy?: boolean;
  isAlly?: boolean;
  position?: HexPos;
  enemy?: ActionEntity;
  character?: ActionEntity;
}

interface ActionParams {
  attackType?: string;
  ability?: string;
  [key: string]: unknown;
}

export interface ActionContext {
  combatant: ActionCombatant;
  battlefield?: ActionBattlefield;
  turnOrder: ActionCombatant[];
  movementRemaining: number;
  params: ActionParams;
  target?: ActionCombatant | null;
}

interface AIAction {
  type: string;
  [key: string]: unknown;
}

/**
 * Attack action (melee or ranged)
 */
export function attack(context: ActionContext): AIAction {
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
export function useAbility(context: ActionContext): AIAction {
  const { combatant, params, target } = context;
  const enemy = combatant.enemy || combatant.character;

  // Get ability to use (either from params or first available)
  let ability: { name: string } | undefined;

  if (params.ability) {
    ability = enemy?.specialAbilities?.find(a => a.name === params.ability);
  } else if ((enemy?.specialAbilities?.length ?? 0) > 0) {
    // Use first available ability
    ability = enemy?.specialAbilities?.[0];
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
function buildHexMap(hexes: BattlefieldHex[]): Map<string, BattlefieldHex> {
  const map = new Map<string, BattlefieldHex>();
  hexes.forEach(h => map.set(`${h.col},${h.row}`, h));
  return map;
}

/**
 * Get all valid, unblocked hex neighbours for a given position.
 * Uses getHexNeighbors from hexMath for offsets, then filters by
 * battlefield bounds and blocked status.
 */
function getNeighbours(
  pos: HexPos,
  battlefield: ActionBattlefield,
  hexMap: Map<string, BattlefieldHex>
): HexPos[] {
  const { width, height } = battlefield;

  return getHexNeighbors(pos.col, pos.row).filter(n => {
    if (n.col < 0 || n.row < 0 || n.col >= width || n.row >= height) return false;
    const hex = hexMap.get(`${n.col},${n.row}`);
    return hex && !hex.blocked;
  });
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
export function moveTo(context: ActionContext): AIAction {
  const { combatant, battlefield, turnOrder, movementRemaining, target } = context;

  if (!combatant.position || !battlefield) {
    logger.combat.error('MoveTo action: combatant has no position', {
      combatant: combatant.name,
    });
    return { type: 'wait' };
  }
  const fromPos = combatant.position;

  if (!target || !target.position) {
    logger.combat.warn('MoveTo action: no valid target', { combatant: combatant.name });
    return { type: 'wait' };
  }
  const targetPos = target.position;

  const maxMoveHexes = Math.floor(movementRemaining / 5); // Convert feet to hexes
  if (maxMoveHexes <= 0) return { type: 'wait' };

  // Build lookup structures once
  const hexMap = buildHexMap(battlefield.hexes);

  // Build an occupancy set for fast lookup
  const occupiedSet = new Set(
    turnOrder
      .filter(c => c.position && c.id !== combatant.id)
      .map(c => `${c.position!.col},${c.position!.row}`)
  );

  // Direction vector toward target
  const dx = targetPos.col - fromPos.col;
  const dy = targetPos.row - fromPos.row;
  const targetDist = Math.sqrt(dx * dx + dy * dy);

  // Walk step-by-step, building path
  const path: HexPos[] = [fromPos];
  let current: HexPos = fromPos;

  for (let step = 0; step < maxMoveHexes; step++) {
    // Stop one hex away from target so we don't move onto the target's hex
    const distToTarget = getHexDistance(current.col, current.row, targetPos.col, targetPos.row);
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
export function flee(context: ActionContext): AIAction {
  const { combatant, battlefield, turnOrder, movementRemaining } = context;

  if (!combatant.position || !battlefield) {
    logger.combat.error('Flee action: invalid position/battlefield', {
      combatant: combatant.name,
    });
    return { type: 'wait' };
  }
  const fromPos = combatant.position;

  const maxMoveHexes = Math.floor(movementRemaining / 5);
  if (maxMoveHexes <= 0) return { type: 'wait' };

  // Find nearest enemy (opposite faction)
  const threats = turnOrder.filter(c => {
    if (!c.position || (c.currentHP ?? 0) <= 0) return false;
    return combatant.isEnemy ? c.isAlly : c.isEnemy;
  });

  if (threats.length === 0) return { type: 'wait' };

  // Find closest threat
  const nearest = threats.reduce((closest, c) => {
    const d = getHexDistance(fromPos.col, fromPos.row, c.position!.col, c.position!.row);
    const dc = getHexDistance(
      fromPos.col,
      fromPos.row,
      closest.position!.col,
      closest.position!.row
    );
    return d < dc ? c : closest;
  });

  // Direction AWAY from nearest threat
  const dx = fromPos.col - nearest.position!.col;
  const dy = fromPos.row - nearest.position!.row;
  const threatDist = Math.sqrt(dx * dx + dy * dy) || 1;

  const hexMap = buildHexMap(battlefield.hexes);

  const occupiedSet = new Set(
    turnOrder
      .filter(c => c.position && c.id !== combatant.id)
      .map(c => `${c.position!.col},${c.position!.row}`)
  );

  const path: HexPos[] = [fromPos];
  let current: HexPos = fromPos;

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
export function dodge(context: ActionContext): AIAction {
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
export function dash(context: ActionContext): AIAction {
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
export function wait(context: ActionContext): AIAction {
  const { combatant } = context;

  logger.combat.debug('AI wait action', { combatant: combatant.name });

  return {
    type: 'wait',
  };
}

/**
 * Action registry - maps action names to functions
 */
export const ACTIONS: Record<string, (context: ActionContext) => AIAction> = {
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
export function executeAction(actionName: string, context: ActionContext): AIAction {
  const action = ACTIONS[actionName];

  if (!action) {
    logger.combat.error('Unknown action', { actionName });
    return { type: 'wait' };
  }

  return action(context);
}

export default ACTIONS;
