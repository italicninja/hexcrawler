/**
 * HexGrid - Spatial index for fast hex lookups
 * Provides O(1) coordinate-based queries instead of O(n) array searches
 * 
 * Replaces linear searches through mapData arrays with hash map lookups
 */

import { getHexDistance } from './hexMath.js';

export class HexGrid {
  constructor(hexes = []) {
    this.grid = new Map();
    this.hexes = hexes;
    this._buildIndex();
  }

  /**
   * Build spatial index from hex array
   * @private
   */
  _buildIndex() {
    this.grid.clear();
    for (const hex of this.hexes) {
      const key = HexGrid.makeKey(hex.col, hex.row);
      this.grid.set(key, hex);
    }
  }

  /**
   * Create string key from coordinates
   * @param {number} col - Column
   * @param {number} row - Row
   * @returns {string} Key like "10,7"
   */
  static makeKey(col, row) {
    return `${col},${row}`;
  }

  /**
   * Get hex at coordinates - O(1)
   * @param {number} col - Column
   * @param {number} row - Row
   * @returns {object|undefined} Hex object or undefined
   */
  get(col, row) {
    return this.grid.get(HexGrid.makeKey(col, row));
  }

  /**
   * Check if hex exists at coordinates
   * @param {number} col - Column
   * @param {number} row - Row
   * @returns {boolean}
   */
  has(col, row) {
    return this.grid.has(HexGrid.makeKey(col, row));
  }

  /**
   * Get all 6 neighboring hexes (offset coordinate system)
   * @param {number} col - Center column
   * @param {number} row - Center row
   * @returns {object[]} Array of neighbor hexes
   */
  getNeighbors(col, row) {
    const offsets = this._getHexOffsets(row);
    const neighbors = [];

    for (const { dc, dr } of offsets) {
      const hex = this.get(col + dc, row + dr);
      if (hex) neighbors.push(hex);
    }

    return neighbors;
  }

  /**
   * Get all hexes within radius
   * @param {number} col - Center column
   * @param {number} row - Center row
   * @param {number} radius - Radius in hexes
   * @returns {object[]} Array of hexes within radius
   */
  getInRadius(col, row, radius) {
    const results = [];

    // Bounding box optimization
    for (let r = row - radius; r <= row + radius; r++) {
      for (let c = col - radius; c <= col + radius; c++) {
        const hex = this.get(c, r);
        if (hex) {
          const dist = getHexDistance(col, row, c, r);
          if (dist <= radius) {
            results.push(hex);
          }
        }
      }
    }

    return results;
  }

  /**
   * Update or add hex to grid
   * @param {object} hex - Hex to update/add
   */
  set(hex) {
    const key = HexGrid.makeKey(hex.col, hex.row);
    this.grid.set(key, hex);

    // Update hexes array if needed
    const index = this.hexes.findIndex(h => h.col === hex.col && h.row === hex.row);
    if (index >= 0) {
      this.hexes[index] = hex;
    } else {
      this.hexes.push(hex);
    }
  }

  /**
   * Get hex offsets for neighbors (depends on row parity for offset coordinates)
   * @private
   * @param {number} row - Row number
   * @returns {object[]} Array of {dc, dr} offsets
   */
  _getHexOffsets(row) {
    const isEvenRow = row % 2 === 0;
    return isEvenRow
      ? [
          { dc: 1, dr: 0 },   // East
          { dc: 0, dr: -1 },  // Northeast
          { dc: -1, dr: -1 }, // Northwest
          { dc: -1, dr: 0 },  // West
          { dc: -1, dr: 1 },  // Southwest
          { dc: 0, dr: 1 }    // Southeast
        ]
      : [
          { dc: 1, dr: 0 },   // East
          { dc: 1, dr: -1 },  // Northeast
          { dc: 0, dr: -1 },  // Northwest
          { dc: -1, dr: 0 },  // West
          { dc: 0, dr: 1 },   // Southwest
          { dc: 1, dr: 1 }    // Southeast
        ];
  }

  /**
   * Get total number of hexes in grid
   * @returns {number}
   */
  get size() {
    return this.grid.size;
  }

  /**
   * Clear all hexes from grid
   */
  clear() {
    this.grid.clear();
    this.hexes = [];
  }
}
