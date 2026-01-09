/**
 * LineOfSight - Line of sight calculation for hex grid
 * Uses Bresenham's line algorithm adapted for hexagonal grids
 */

/**
 * Convert offset coordinates to cube coordinates
 * @param {number} col - Column coordinate
 * @param {number} row - Row coordinate
 * @returns {Object} Cube coordinates {x, y, z}
 */
export function offsetToCube(col, row) {
  const x = col - Math.floor(row / 2);
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Convert cube coordinates to offset coordinates
 * @param {number} x - Cube X coordinate
 * @param {number} y - Cube Y coordinate (unused but kept for completeness)
 * @param {number} z - Cube Z coordinate
 * @returns {Object} Offset coordinates {col, row}
 */
export function cubeToOffset(x, y, z) {
  const row = z;
  const col = x + Math.floor(z / 2);
  return { col, row };
}

/**
 * Round fractional cube coordinates to nearest hex
 * @param {number} x - Fractional cube X
 * @param {number} y - Fractional cube Y
 * @param {number} z - Fractional cube Z
 * @returns {Object} Rounded cube coordinates {x, y, z}
 */
function cubeRound(x, y, z) {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Get all hexes on a line from start to end
 * @param {Object} from - Starting hex {col, row}
 * @param {Object} to - Ending hex {col, row}
 * @returns {Array} Array of hex positions [{col, row}, ...]
 */
function getHexLine(from, to) {
  const fromCube = offsetToCube(from.col, from.row);
  const toCube = offsetToCube(to.col, to.row);

  // Calculate distance (Manhattan distance in cube coordinates)
  const distance = Math.max(
    Math.abs(fromCube.x - toCube.x),
    Math.abs(fromCube.y - toCube.y),
    Math.abs(fromCube.z - toCube.z)
  );

  // Handle zero distance
  if (distance === 0) {
    return [{ col: from.col, row: from.row }];
  }

  // Generate line
  const results = [];
  for (let i = 0; i <= distance; i++) {
    const t = i / distance;
    const x = lerp(fromCube.x, toCube.x, t);
    const y = lerp(fromCube.y, toCube.y, t);
    const z = lerp(fromCube.z, toCube.z, t);

    const rounded = cubeRound(x, y, z);
    const offset = cubeToOffset(rounded.x, rounded.y, rounded.z);
    results.push(offset);
  }

  return results;
}

/**
 * Check if a target is in range using cube coordinate distance
 * @param {Object} from - Starting hex {col, row}
 * @param {Object} to - Target hex {col, row}
 * @param {number} range - Maximum range in hexes
 * @returns {boolean} True if target is in range
 */
export function isInRange(from, to, range) {
  const fromCube = offsetToCube(from.col, from.row);
  const toCube = offsetToCube(to.col, to.row);

  // Calculate cube distance (maximum of absolute differences)
  const distance = Math.max(
    Math.abs(fromCube.x - toCube.x),
    Math.abs(fromCube.y - toCube.y),
    Math.abs(fromCube.z - toCube.z)
  );

  return distance <= range;
}

/**
 * Check line of sight between two hexes
 * @param {Object} from - Starting hex {col, row}
 * @param {Object} to - Target hex {col, row}
 * @param {Object} battlefield - Battlefield object with {hexes, width, height}
 * @returns {boolean} True if line of sight is clear, false if blocked
 */
export function checkLineOfSight(from, to, battlefield) {
  const { hexes } = battlefield;

  // Create hex lookup map
  const hexMap = new Map();
  hexes.forEach(hex => {
    hexMap.set(`${hex.col},${hex.row}`, hex);
  });

  // Get all hexes on the line
  const line = getHexLine(from, to);

  // Check each hex on the line (excluding start and end)
  for (let i = 1; i < line.length - 1; i++) {
    const hex = line[i];
    const hexKey = `${hex.col},${hex.row}`;
    const hexData = hexMap.get(hexKey);

    // If hex doesn't exist or is blocked, line of sight is blocked
    if (!hexData || hexData.blocked) {
      return false;
    }
  }

  // Check target hex exists (don't care if blocked, just if we can see it)
  const targetKey = `${to.col},${to.row}`;
  const targetHex = hexMap.get(targetKey);
  if (!targetHex) {
    return false;
  }

  return true;
}
