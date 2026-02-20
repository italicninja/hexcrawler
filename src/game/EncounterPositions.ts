// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * EncounterPositions - Places combatants on battlefield based on encounter type
 * Handles different tactical formations for various encounter scenarios
 */

import logger from '../utils/logger';

/**
 * Get hex neighbors using flat-top hex offset coordinates
 * @param {number} col - Column coordinate
 * @param {number} row - Row coordinate
 * @returns {Array} Array of {col, row} neighbors
 */
function getHexNeighbors(col, row) {
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

  return offsets.map(([dc, dr]) => ({ col: col + dc, row: row + dr }));
}

export class EncounterPositions {
  /**
   * Place combatants on battlefield based on encounter type
   * @param {string} encounterType - Type of encounter (standard, ambush, boss, surrounded)
   * @param {Array} allies - Array of ally combatants
   * @param {Array} enemies - Array of enemy combatants
   * @param {Object} battlefield - Battlefield object with {hexes, width, height}
   * @returns {Object} {allies, enemies} with positions set
   */
  static placeForEncounter(encounterType, allies, enemies, battlefield) {
    const { width, height } = battlefield;

    // Create occupied positions tracking
    const occupied = new Set();

    switch (encounterType) {
      case 'standard':
        return this._placeStandard(allies, enemies, battlefield, occupied);

      case 'ambush':
      case 'surrounded':
        return this._placeAmbush(allies, enemies, battlefield, occupied);

      case 'boss':
        return this._placeBoss(allies, enemies, battlefield, occupied);

      default:
        return this._placeStandard(allies, enemies, battlefield, occupied);
    }
  }

  /**
   * Standard encounter: Party bottom 2 rows, enemies top 3 rows
   * @private
   */
  static _placeStandard(allies, enemies, battlefield, occupied) {
    const { width, height } = battlefield;

    // Place allies in bottom 2 rows (rows 18-19)
    let allyCol = Math.floor(width / 2) - Math.floor(allies.length / 2);
    let allyRow = height - 2;

    for (const ally of allies) {
      const pos = this._findNearestFreeHex({ col: allyCol, row: allyRow }, battlefield, occupied);
      ally.position = pos;
      occupied.add(`${pos.col},${pos.row}`);
      allyCol++;
    }

    // Place enemies in top 3 rows (rows 0-2)
    let enemyCol = Math.floor(width / 2) - Math.floor(enemies.length / 2);
    let enemyRow = 1;

    for (const enemy of enemies) {
      const pos = this._findNearestFreeHex({ col: enemyCol, row: enemyRow }, battlefield, occupied);
      enemy.position = pos;
      occupied.add(`${pos.col},${pos.row}`);
      enemyCol++;
    }

    return { allies, enemies };
  }

  /**
   * Ambush encounter: Party clustered in center, enemies surrounding edges
   * @private
   */
  static _placeAmbush(allies, enemies, battlefield, occupied) {
    const { width, height } = battlefield;
    const centerCol = Math.floor(width / 2);
    const centerRow = Math.floor(height / 2);

    // Place allies clustered in center
    let allyIndex = 0;
    const allyPositions = [
      { col: centerCol, row: centerRow },
      { col: centerCol - 1, row: centerRow },
      { col: centerCol + 1, row: centerRow },
      { col: centerCol, row: centerRow - 1 },
      { col: centerCol, row: centerRow + 1 },
      { col: centerCol - 1, row: centerRow + 1 },
      { col: centerCol + 1, row: centerRow + 1 },
    ];

    for (const ally of allies) {
      const targetPos = allyPositions[allyIndex] || { col: centerCol, row: centerRow };
      const pos = this._findNearestFreeHex(targetPos, battlefield, occupied);
      ally.position = pos;
      occupied.add(`${pos.col},${pos.row}`);
      allyIndex++;
    }

    // Place enemies around edges
    const edgePositions = [];

    // Top edge
    for (let col = 2; col < width - 2; col += 3) {
      edgePositions.push({ col, row: 1 });
    }

    // Bottom edge
    for (let col = 2; col < width - 2; col += 3) {
      edgePositions.push({ col, row: height - 2 });
    }

    // Left edge
    for (let row = 4; row < height - 4; row += 3) {
      edgePositions.push({ col: 1, row });
    }

    // Right edge
    for (let row = 4; row < height - 4; row += 3) {
      edgePositions.push({ col: width - 2, row });
    }

    // Shuffle edge positions (simple Fisher-Yates using Math.random)
    for (let i = edgePositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [edgePositions[i], edgePositions[j]] = [edgePositions[j], edgePositions[i]];
    }

    // Place enemies
    let enemyIndex = 0;
    for (const enemy of enemies) {
      const targetPos = edgePositions[enemyIndex % edgePositions.length];
      const pos = this._findNearestFreeHex(targetPos, battlefield, occupied);
      enemy.position = pos;
      occupied.add(`${pos.col},${pos.row}`);
      enemyIndex++;
    }

    return { allies, enemies };
  }

  /**
   * Boss encounter: Boss in center-top, minions around, party in bottom row
   * @private
   */
  static _placeBoss(allies, enemies, battlefield, occupied) {
    const { width, height } = battlefield;

    // Place allies in bottom row
    let allyCol = Math.floor(width / 2) - Math.floor(allies.length / 2);
    let allyRow = height - 1;

    for (const ally of allies) {
      const pos = this._findNearestFreeHex({ col: allyCol, row: allyRow }, battlefield, occupied);
      ally.position = pos;
      occupied.add(`${pos.col},${pos.row}`);
      allyCol++;
    }

    // Assume first enemy is the boss
    const boss = enemies[0];
    const minions = enemies.slice(1);

    // Place boss in center-top area
    const bossPos = this._findNearestFreeHex(
      { col: Math.floor(width / 2), row: 3 },
      battlefield,
      occupied
    );
    boss.position = bossPos;
    occupied.add(`${bossPos.col},${bossPos.row}`);

    // Place minions around boss and in front
    const minionPositions = [
      { col: bossPos.col - 2, row: bossPos.row },
      { col: bossPos.col + 2, row: bossPos.row },
      { col: bossPos.col - 1, row: bossPos.row + 1 },
      { col: bossPos.col + 1, row: bossPos.row + 1 },
      { col: bossPos.col, row: bossPos.row + 2 },
      { col: bossPos.col - 2, row: bossPos.row + 2 },
      { col: bossPos.col + 2, row: bossPos.row + 2 },
    ];

    let minionIndex = 0;
    for (const minion of minions) {
      const targetPos = minionPositions[minionIndex % minionPositions.length];
      const pos = this._findNearestFreeHex(targetPos, battlefield, occupied);
      minion.position = pos;
      occupied.add(`${pos.col},${pos.row}`);
      minionIndex++;
    }

    return { allies, enemies };
  }

  /**
   * Find nearest free hex to target position using spiral outward search
   * @param {Object} target - Target position {col, row}
   * @param {Object} battlefield - Battlefield object
   * @param {Set} occupiedBy - Set of occupied position keys
   * @returns {Object} Free position {col, row}
   * @private
   */
  static _findNearestFreeHex(target, battlefield, occupiedBy) {
    const { hexes, width, height } = battlefield;

    // Create hex lookup map
    const hexMap = new Map();
    hexes.forEach(hex => {
      hexMap.set(`${hex.col},${hex.row}`, hex);
    });

    // Check target position first
    const targetKey = `${target.col},${target.row}`;
    const targetHex = hexMap.get(targetKey);

    if (targetHex && !targetHex.blocked && !occupiedBy.has(targetKey)) {
      return { col: target.col, row: target.row };
    }

    // Spiral outward using BFS
    const visited = new Set();
    const queue = [target];
    visited.add(targetKey);

    while (queue.length > 0) {
      const current = queue.shift();

      // Get all neighbors
      const neighbors = getHexNeighbors(current.col, current.row);

      for (const neighbor of neighbors) {
        // Check bounds
        if (
          neighbor.col < 0 ||
          neighbor.col >= width ||
          neighbor.row < 0 ||
          neighbor.row >= height
        ) {
          continue;
        }

        const neighborKey = `${neighbor.col},${neighbor.row}`;

        // Skip if already visited
        if (visited.has(neighborKey)) {
          continue;
        }

        visited.add(neighborKey);

        const neighborHex = hexMap.get(neighborKey);

        // Check if this hex is free
        if (neighborHex && !neighborHex.blocked && !occupiedBy.has(neighborKey)) {
          return { col: neighbor.col, row: neighbor.row };
        }

        // Add to queue for further searching
        queue.push(neighbor);
      }
    }

    // Fallback: return target position (should never happen on valid battlefield)
    logger.combat.warn('Could not find free hex, using target position', { target });
    return { col: target.col, row: target.row };
  }
}
