/**
 * Hex Grid Math Utilities
 * Uses cube coordinate system for accurate distance calculations
 *
 * Centralized hex math functions to replace duplicate implementations
 * across the codebase
 */

/**
 * Convert offset coordinates to cube coordinates
 * @param {number} col - Column (offset)
 * @param {number} row - Row (offset)
 * @returns {{x: number, y: number, z: number}} Cube coordinates
 */
export function offsetToCube(col, row) {
  const x = col - Math.floor(row / 2);
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Convert cube coordinates to offset coordinates
 * @param {number} x - Cube X
 * @param {number} y - Cube Y
 * @param {number} z - Cube Z
 * @returns {{col: number, row: number}} Offset coordinates
 */
export function cubeToOffset(x, y, z) {
  const row = z;
  const col = x + Math.floor(z / 2);
  return { col, row };
}

/**
 * Calculate distance between two hexes using cube coordinates
 * @param {number} col1 - Starting column
 * @param {number} row1 - Starting row
 * @param {number} col2 - Target column
 * @param {number} row2 - Target row
 * @returns {number} Distance in hexes
 */
export function getHexDistance(col1, row1, col2, row2) {
  const cube1 = offsetToCube(col1, row1);
  const cube2 = offsetToCube(col2, row2);

  return (
    (Math.abs(cube1.x - cube2.x) + Math.abs(cube1.y - cube2.y) + Math.abs(cube1.z - cube2.z)) / 2
  );
}

/**
 * Get all hexes within radius of center
 * @param {number} centerCol - Center column
 * @param {number} centerRow - Center row
 * @param {number} radius - Radius in hexes
 * @returns {Array<{col: number, row: number}>} Array of coordinate pairs
 */
export function getHexesInRadius(centerCol, centerRow, radius) {
  const results = [];

  for (let row = centerRow - radius; row <= centerRow + radius; row++) {
    for (let col = centerCol - radius; col <= centerCol + radius; col++) {
      if (getHexDistance(centerCol, centerRow, col, row) <= radius) {
        results.push({ col, row });
      }
    }
  }

  return results;
}

/**
 * Check if hex is reachable within movement distance
 * @param {number} fromCol - Starting column
 * @param {number} fromRow - Starting row
 * @param {number} toCol - Target column
 * @param {number} toRow - Target row
 * @param {number} moveDistance - Maximum movement distance
 * @returns {boolean} True if reachable
 */
export function isHexReachable(fromCol, fromRow, toCol, toRow, moveDistance) {
  return getHexDistance(fromCol, fromRow, toCol, toRow) <= moveDistance;
}
