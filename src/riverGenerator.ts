/**
 * River generation for hexcrawl maps
 * Rivers flow from high elevation to low elevation (mountains to water)
 */

import { getHexNeighbors } from './utils/hexMath';

interface Terrain {
  name: string;
  color?: string;
  difficulty?: number;
  [key: string]: unknown;
}

interface GridHex {
  terrain: Terrain;
  elevation?: number;
  [key: string]: unknown;
}

type Grid = GridHex[][];
type ElevationMap = number[][];

interface Pos {
  row: number;
  col: number;
}

export class RiverGenerator {
  noise: unknown;

  constructor(noise: unknown) {
    this.noise = noise;
  }

  /**
   * Generate rivers on the map
   */
  generateRivers(
    grid: Grid,
    width: number,
    height: number,
    numRivers = 3,
    random: () => number = Math.random
  ): void {
    // Calculate elevation map first
    const elevationMap = this.calculateElevationMap(grid, width, height);

    // Find river sources (high elevation, not water/swamp)
    const sources = this.findRiverSources(grid, elevationMap, width, height, numRivers, random);

    // Trace each river from source to destination
    for (const source of sources) {
      this.traceRiver(grid, elevationMap, width, height, source);
    }
  }

  /**
   * Calculate elevation values for each hex based on terrain
   */
  calculateElevationMap(grid: Grid, width: number, height: number): ElevationMap {
    const elevationMap: ElevationMap = [];
    const elevationValues: Record<string, number> = {
      water: 0,
      river: 0.5,
      swamp: 1,
      grassland: 2,
      forest: 2.5,
      desert: 2,
      hills: 4,
      mountains: 6,
      tundra: 5,
    };

    for (let row = 0; row < height; row++) {
      elevationMap[row] = [];
      for (let col = 0; col < width; col++) {
        const terrainKey = this.getTerrainKey(grid[row][col].terrain);
        elevationMap[row][col] = elevationValues[terrainKey] || 2;
        grid[row][col].elevation = elevationMap[row][col];
      }
    }

    return elevationMap;
  }

  /**
   * Find good river source locations
   */
  findRiverSources(
    grid: Grid,
    elevationMap: ElevationMap,
    width: number,
    height: number,
    numRivers: number,
    random: () => number = Math.random
  ): Pos[] {
    const sources: Pos[] = [];
    const attempts = numRivers * 10;

    for (let i = 0; i < attempts && sources.length < numRivers; i++) {
      const col = Math.floor(random() * width);
      const row = Math.floor(random() * height);

      // Must be high elevation (mountains/hills)
      if (elevationMap[row][col] >= 4) {
        const terrainKey = this.getTerrainKey(grid[row][col].terrain);
        if (terrainKey === 'mountains' || terrainKey === 'hills') {
          sources.push({ row, col });
        }
      }
    }

    return sources;
  }

  /**
   * Trace a river from source to water/edge
   */
  traceRiver(
    grid: Grid,
    elevationMap: ElevationMap,
    width: number,
    height: number,
    source: Pos
  ): void {
    const visited = new Set<string>();
    let current = source;
    const maxSteps = width * height; // Prevent infinite loops
    let steps = 0;

    while (steps < maxSteps) {
      const key = `${current.row},${current.col}`;

      // Stop if we've been here before (loop detected)
      if (visited.has(key)) break;
      visited.add(key);

      // Get current terrain
      const currentTerrain = this.getTerrainKey(grid[current.row][current.col].terrain);

      // Stop if we reached water
      if (currentTerrain === 'water') break;

      // Convert current hex to river (unless it's already water)
      if (currentTerrain !== 'water') {
        grid[current.row][current.col].terrain = this.getTerrainByKey(
          'river',
          grid[current.row][current.col].terrain
        );
      }

      // Find next hex (downhill)
      const next = this.findDownhillNeighbor(elevationMap, width, height, current);

      // Stop if no downhill path found or reached edge
      if (!next) break;

      current = next;
      steps++;
    }
  }

  /**
   * Find the neighbor with lowest elevation
   */
  findDownhillNeighbor(
    elevationMap: ElevationMap,
    width: number,
    height: number,
    pos: Pos
  ): Pos | null {
    const neighbors = this.getNeighbors(pos.row, pos.col, width, height);

    let lowestElevation = elevationMap[pos.row][pos.col];
    let bestNeighbor: Pos | null = null;

    for (const neighbor of neighbors) {
      const elevation = elevationMap[neighbor.row][neighbor.col];
      if (elevation < lowestElevation) {
        lowestElevation = elevation;
        bestNeighbor = neighbor;
      }
    }

    return bestNeighbor;
  }

  /**
   * Get neighboring hexes (offset grid).
   * Delegates to the shared hexMath utility; filters to map bounds.
   * Note: argument order is (row, col, width, height) to match existing call sites.
   */
  getNeighbors(row: number, col: number, width: number, height: number): Pos[] {
    return getHexNeighbors(col, row).filter(
      n => n.col >= 0 && n.col < width && n.row >= 0 && n.row < height
    );
  }

  /**
   * Get terrain key from terrain object
   */
  getTerrainKey(terrain: Terrain): string {
    return terrain.name.toLowerCase();
  }

  /**
   * Get terrain object by key
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getTerrainByKey(key: string, templateTerrain: Terrain): Terrain {
    // This is a hack - we'll need to pass terrain types properly
    // For now, return a river terrain object
    return { name: 'River', color: '#5B9BD5', difficulty: 2 };
  }
}
