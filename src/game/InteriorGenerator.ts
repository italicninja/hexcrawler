/**
 * InteriorGenerator - Base class for interior map generation
 * Provides common functionality for caves, dungeons, ruins, towers
 */

import { getHexDistance } from '../utils/hexMath';

export interface TerrainType {
  key: string;
  name: string;
  color: string;
  walkable: boolean;
  /** Interactive tiles (e.g. town building entrances) the player can act on. */
  isInteractive?: boolean;
}

export interface HexCoord {
  col: number;
  row: number;
}

export interface InteriorHex {
  col: number;
  row: number;
  terrain: TerrainType;
  content: string | null;
  /** Target floor index for stair tiles in multi-floor interiors (tower/dungeon). */
  connectedFloor?: number;
  /** Building-type key for town tiles occupied by a building / its entrance. */
  buildingType?: string;
}

export type InteriorGrid = InteriorHex[][];

export class InteriorGenerator {
  seed: string | null;
  rng: (() => number) | null;
  terrainTypes: Record<string, TerrainType>;

  constructor() {
    this.seed = null;
    this.rng = null;

    // Interior terrain types
    this.terrainTypes = {
      floor: {
        key: 'floor',
        name: 'Stone Floor',
        color: '#6a6a6a', // Lighter gray for better contrast
        walkable: true,
      },
      wall: {
        key: 'wall',
        name: 'Wall',
        color: '#1a1a1a', // Darker for better contrast
        walkable: false,
      },
      water: {
        key: 'water',
        name: 'Underground Water',
        color: '#1e3a5f',
        walkable: false,
      },
      entrance: {
        key: 'entrance',
        name: 'Entrance',
        color: '#8B4513',
        walkable: true,
      },
      exit: {
        key: 'exit',
        name: 'Exit',
        color: '#2ecc71',
        walkable: true,
      },
      chasm: {
        key: 'chasm',
        name: 'Chasm',
        color: '#0d0d0d',
        walkable: false,
      },
      rubble: {
        key: 'rubble',
        name: 'Rubble',
        color: '#5a5a5a',
        walkable: true,
      },
    };
  }

  /**
   * Set seed for reproducible generation
   * @param {string} seed - Seed string
   */
  setSeed(seed: string): void {
    this.seed = seed;
    this.rng = this.createSeededRNG(seed);
  }

  /**
   * Create a seeded random number generator
   */
  createSeededRNG(seed: string): () => number {
    let seedValue = 0;
    for (let i = 0; i < seed.length; i++) {
      seedValue = (seedValue << 5) - seedValue + seed.charCodeAt(i);
      seedValue = seedValue & seedValue; // Convert to 32bit integer
    }

    return () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
  }

  /**
   * Get random number (0-1)
   */
  random(): number {
    if (!this.rng) {
      throw new Error('Seed not set. Call setSeed() first.');
    }
    return this.rng();
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Pick random element from array
   */
  randomChoice<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Initialize empty grid of the given dimensions.
   */
  initializeGrid(width: number, height: number, defaultTerrain: TerrainType): InteriorGrid {
    const grid: InteriorGrid = [];
    for (let row = 0; row < height; row++) {
      grid[row] = [];
      for (let col = 0; col < width; col++) {
        grid[row][col] = {
          col,
          row,
          terrain: defaultTerrain,
          content: null, // null | 'encounter' | 'loot' | 'hazard' | 'entrance'
        };
      }
    }
    return grid;
  }

  /**
   * Convert 2D grid to flat hex array
   */
  gridToHexes(grid: InteriorGrid): InteriorHex[] {
    const hexes: InteriorHex[] = [];
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        hexes.push(grid[row][col]);
      }
    }
    return hexes;
  }

  /**
   * Get hex neighbors (6 directions for hex grid)
   * @param {number} col
   * @param {number} row
   * @param {number} width
   * @returns Array of {col, row} neighbors
   */
  getNeighbors(col: number, row: number, width: number, height: number): HexCoord[] {
    const neighbors: HexCoord[] = [];

    // Hex grid neighbor offsets (offset coordinates)
    // Use Math.abs for modulo to handle negative rows correctly
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
   * Count neighbors of specific terrain type
   * @param {Array} grid - 2D grid
   * @param {number} col
   * @param {number} row
   * @returns Count of neighbors with this terrain
   */
  countNeighborTerrain(grid: InteriorGrid, col: number, row: number, terrainKey: string): number {
    const neighbors = this.getNeighbors(col, row, grid[0].length, grid.length);
    let count = 0;

    for (const { col: nCol, row: nRow } of neighbors) {
      if (grid[nRow][nCol].terrain.key === terrainKey) {
        count++;
      }
    }

    return count;
  }

  /**
   * Flood fill to find connected regions
   * @param {Array} grid - 2D grid
   * @param {number} startCol
   * @param {number} startRow
   * @returns Set of "col,row" keys for connected region
   */
  floodFill(
    grid: InteriorGrid,
    startCol: number,
    startRow: number,
    isWalkable: (hex: InteriorHex) => boolean
  ): Set<string> {
    const visited = new Set<string>();
    const queue: HexCoord[] = [{ col: startCol, row: startRow }];
    const width = grid[0].length;
    const height = grid.length;

    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const { col, row } = next;
      const key = `${col},${row}`;

      if (visited.has(key)) continue;
      if (!isWalkable(grid[row][col])) continue;

      visited.add(key);

      const neighbors = this.getNeighbors(col, row, width, height);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.col},${neighbor.row}`;
        if (!visited.has(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }

    return visited;
  }

  /**
   * Find all walkable tiles
   */
  getWalkableTiles(grid: InteriorGrid): HexCoord[] {
    const walkable: HexCoord[] = [];
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col].terrain.walkable) {
          walkable.push({ col, row });
        }
      }
    }
    return walkable;
  }

  /**
   * Calculate hex distance (cube coordinates)
   * Delegates to the shared hexMath utility. Kept as an instance method
   * so subclasses (CaveGenerator, RuinsGenerator, TownGenerator, etc.)
   * can continue calling this.getHexDistance() without changes.
   * @param {number} col1
   * @param {number} row1
   * @returns Distance
   */
  getHexDistance(col1: number, row1: number, col2: number, row2: number): number {
    return getHexDistance(col1, row1, col2, row2);
  }

  /**
   * Generate interior map (must be implemented by subclasses).
   * The third argument is a CR number for dungeon-type generators, or a
   * settlement-metadata object for the town generator — hence the loose type
   * on this abstract hook point.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  generate(width: number, height: number, crOrData: any): unknown {
    throw new Error('generate() must be implemented by subclass');
  }
}

export default InteriorGenerator;
