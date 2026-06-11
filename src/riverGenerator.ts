// @ts-nocheck
// TODO: Add proper types
/**
 * River generation for hexcrawl maps
 * Rivers flow from high elevation to low elevation (mountains to water)
 */

import { getHexNeighbors } from './utils/hexMath';

export class RiverGenerator {
  constructor(noise) {
    this.noise = noise;
  }

  /**
   * Generate rivers on the map
   */
  generateRivers(grid, width, height, numRivers = 3, random = Math.random) {
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
  calculateElevationMap(grid, width, height) {
    const elevationMap = [];
    const elevationValues = {
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
  findRiverSources(grid, elevationMap, width, height, numRivers, random = Math.random) {
    const sources = [];
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
  traceRiver(grid, elevationMap, width, height, source) {
    const visited = new Set();
    let current = source;
    let maxSteps = width * height; // Prevent infinite loops
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
  findDownhillNeighbor(elevationMap, width, height, pos) {
    const neighbors = this.getNeighbors(pos.row, pos.col, width, height);

    let lowestElevation = elevationMap[pos.row][pos.col];
    let bestNeighbor = null;

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
  getNeighbors(row, col, width, height) {
    return getHexNeighbors(col, row).filter(
      n => n.col >= 0 && n.col < width && n.row >= 0 && n.row < height
    );
  }

  /**
   * Get terrain key from terrain object
   */
  getTerrainKey(terrain) {
    return terrain.name.toLowerCase();
  }

  /**
   * Get terrain object by key
   */
  getTerrainByKey(key, templateTerrain) {
    // This is a hack - we'll need to pass terrain types properly
    // For now, return a river terrain object
    return { name: 'River', color: '#5B9BD5', difficulty: 2 };
  }
}
