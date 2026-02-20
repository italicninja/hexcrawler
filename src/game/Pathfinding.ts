// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * Pathfinding - A* pathfinding algorithm for hex grid
 * Handles movement calculation on hex-based battlefield
 */

import { getHexDistance } from '../contexts/GameStateContext';

/**
 * Get hex neighbors using flat-top hex offset coordinates
 * @param {number} col - Column coordinate
 * @param {number} row - Row coordinate
 * @param {number} width - Battlefield width
 * @param {number} height - Battlefield height
 * @returns {Array} Array of {col, row} neighbors
 */
function getHexNeighbors(col, row, width, height) {
  const neighbors = [];

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

  for (const [dc, dr] of offsets) {
    const newCol = col + dc;
    const newRow = row + dr;

    if (newCol >= 0 && newCol < width && newRow >= 0 && newRow < height) {
      neighbors.push({ col: newCol, row: newRow });
    }
  }

  return neighbors;
}

/**
 * Find shortest path from start to goal using A* algorithm
 * @param {Object} start - Starting hex {col, row}
 * @param {Object} goal - Goal hex {col, row}
 * @param {Object} battlefield - Battlefield object with {hexes, width, height}
 * @param {number} maxDistance - Maximum movement distance
 * @returns {Array|null} Array of hex positions [{col, row}, ...] or null if no path
 */
export function findPath(start, goal, battlefield, maxDistance) {
  const { hexes, width, height } = battlefield;

  // Note: We don't check if goal is within maxDistance - pathfinding should work
  // even for distant goals. The caller will truncate the path to their movement range.

  // Create hex lookup map
  const hexMap = new Map();
  hexes.forEach(hex => {
    hexMap.set(`${hex.col},${hex.row}`, hex);
  });

  // Check if goal is blocked (but not if occupied - caller should check that)
  const goalHex = hexMap.get(`${goal.col},${goal.row}`);
  if (!goalHex || goalHex.blocked) {
    return null; // Goal blocked or doesn't exist
  }

  // A* algorithm
  const openSet = new Map();
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  const startKey = `${start.col},${start.row}`;
  const goalKey = `${goal.col},${goal.row}`;

  openSet.set(startKey, start);
  gScore.set(startKey, 0);
  fScore.set(startKey, getHexDistance(start.col, start.row, goal.col, goal.row));

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let current = null;
    let currentKey = null;
    let lowestF = Infinity;

    for (const [key, node] of openSet) {
      const f = fScore.get(key);
      if (f < lowestF) {
        lowestF = f;
        current = node;
        currentKey = key;
      }
    }

    // Check if we reached the goal
    if (currentKey === goalKey) {
      // Reconstruct path
      const path = [current];
      let pathKey = currentKey;

      while (cameFrom.has(pathKey)) {
        pathKey = cameFrom.get(pathKey);
        const [col, row] = pathKey.split(',').map(Number);
        path.unshift({ col, row });
      }

      return path;
    }

    // Move current from open to closed
    openSet.delete(currentKey);
    closedSet.add(currentKey);

    // Check all neighbors
    const neighbors = getHexNeighbors(current.col, current.row, width, height);

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.col},${neighbor.row}`;

      // Skip if already evaluated
      if (closedSet.has(neighborKey)) {
        continue;
      }

      const neighborHex = hexMap.get(neighborKey);

      // Skip if blocked or doesn't exist
      if (!neighborHex || neighborHex.blocked) {
        continue;
      }

      // Calculate tentative gScore
      const moveCost = neighborHex.difficultTerrain ? 2 : 1;
      const tentativeG = gScore.get(currentKey) + moveCost;

      // Note: We don't limit by maxDistance here - find the full path
      // The caller will truncate it to their actual movement range

      // Check if this is a better path
      if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        fScore.set(
          neighborKey,
          tentativeG + getHexDistance(neighbor.col, neighbor.row, goal.col, goal.row)
        );

        if (!openSet.has(neighborKey)) {
          openSet.set(neighborKey, neighbor);
        }
      }
    }
  }

  // No path found
  return null;
}

/**
 * Calculate all hexes reachable within movement range
 * @param {Object} start - Starting hex {col, row}
 * @param {number} maxDistance - Maximum movement distance
 * @param {Object} battlefield - Battlefield object with {hexes, width, height}
 * @param {Array} combatants - Array of combatant objects with position {col, row}
 * @returns {Array} Array of reachable hex positions [{col, row, cost}, ...]
 */
export function calculateReachableHexes(start, maxDistance, battlefield, combatants = []) {
  const { hexes, width, height } = battlefield;

  // Create hex lookup map
  const hexMap = new Map();
  hexes.forEach(hex => {
    hexMap.set(`${hex.col},${hex.row}`, hex);
  });

  // Create occupied positions set (excluding start position)
  const occupied = new Set();
  combatants.forEach(c => {
    if (c.position && (c.position.col !== start.col || c.position.row !== start.row)) {
      occupied.add(`${c.position.col},${c.position.row}`);
    }
  });

  // Dijkstra's algorithm for reachable hexes
  const visited = new Map();
  const queue = [{ ...start, cost: 0 }];
  const reachable = [];

  visited.set(`${start.col},${start.row}`, 0);

  while (queue.length > 0) {
    // Get hex with lowest cost
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    const currentKey = `${current.col},${current.row}`;

    // Add to reachable list (excluding start)
    if (current.col !== start.col || current.row !== start.row) {
      reachable.push({ col: current.col, row: current.row, cost: current.cost });
    }

    // Check all neighbors
    const neighbors = getHexNeighbors(current.col, current.row, width, height);

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.col},${neighbor.row}`;
      const neighborHex = hexMap.get(neighborKey);

      // Skip if blocked, doesn't exist, or occupied by another combatant
      if (!neighborHex || neighborHex.blocked || occupied.has(neighborKey)) {
        continue;
      }

      // Calculate movement cost
      const moveCost = neighborHex.difficultTerrain ? 2 : 1;
      const newCost = current.cost + moveCost;

      // Skip if exceeds max distance
      if (newCost > maxDistance) {
        continue;
      }

      // Check if this is a better path to this hex
      if (!visited.has(neighborKey) || newCost < visited.get(neighborKey)) {
        visited.set(neighborKey, newCost);
        queue.push({ ...neighbor, cost: newCost });
      }
    }
  }

  return reachable;
}
