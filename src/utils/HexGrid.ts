/**
 * HexGrid - Spatial index for fast hex lookups
 * Provides O(1) coordinate-based queries instead of O(n) array searches
 * 
 * Replaces linear searches through mapData arrays with hash map lookups
 */

import { getHexDistance } from './hexMath';
import type { Hex, MapBounds } from '../types/game';

interface HexOffset {
  dc: number;
  dr: number;
}

export class HexGrid {
  private grid: Map<string, Hex>;
  private hexes: Hex[];
  private bounds: MapBounds;

  constructor(hexes: Hex[] = []) {
    this.grid = new Map();
    this.hexes = hexes;
    this.bounds = { minCol: Infinity, maxCol: -Infinity, minRow: Infinity, maxRow: -Infinity };
    this._buildIndex();
  }

  /**
   * Build spatial index from hex array
   * @private
   */
  private _buildIndex(): void {
    this.grid.clear();
    this.bounds = { minCol: Infinity, maxCol: -Infinity, minRow: Infinity, maxRow: -Infinity };
    
    for (const hex of this.hexes) {
      const key = HexGrid.makeKey(hex.col, hex.row);
      this.grid.set(key, hex);
      
      // Update bounds
      this.bounds.minCol = Math.min(this.bounds.minCol, hex.col);
      this.bounds.maxCol = Math.max(this.bounds.maxCol, hex.col);
      this.bounds.minRow = Math.min(this.bounds.minRow, hex.row);
      this.bounds.maxRow = Math.max(this.bounds.maxRow, hex.row);
    }
  }

  /**
   * Create string key from coordinates
   * @param col - Column
   * @param row - Row
   * @returns Key like "10,7"
   */
  static makeKey(col: number, row: number): string {
    return `${col},${row}`;
  }

  /**
   * Get hex at coordinates - O(1)
   * @param col - Column
   * @param row - Row
   * @returns Hex object or undefined
   */
  get(col: number, row: number): Hex | undefined {
    return this.grid.get(HexGrid.makeKey(col, row));
  }

  /**
   * Check if hex exists at coordinates
   * @param col - Column
   * @param row - Row
   * @returns True if hex exists
   */
  has(col: number, row: number): boolean {
    return this.grid.has(HexGrid.makeKey(col, row));
  }

  /**
   * Get all 6 neighboring hexes (offset coordinate system)
   * @param col - Center column
   * @param row - Center row
   * @returns Array of neighbor hexes
   */
  getNeighbors(col: number, row: number): Hex[] {
    const offsets = this._getHexOffsets(row);
    const neighbors: Hex[] = [];

    for (const { dc, dr } of offsets) {
      const hex = this.get(col + dc, row + dr);
      if (hex) neighbors.push(hex);
    }

    return neighbors;
  }

  /**
   * Get all hexes within radius
   * @param col - Center column
   * @param row - Center row
   * @param radius - Radius in hexes
   * @returns Array of hexes within radius
   */
  getInRadius(col: number, row: number, radius: number): Hex[] {
    const results: Hex[] = [];

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
   * @param hex - Hex to update/add
   */
  set(hex: Hex): void {
    const key = HexGrid.makeKey(hex.col, hex.row);
    this.grid.set(key, hex);

    // Update hexes array if needed
    const index = this.hexes.findIndex(h => h.col === hex.col && h.row === hex.row);
    if (index >= 0) {
      this.hexes[index] = hex;
    } else {
      this.hexes.push(hex);
    }

    // Update bounds
    this.bounds.minCol = Math.min(this.bounds.minCol, hex.col);
    this.bounds.maxCol = Math.max(this.bounds.maxCol, hex.col);
    this.bounds.minRow = Math.min(this.bounds.minRow, hex.row);
    this.bounds.maxRow = Math.max(this.bounds.maxRow, hex.row);
  }

  /**
   * Get map boundaries (O(1))
   * @returns Map boundaries
   */
  getBounds(): MapBounds {
    return { ...this.bounds };
  }

  /**
   * Get hex offsets for neighbors (depends on row parity for offset coordinates)
   * @private
   * @param row - Row number
   * @returns Array of {dc, dr} offsets
   */
  private _getHexOffsets(row: number): HexOffset[] {
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
   * @returns Number of hexes
   */
  get size(): number {
    return this.grid.size;
  }

  /**
   * Clear all hexes from grid
   */
  clear(): void {
    this.grid.clear();
    this.hexes = [];
  }
}
