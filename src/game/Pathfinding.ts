/**
 * Pathfinding - A* pathfinding algorithm for hex grid
 * Handles movement calculation on hex-based battlefield
 */

import { getHexDistance } from '../utils/hexMath';

interface HexCoord {
  col: number;
  row: number;
}

interface BattlefieldHex extends HexCoord {
  blocked?: boolean;
  difficultTerrain?: boolean;
}

interface Battlefield {
  hexes: BattlefieldHex[];
  width: number;
  height: number;
}

interface PathCombatant {
  position?: HexCoord;
}

interface ReachableHex extends HexCoord {
  cost: number;
}

/**
 * Get hex neighbors using flat-top hex offset coordinates
 */
function getHexNeighbors(col: number, row: number, width: number, height: number): HexCoord[] {
  const neighbors: HexCoord[] = [];

  // Hex grid neighbor offsets (flat-top orientation)
  const offsets: number[][] =
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
 * Find shortest path from start to goal using A* algorithm.
 * Returns an array of hex positions, or null if no path exists.
 * (maxDistance is accepted for API symmetry; the full path is returned and
 * the caller truncates it to their actual movement range.)
 */
export function findPath(
  start: HexCoord,
  goal: HexCoord,
  battlefield: Battlefield,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  maxDistance?: number
): HexCoord[] | null {
  const { hexes, width, height } = battlefield;

  // Note: We don't check if goal is within maxDistance - pathfinding should work
  // even for distant goals. The caller will truncate the path to their movement range.

  // Create hex lookup map
  const hexMap = new Map<string, BattlefieldHex>();
  hexes.forEach(hex => {
    hexMap.set(`${hex.col},${hex.row}`, hex);
  });

  // Check if goal is blocked (but not if occupied - caller should check that)
  const goalHex = hexMap.get(`${goal.col},${goal.row}`);
  if (!goalHex || goalHex.blocked) {
    return null; // Goal blocked or doesn't exist
  }

  // A* algorithm
  const openSet = new Map<string, HexCoord>();
  const closedSet = new Set<string>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  const startKey = `${start.col},${start.row}`;
  const goalKey = `${goal.col},${goal.row}`;

  openSet.set(startKey, start);
  gScore.set(startKey, 0);
  fScore.set(startKey, getHexDistance(start.col, start.row, goal.col, goal.row));

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let current: HexCoord | null = null;
    let currentKey: string | null = null;
    let lowestF = Infinity;

    for (const [key, node] of openSet) {
      const f = fScore.get(key);
      if (f !== undefined && f < lowestF) {
        lowestF = f;
        current = node;
        currentKey = key;
      }
    }

    // No reachable node left (should not happen while openSet is non-empty)
    if (current === null || currentKey === null) break;

    // Check if we reached the goal
    if (currentKey === goalKey) {
      // Reconstruct path
      const path: HexCoord[] = [current];
      let pathKey = currentKey;

      while (cameFrom.has(pathKey)) {
        pathKey = cameFrom.get(pathKey)!;
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
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + moveCost;

      // Note: We don't limit by maxDistance here - find the full path
      // The caller will truncate it to their actual movement range

      // Check if this is a better path
      if (!gScore.has(neighborKey) || tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
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
 * Calculate all hexes reachable within movement range.
 * Returns reachable hex positions with their movement cost.
 */
export function calculateReachableHexes(
  start: HexCoord,
  maxDistance: number,
  battlefield: Battlefield,
  combatants: PathCombatant[] = []
): ReachableHex[] {
  const { hexes, width, height } = battlefield;

  // Create hex lookup map
  const hexMap = new Map<string, BattlefieldHex>();
  hexes.forEach(hex => {
    hexMap.set(`${hex.col},${hex.row}`, hex);
  });

  // Create occupied positions set (excluding start position)
  const occupied = new Set<string>();
  combatants.forEach(c => {
    if (c.position && (c.position.col !== start.col || c.position.row !== start.row)) {
      occupied.add(`${c.position.col},${c.position.row}`);
    }
  });

  // Dijkstra's algorithm for reachable hexes
  const visited = new Map<string, number>();
  const queue: ReachableHex[] = [{ ...start, cost: 0 }];
  const reachable: ReachableHex[] = [];

  visited.set(`${start.col},${start.row}`, 0);

  while (queue.length > 0) {
    // Get hex with lowest cost
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    if (!current) break;

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
      if (!visited.has(neighborKey) || newCost < (visited.get(neighborKey) ?? Infinity)) {
        visited.set(neighborKey, newCost);
        queue.push({ ...neighbor, cost: newCost });
      }
    }
  }

  return reachable;
}
