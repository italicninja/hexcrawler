// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * CaveGenerator - Generates organic cave systems using cellular automata
 * Extends InteriorGenerator base class
 */

import { InteriorGenerator } from './InteriorGenerator';
import { LootGenerator } from './LootGenerator';
import { HazardGenerator } from './HazardGenerator';
import { TreasureGenerator } from './TreasureGenerator';

export class CaveGenerator extends InteriorGenerator {
  constructor() {
    super();
    this.lootGenerator = new LootGenerator();
    this.hazardGenerator = new HazardGenerator();
  }

  /**
   * Generate a cave interior map
   * @param {number} width - Map width
   * @param {number} height - Map height
   * @param {number} cr - Challenge rating
   * @returns {object} Interior map data
   */
  generate(width, height, cr) {
    // Generate cave layout using cellular automata
    const grid = this.generateCaveLayout(width, height);

    // Ensure connectivity
    this.ensureConnectivity(grid);

    // Place entrance
    const entrance = this.placeEntrance(grid);

    // Convert grid to hex array
    const hexes = this.gridToHexes(grid);

    // Return interior map data structure
    return {
      seed: this.seed,
      poiType: 'cave',
      cr,
      width,
      height,
      hexes,
      encounters: [], // Will be populated later
      loot: [], // Will be populated later
      hazards: [], // Will be populated later
      entrance,
    };
  }

  /**
   * Generate cave layout using cellular automata
   * @param {number} width
   * @param {number} height
   * @returns {Array} 2D grid
   */
  generateCaveLayout(width, height) {
    // Initialize grid with random fill (45% walls)
    let grid = this.initializeGrid(width, height, this.terrainTypes.floor);

    // Random fill
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        // Edges are always walls
        if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
          grid[row][col].terrain = this.terrainTypes.wall;
        } else {
          // 45% chance of wall
          grid[row][col].terrain =
            this.random() < 0.45 ? this.terrainTypes.wall : this.terrainTypes.floor;
        }
      }
    }

    // Apply cellular automata iterations
    const iterations = 5;
    for (let i = 0; i < iterations; i++) {
      grid = this.applyCellularAutomata(grid);
    }

    return grid;
  }

  /**
   * Apply cellular automata rules (4-5 rule)
   * If a tile has 5+ wall neighbors, it becomes a wall
   * If a tile has 4+ wall neighbors, it stays the same
   * Otherwise, it becomes floor
   * @param {Array} grid - Current grid
   * @returns {Array} New grid after applying rules
   */
  applyCellularAutomata(grid) {
    const height = grid.length;
    const width = grid[0].length;
    const newGrid = this.initializeGrid(width, height, this.terrainTypes.floor);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        // Edges remain walls
        if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
          newGrid[row][col].terrain = this.terrainTypes.wall;
          continue;
        }

        const wallNeighbors = this.countNeighborTerrain(grid, col, row, 'wall');

        if (wallNeighbors >= 5) {
          newGrid[row][col].terrain = this.terrainTypes.wall;
        } else if (wallNeighbors >= 4) {
          newGrid[row][col].terrain = grid[row][col].terrain; // Stay the same
        } else {
          newGrid[row][col].terrain = this.terrainTypes.floor;
        }
      }
    }

    return newGrid;
  }

  /**
   * Ensure all floor tiles are connected
   * Uses flood fill to find isolated regions and connects them
   * @param {Array} grid - Grid to modify
   */
  ensureConnectivity(grid) {
    const height = grid.length;
    const width = grid[0].length;

    // Find all floor tiles
    const floorTiles = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (grid[row][col].terrain.walkable) {
          floorTiles.push({ col, row });
        }
      }
    }

    if (floorTiles.length === 0) {
      // No floor tiles, make some
      const centerRow = Math.floor(height / 2);
      const centerCol = Math.floor(width / 2);
      grid[centerRow][centerCol].terrain = this.terrainTypes.floor;
      floorTiles.push({ col: centerCol, row: centerRow });
    }

    // Start flood fill from first floor tile
    const startTile = floorTiles[0];
    const connected = this.floodFill(
      grid,
      startTile.col,
      startTile.row,
      hex => hex.terrain.walkable
    );

    // Find isolated regions
    const isolated = floorTiles.filter(tile => {
      return !connected.has(`${tile.col},${tile.row}`);
    });

    // Connect isolated regions by carving paths
    for (const isolatedTile of isolated) {
      this.carvePath(grid, startTile, isolatedTile);
    }
  }

  /**
   * Carve a path between two points
   * @param {Array} grid
   * @param {object} start - {col, row}
   * @param {object} end - {col, row}
   */
  carvePath(grid, start, end) {
    let current = { ...start };

    while (current.col !== end.col || current.row !== end.row) {
      // Make current tile floor
      grid[current.row][current.col].terrain = this.terrainTypes.floor;

      // Move towards end
      const dx = end.col - current.col;
      const dy = end.row - current.row;

      if (Math.abs(dx) > Math.abs(dy)) {
        current.col += dx > 0 ? 1 : -1;
      } else {
        current.row += dy > 0 ? 1 : -1;
      }

      // Bounds check
      if (
        current.row < 0 ||
        current.row >= grid.length ||
        current.col < 0 ||
        current.col >= grid[0].length
      ) {
        break;
      }
    }
  }

  /**
   * Place entrance hex
   * @param {Array} grid
   * @returns {object} {col, row} of entrance
   */
  placeEntrance(grid) {
    const height = grid.length;
    const width = grid[0].length;

    // Find floor tiles near edges (not on edge, but close)
    const candidates = [];

    // Check tiles 1 row/col from edge
    for (let col = 1; col < width - 1; col++) {
      // Top area
      if (grid[1][col].terrain.walkable) {
        candidates.push({ col, row: 1 });
      }
      // Bottom area
      if (grid[height - 2][col].terrain.walkable) {
        candidates.push({ col, row: height - 2 });
      }
    }

    for (let row = 1; row < height - 1; row++) {
      // Left area
      if (grid[row][1].terrain.walkable) {
        candidates.push({ col: 1, row });
      }
      // Right area
      if (grid[row][width - 2].terrain.walkable) {
        candidates.push({ col: width - 2, row });
      }
    }

    // Pick random candidate or fallback to center
    let entrance;
    if (candidates.length > 0) {
      entrance = this.randomChoice(candidates);
    } else {
      // Fallback: find any floor tile
      const floorTiles = this.getWalkableTiles(grid);
      entrance =
        floorTiles.length > 0
          ? this.randomChoice(floorTiles)
          : { col: Math.floor(width / 2), row: Math.floor(height / 2) };
    }

    // Mark as entrance
    grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
    grid[entrance.row][entrance.col].content = 'entrance';

    return entrance;
  }

  /**
   * Place encounters in the cave
   * @param {object} interiorMap - Interior map data
   * @param {object} poiData - Original POI data (for creatures info)
   * @returns {Array} Array of encounter objects
   */
  placeEncounters(interiorMap, poiData) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // Determine number of encounters based on CR
    let encounterCount = 1;
    if (cr >= 3 && cr <= 5) encounterCount = 2;
    else if (cr > 5) encounterCount = 3;

    const encounters = [];

    for (let i = 0; i < encounterCount && floorTiles.length > 0; i++) {
      // Pick random floor tile away from entrance
      const entrance = interiorMap.entrance;
      const farTiles = floorTiles.filter(tile => {
        const dist = this.getHexDistance(tile.col, tile.row, entrance.col, entrance.row);
        return dist >= 3; // At least 3 hexes from entrance
      });

      const tile =
        farTiles.length > 0 ? this.randomChoice(farTiles) : this.randomChoice(floorTiles);

      // Remove from available tiles
      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      // Mark hex
      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'encounter';
      }

      encounters.push({
        col: tile.col,
        row: tile.row,
        cr: cr,
        creatures: poiData.creatures || `CR ${cr} enemies`,
        defeated: false,
        discovered: false,
      });
    }

    return encounters;
  }

  /**
   * Place loot in the cave
   * @param {object} interiorMap - Interior map data
   * @param {number} partySize - Party size for treasure hoard generation
   * @returns {Array} Array of loot objects
   */
  placeLoot(interiorMap, partySize = 4) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // Determine number of loot hexes based on CR
    const lootCount = Math.max(2, Math.floor(2 + cr * 0.5));

    const treasureGenerator = new TreasureGenerator();
    const loot = [];

    for (let i = 0; i < lootCount && floorTiles.length > 0; i++) {
      const tile = this.randomChoice(floorTiles);

      // Remove from available tiles
      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      // 25% chance of treasure chest, 75% regular loot
      const isChest = this.random() < 0.25;

      let lootData;
      let contentType;

      if (isChest) {
        // Generate DMG treasure hoard
        lootData = treasureGenerator.generateTreasureHoard(cr, partySize, () => this.random());
        contentType = 'chest';
      } else {
        // Generate regular loot
        lootData = this.lootGenerator.generateLoot(cr, () => this.random());
        contentType = 'loot';
      }

      // Mark hex
      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = contentType;
      }

      loot.push({
        col: tile.col,
        row: tile.row,
        type: contentType,
        gold: lootData.gold,
        items: lootData.items || [],
        consumables: lootData.consumables || [],
        rarity: lootData.rarity,
        collected: false,
        discovered: false,
      });
    }

    return loot;
  }

  /**
   * Place hazards in the cave
   * @param {object} interiorMap - Interior map data
   * @returns {Array} Array of hazard objects
   */
  placeHazards(interiorMap) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // 20-40% of remaining floor tiles become hazards
    const hazardPercentage = 0.2 + this.random() * 0.2;
    const hazardCount = Math.floor(floorTiles.length * hazardPercentage);

    const hazards = [];

    for (let i = 0; i < hazardCount && floorTiles.length > 0; i++) {
      const tile = this.randomChoice(floorTiles);

      // Remove from available tiles
      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      // Mark hex
      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'hazard';
      }

      // Generate hazard using HazardGenerator
      const generatedHazard = this.hazardGenerator.generateHazard(cr, () => this.random());

      hazards.push({
        col: tile.col,
        row: tile.row,
        ...generatedHazard,
        triggered: false,
        discovered: false,
      });
    }

    return hazards;
  }
}

export default CaveGenerator;
