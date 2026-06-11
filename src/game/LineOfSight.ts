/**
 * LineOfSight - Line of sight calculation for hex grid
 * Uses Bresenham's line algorithm adapted for hexagonal grids
 */

interface HexCoord {
  col: number;
  row: number;
}

interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

interface BattlefieldHex extends HexCoord {
  blocked?: boolean;
}

interface Battlefield {
  hexes: BattlefieldHex[];
}

/**
 * Convert offset coordinates to cube coordinates
 */
export function offsetToCube(col: number, row: number): CubeCoord {
  const x = col - Math.floor(row / 2);
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Convert cube coordinates to offset coordinates
 * (y is unused but kept for signature completeness)
 */
export function cubeToOffset(x: number, _y: number, z: number): HexCoord {
  const row = z;
  const col = x + Math.floor(z / 2);
  return { col, row };
}

/**
 * Round fractional cube coordinates to nearest hex
 */
function cubeRound(x: number, y: number, z: number): CubeCoord {
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
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Get all hexes on a line from start to end
 */
function getHexLine(from: HexCoord, to: HexCoord): HexCoord[] {
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
  const results: HexCoord[] = [];
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
 */
export function isInRange(from: HexCoord, to: HexCoord, range: number): boolean {
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
 * Check line of sight between two hexes.
 * Returns true if line of sight is clear, false if blocked.
 */
export function checkLineOfSight(from: HexCoord, to: HexCoord, battlefield: Battlefield): boolean {
  const { hexes } = battlefield;

  // Create hex lookup map
  const hexMap = new Map<string, BattlefieldHex>();
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
