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
   * @param {Object} enemy - Enemy combatant
   * @param {Object} combat - Combat instance with battlefield state
   * @param {Object} battlefield - Battlefield object {hexes, width, height}
   * @returns {Object} {action, target?, ability?, spell?, position?}
   * 
   * Action types:
   * - 'attack': Attack a target (melee or ranged)
   * - 'move': Move to a position
   * - 'ability': Use special ability
   * - 'wait': Do nothing
   */
  static decideAction(enemy, combat, battlefield) {
    // Get all living enemy characters (player characters)
    const livingChars = combat.characters.filter(c => c && c.currentHP > 0);
    
    if (livingChars.length === 0) {
      return { action: 'wait' };
    }

    // Get enemy position (assume stored on enemy object)
    const enemyPos = enemy.position || { col: 0, row: 0 };

    // Decision tree:
    // 1. If HP < 25% and not in backline → Reposition to backline
    const hpPercent = enemy.currentHP / enemy.maxHP;
    if (hpPercent < 0.25 && !this._isInBackline(enemyPos, battlefield)) {
      return this._repositionToBackline(enemy, enemyPos, battlefield, combat);
    }

    // 2. If has special ability and 30% random chance → Use ability
    if (enemy.specialAbilities && enemy.specialAbilities.length > 0 && Math.random() < 0.3) {
      const ability = enemy.specialAbilities[0]; // Use first special ability
      const target = this._chooseTarget(livingChars, 'lowestHp');
      
      return {
        action: 'ability',
        ability: ability.name,
        target: target
      };
    }

    // 3. If in melee range (1 hex) → Attack nearest
    const nearestEnemy = this._findNearestEnemy(enemyPos, livingChars);
    const distanceToNearest = getHexDistance(enemyPos.col, enemyPos.row, nearestEnemy.position.col, nearestEnemy.position.row);
    
    if (distanceToNearest <= 1) {
      return {
        action: 'attack',
        target: nearestEnemy,
        attackType: 'melee'
      };
    }

    // 4. If ranged weapon/spell and LoS → Attack lowest HP target
    if (this._hasRangedAttack(enemy)) {
      const target = this._chooseTarget(livingChars, 'lowestHp');
      const hasLOS = checkLineOfSight(enemyPos, target.position, battlefield);
      const inRange = isInRange(enemyPos, target.position, 12); // 12 hex range for ranged

      if (hasLOS && inRange) {
        return {
          action: 'attack',
          target: target,
          attackType: 'ranged'
        };
      }
    }

    // 5. Otherwise → Move toward nearest enemy using pathfinding
    const moveTarget = this._findNearestEnemy(enemyPos, livingChars);
    const path = findPath(enemyPos, moveTarget.position, battlefield, enemy.moveDistance || 6);

    if (path && path.length > 1) {
      // Move along path (skip first position which is current position)
      const nextPosition = path[1];
      
      return {
        action: 'move',
        position: nextPosition
      };
    }

    // Can't do anything useful
    return { action: 'wait' };
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
      
      const distance = getHexDistance(position.col, position.row, enemy.position.col, enemy.position.row);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    });

    return nearest;
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
    const backlineThreshold = Math.floor(battlefield.height * 2 / 3);
    return position.row >= backlineThreshold;
  }

  /**
   * Reposition to backline to avoid danger
   * @param {Object} enemy - Enemy object
   * @param {Object} currentPos - Current position
   * @param {Object} battlefield - Battlefield object
   * @param {Object} combat - Combat instance
   * @returns {Object} Move action
   */
  static _repositionToBackline(enemy, currentPos, battlefield, combat) {
    // Find furthest unoccupied hex in backline
    const backlineRow = battlefield.height - 1;
    const targetCol = Math.floor(battlefield.width / 2); // Center column

    const targetPos = { col: targetCol, row: backlineRow };
    const path = findPath(currentPos, targetPos, battlefield, enemy.moveDistance || 6);

    if (path && path.length > 1) {
      return {
        action: 'move',
        position: path[1]
      };
    }

    // Can't reach backline, just wait
    return { action: 'wait' };
  }
}

// TODO: Add auto-play NPC toggle setting (future feature)
// This would allow NPCs/allies to use the same AI system for automated combat

export default EnemyAI;
