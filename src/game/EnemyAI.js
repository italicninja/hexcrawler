/**
 * EnemyAI - Enemy decision-making AI for tactical combat
 * Implements simple but tactical enemy behavior
 */

import { findPath } from './Pathfinding.js';
import { checkLineOfSight, isInRange } from './LineOfSight.js';
import { getHexDistance } from '../contexts/GameStateContext';

/**
 * Enemy AI decision-making system
 * Analyzes battlefield state and returns optimal action
 */
export class EnemyAI {
  /**
   * Decide what action the enemy should take
   * @param {Object} enemyCombatant - Enemy combatant object from turnOrder
   * @param {Object} battlefield - Battlefield object {hexes, width, height}
   * @param {Array} turnOrder - All combatants in turn order
   * @param {number} movementRemaining - Movement remaining for this turn
   * @returns {Object} {type, target?, destination?, path?, moveCost?}
   *
   * Action types:
   * - 'attack': Attack a target (melee or ranged)
   * - 'move': Move to a position
   * - 'ability': Use special ability
   * - 'wait': Do nothing
   */
  static decideAction(enemyCombatant, battlefield, turnOrder, movementRemaining) {
    const enemy = enemyCombatant.enemy;
    if (!enemy) {
      console.error('[EnemyAI] No enemy object found on combatant');
      return { type: 'wait' };
    }

    // Get all living ally characters (player party)
    const livingAllies = turnOrder.filter(c => c.isAlly && c.currentHP > 0);

    if (livingAllies.length === 0) {
      return { type: 'wait' };
    }

    // Get enemy position from combatant
    const enemyPos = enemyCombatant.position;
    if (!enemyPos) {
      console.error('[EnemyAI] Enemy has no position');
      return { type: 'wait' };
    }

    // Decision tree:
    // 1. If HP < 25% and not in backline → Reposition to backline
    const hpPercent = enemyCombatant.currentHP / enemyCombatant.maxHP;
    if (hpPercent < 0.25 && !this._isInBackline(enemyPos, battlefield)) {
      return this._repositionToBackline(
        enemyCombatant,
        enemyPos,
        battlefield,
        turnOrder,
        movementRemaining
      );
    }

    // 2. If has special ability and 30% random chance → Use ability
    if (enemy.specialAbilities && enemy.specialAbilities.length > 0 && Math.random() < 0.3) {
      const ability = enemy.specialAbilities[0]; // Use first special ability
      const target = this._chooseTarget(livingAllies, 'lowestHp');

      return {
        type: 'ability',
        ability: ability.name,
        target: target,
      };
    }

    // 3. If in melee range (1 hex) → Attack nearest
    const nearestAlly = this._findNearestEnemy(enemyPos, livingAllies);
    const distanceToNearest = getHexDistance(
      enemyPos.col,
      enemyPos.row,
      nearestAlly.position.col,
      nearestAlly.position.row
    );

    if (distanceToNearest <= 1) {
      return {
        type: 'attack',
        target: nearestAlly,
        attackType: 'melee',
      };
    }

    // 4. If ranged weapon/spell and LoS → Attack lowest HP target
    if (this._hasRangedAttack(enemy)) {
      const target = this._chooseTarget(livingAllies, 'lowestHp');
      const hasLOS = checkLineOfSight(enemyPos, target.position, battlefield);
      const inRange = isInRange(enemyPos, target.position, 12); // 12 hex range for ranged

      if (hasLOS && inRange) {
        return {
          type: 'attack',
          target: target,
          attackType: 'ranged',
        };
      }
    }

    // 5. Otherwise → Move toward nearest ally using pathfinding
    const moveTarget = this._findNearestEnemy(enemyPos, livingAllies);
    const maxMoveHexes = Math.floor(movementRemaining / 5); // Convert feet to hexes

    // Try to find a path to an adjacent hex near the target
    // If target position is occupied, find best adjacent hex
    let targetPosition = moveTarget.position;
    let path = findPath(enemyPos, targetPosition, battlefield, maxMoveHexes);

    // If no direct path (target occupied), try adjacent hexes
    if (!path) {
      const adjacentHexes = this._getAdjacentHexes(targetPosition, battlefield);

      // Filter to unoccupied hexes
      const validAdjacent = adjacentHexes.filter(hex => {
        const occupied = turnOrder.some(
          c => c.position && c.position.col === hex.col && c.position.row === hex.row
        );
        return !occupied && !hex.blocked;
      });

      // Try each adjacent hex, find closest one we can path to
      let bestPath = null;
      let shortestDistance = Infinity;

      for (const adjHex of validAdjacent) {
        const adjPath = findPath(enemyPos, adjHex, battlefield, maxMoveHexes);
        if (adjPath && adjPath.length < shortestDistance) {
          bestPath = adjPath;
          shortestDistance = adjPath.length;
        }
      }

      path = bestPath;
    }

    if (path && path.length > 1) {
      // Move along path up to movement remaining
      const movableDistance = Math.min(path.length - 1, maxMoveHexes);

      // Find furthest unoccupied hex along the path
      let destination = null;
      let actualDistance = 0;

      for (let i = 1; i <= movableDistance && i < path.length; i++) {
        const hex = path[i];
        const occupied = turnOrder.some(
          c => c.position && c.position.col === hex.col && c.position.row === hex.row
        );

        if (occupied) {
          // Stop before occupied hex
          break;
        }

        destination = hex;
        actualDistance = i;
      }

      // If we found a valid destination, move there
      if (destination && actualDistance > 0) {
        return {
          type: 'move',
          destination: destination,
          path: path.slice(0, actualDistance + 1),
          moveCost: actualDistance,
        };
      }
    }

    // Can't do anything useful
    return { type: 'wait' };
  }

  /**
   * Choose target based on strategy
   * @param {Array} enemies - Array of potential targets
   * @param {string} preference - 'lowestHp', 'highestThreat', 'random'
   * @returns {Object} Selected target
   */
  static _chooseTarget(enemies, preference = 'lowestHp') {
    if (enemies.length === 0) return null;
    if (enemies.length === 1) return enemies[0];

    switch (preference) {
      case 'lowestHp':
        return enemies.reduce((lowest, enemy) => {
          return enemy.currentHP < lowest.currentHP ? enemy : lowest;
        });

      case 'highestThreat':
        // Threat = damage output (approximated by level or max HP)
        return enemies.reduce((highest, enemy) => {
          const threat = enemy.level || enemy.maxHP / 10;
          const highestThreat = highest.level || highest.maxHP / 10;
          return threat > highestThreat ? enemy : highest;
        });

      case 'random':
        return enemies[Math.floor(Math.random() * enemies.length)];

      default:
        return enemies[0];
    }
  }

  /**
   * Find nearest enemy to a position
   * @param {Object} position - {col, row}
   * @param {Array} enemies - Array of enemies
   * @returns {Object} Nearest enemy
   */
  static _findNearestEnemy(position, enemies) {
    let nearest = enemies[0];
    let minDistance = Infinity;

    enemies.forEach(enemy => {
      if (!enemy.position) return;

      const distance = getHexDistance(
        position.col,
        position.row,
        enemy.position.col,
        enemy.position.row
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    });

    return nearest;
  }

  /**
   * Get adjacent hexes to a position (hex neighbors)
   * @param {Object} position - {col, row}
   * @param {Object} battlefield - Battlefield object with {hexes, width, height}
   * @returns {Array} Array of adjacent hex objects
   */
  static _getAdjacentHexes(position, battlefield) {
    const { col, row } = position;
    const { width, height, hexes } = battlefield;

    // Hex grid neighbor offsets (flat-top orientation)
    const offsets =
      Math.abs(row % 2) === 0
        ? [
            [-1, -1],
            [0, -1],
            [-1, 0],
            [1, 0],
            [-1, 1],
            [0, 1],
          ] // Even row
        : [
            [0, -1],
            [1, -1],
            [-1, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ]; // Odd row

    const adjacent = [];

    for (const [dc, dr] of offsets) {
      const newCol = col + dc;
      const newRow = row + dr;

      // Check bounds
      if (newCol >= 0 && newCol < width && newRow >= 0 && newRow < height) {
        // Find the hex object
        const hex = hexes.find(h => h.col === newCol && h.row === newRow);
        if (hex) {
          adjacent.push(hex);
        }
      }
    }

    return adjacent;
  }

  /**
   * Check if enemy has ranged attacks
   * @param {Object} enemy - Enemy object
   * @returns {boolean}
   */
  static _hasRangedAttack(enemy) {
    // Check if enemy has ranged attacks
    if (enemy.attacks) {
      return enemy.attacks.some(attack => attack.range && attack.range > 1);
    }

    // Default: assume melee only
    return false;
  }

  /**
   * Check if position is in backline (away from enemies)
   * @param {Object} position - {col, row}
   * @param {Object} battlefield - Battlefield object
   * @returns {boolean}
   */
  static _isInBackline(position, battlefield) {
    // Consider backline as the back third of the battlefield
    const backlineThreshold = Math.floor((battlefield.height * 2) / 3);
    return position.row >= backlineThreshold;
  }

  /**
   * Reposition to backline to avoid danger
   * @param {Object} enemyCombatant - Enemy combatant object
   * @param {Object} currentPos - Current position
   * @param {Object} battlefield - Battlefield object
   * @param {Array} turnOrder - All combatants
   * @param {number} movementRemaining - Movement remaining
   * @returns {Object} Move action
   */
  static _repositionToBackline(
    enemyCombatant,
    currentPos,
    battlefield,
    turnOrder,
    movementRemaining
  ) {
    // Find furthest unoccupied hex in backline
    const backlineRow = battlefield.height - 1;
    const targetCol = Math.floor(battlefield.width / 2); // Center column

    const targetPos = { col: targetCol, row: backlineRow };
    const maxMoveHexes = Math.floor(movementRemaining / 5);
    const path = findPath(currentPos, targetPos, battlefield, turnOrder);

    if (path && path.length > 1) {
      const movableDistance = Math.min(path.length - 1, maxMoveHexes);
      const destination = path[movableDistance];

      return {
        type: 'move',
        destination: destination,
        path: path.slice(0, movableDistance + 1),
        moveCost: movableDistance,
      };
    }

    // Can't reach backline, just wait
    return { type: 'wait' };
  }
}

// TODO: Add auto-play NPC toggle setting (future feature)
// This would allow NPCs/allies to use the same AI system for automated combat

export default EnemyAI;
