/**
 * Hex Grid Math Utilities
 * Uses cube coordinate system for accurate distance calculations
 * 
 * Centralized hex math functions to replace duplicate implementations
 * across the codebase
 */

import type { HexCoordinates } from '../types/game';

interface CubeCoordinates {
  x: number;
  y: number;
  z: number;
}

/**
 * Convert offset coordinates to cube coordinates
 * @param col - Column (offset)
 * @param row - Row (offset)
 * @returns Cube coordinates
 */
export function offsetToCube(col: number, row: number): CubeCoordinates {
  const x = col - Math.floor(row / 2);
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Convert cube coordinates to offset coordinates
 * @param x - Cube X
 * @param y - Cube Y
 * @param z - Cube Z
 * @returns Offset coordinates
 */
export function cubeToOffset(x: number, y: number, z: number): HexCoordinates {
  const row = z;
  const col = x + Math.floor(z / 2);
  return { col, row };
}

/**
 * Calculate distance between two hexes using cube coordinates
 * @param col1 - Starting column
 * @param row1 - Starting row
 * @param col2 - Target column
 * @param row2 - Target row
 * @returns Distance in hexes
 */
export function getHexDistance(
  col1: number,
  row1: number,
  col2: number,
  row2: number
): number {
  const cube1 = offsetToCube(col1, row1);
  const cube2 = offsetToCube(col2, row2);

  return (
    Math.abs(cube1.x - cube2.x) +
    Math.abs(cube1.y - cube2.y) +
    Math.abs(cube1.z - cube2.z)
  ) / 2;
}

/**
 * Get all hexes within radius of center
 * @param centerCol - Center column
 * @param centerRow - Center row
 * @param radius - Radius in hexes
 * @returns Array of coordinate pairs
 */
export function getHexesInRadius(
  centerCol: number,
  centerRow: number,
  radius: number
): HexCoordinates[] {
  const results: HexCoordinates[] = [];

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
 * @param fromCol - Starting column
 * @param fromRow - Starting row
 * @param toCol - Target column
 * @param toRow - Target row
 * @param moveDistance - Maximum movement distance
 * @returns True if reachable
 */
export function isHexReachable(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
  moveDistance: number
): boolean {
  return getHexDistance(fromCol, fromRow, toCol, toRow) <= moveDistance;
}
