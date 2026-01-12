/**
 * TowerGenerator - Generates vertical tower structures with multi-floor layouts
 * Extends InteriorGenerator base class
 */

import { InteriorGenerator } from './InteriorGenerator.js';
import { LootGenerator } from './LootGenerator.js';
import { HazardGenerator } from './HazardGenerator.js';
import { TreasureGenerator } from './TreasureGenerator.js';

export class TowerGenerator extends InteriorGenerator {
  constructor() {
    super();
    this.lootGenerator = new LootGenerator();
    this.hazardGenerator = new HazardGenerator();

    // Add staircase terrain for towers
    this.terrainTypes.stairsUp = {
      key: 'stairsUp',
      name: 'Stairs Up',
      color: '#6a5a3a',
      walkable: true
    };

    this.terrainTypes.stairsDown = {
      key: 'stairsDown',
      name: 'Stairs Down',
      color: '#5a4a2a',
      walkable: true
    };
  }

  /**
   * Generate a tower interior map
   * Towers are vertical structures with 3-5 floors connected by stairs
   * @param {number} width - Map width (total width for all floors side-by-side)
   * @param {number} height - Map height
   * @param {number} cr - Challenge rating
   * @returns {object} Interior map data
   */
  generate(width, height, cr) {
    // Determine floor count based on CR (3-5 floors)
    const floorCount = Math.min(5, Math.max(3, 3 + Math.floor(cr / 3)));

    // Generate tower layout (floors arranged horizontally for display)
    const grid = this.generateTowerLayout(width, height, cr, floorCount);

    // Place entrance on ground floor
    const entrance = this.placeEntrance(grid, floorCount);

    // Convert grid to hex array
    const hexes = this.gridToHexes(grid);

    // Return interior map data structure
    return {
      seed: this.seed,
      poiType: 'tower',
      cr,
      width,
      height,
      hexes,
      encounters: [], // Will be populated later
      loot: [], // Will be populated later
      hazards: [], // Will be populated later
      entrance,
      floorCount, // Track number of floors
      bossFloor: floorCount - 1 // Boss is on top floor
    };
  }

  /**
   * Generate tower layout with multiple floors
   * Each floor is a circular/octagonal room
   * Floors are arranged horizontally in the grid for visualization
   * @param {number} width
   * @param {number} height
   * @param {number} cr
   * @param {number} floorCount
   * @returns {Array} 2D grid
   */
  generateTowerLayout(width, height, cr, floorCount) {
    // Initialize grid with walls
    let grid = this.initializeGrid(width, height, this.terrainTypes.wall);

    // Calculate floor width (divide total width by floor count)
    const floorWidth = Math.floor(width / floorCount);

    // Generate each floor
    for (let floor = 0; floor < floorCount; floor++) {
      const offsetCol = floor * floorWidth;

      // Each floor is slightly smaller/larger based on position
      // Ground floor is largest, top floor is smallest
      const floorSizeModifier = 1 - (floor * 0.1);
      const floorRadius = Math.floor(Math.min(floorWidth, height) / 2 * floorSizeModifier);

      // Center of this floor
      const centerCol = offsetCol + Math.floor(floorWidth / 2);
      const centerRow = Math.floor(height / 2);

      // Create circular floor
      for (let row = 0; row < height; row++) {
        for (let col = offsetCol; col < offsetCol + floorWidth; col++) {
          if (col >= width) continue;

          // Calculate distance from floor center
          const dx = col - centerCol;
          const dy = row - centerRow;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= floorRadius) {
            grid[row][col].terrain = this.terrainTypes.floor;
          }
        }
      }

      // Place stairs (except on top floor)
      if (floor < floorCount - 1) {
        // Stairs up on this floor
        const stairCol = centerCol + Math.floor(floorRadius * 0.5);
        const stairRow = centerRow;

        if (stairCol >= 0 && stairCol < width && stairRow >= 0 && stairRow < height) {
          grid[stairRow][stairCol].terrain = this.terrainTypes.stairsUp;
          grid[stairRow][stairCol].content = 'stairsUp';
          grid[stairRow][stairCol].connectedFloor = floor + 1;
        }
      }

      // Place stairs down (except on ground floor)
      if (floor > 0) {
        const stairCol = centerCol - Math.floor(floorRadius * 0.5);
        const stairRow = centerRow;

        if (stairCol >= 0 && stairCol < width && stairRow >= 0 && stairRow < height) {
          grid[stairRow][stairCol].terrain = this.terrainTypes.stairsDown;
          grid[stairRow][stairCol].content = 'stairsDown';
          grid[stairRow][stairCol].connectedFloor = floor - 1;
        }
      }

      // Add some pillars/obstacles (20% chance per floor tile)
      this.addPillars(grid, offsetCol, offsetCol + floorWidth, 0.15);
    }

    return grid;
  }

  /**
   * Add pillars to simulate tower architecture
   * @param {Array} grid
   * @param {number} minCol - Minimum column to add pillars
   * @param {number} maxCol - Maximum column to add pillars
   * @param {number} percentage - Percentage of floor tiles to convert
   */
  addPillars(grid, minCol, maxCol, percentage) {
    const floorTiles = [];
    for (let row = 0; row < grid.length; row++) {
      for (let col = minCol; col < maxCol && col < grid[row].length; col++) {
        if (grid[row][col].terrain.key === 'floor' && !grid[row][col].content) {
          floorTiles.push({ col, row });
        }
      }
    }

    const pillarCount = Math.floor(floorTiles.length * percentage);

    for (let i = 0; i < pillarCount; i++) {
      const tile = this.randomChoice(floorTiles);
      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      grid[tile.row][tile.col].terrain = this.terrainTypes.wall;
    }
  }

  /**
   * Place entrance on ground floor (floor 0)
   * @param {Array} grid
   * @param {number} floorCount
   * @returns {object} {col, row, floor} of entrance
   */
  placeEntrance(grid, floorCount) {
    const height = grid.length;
    const width = grid[0].length;

    // Ground floor is floor 0
    const floorWidth = Math.floor(width / floorCount);

    // Find walkable tiles on ground floor (offsetCol 0 to floorWidth)
    const candidates = [];

    for (let row = 1; row < height - 1; row++) {
      for (let col = 1; col < Math.min(floorWidth - 1, width); col++) {
        if (grid[row][col].terrain.walkable && !grid[row][col].content) {
          candidates.push({ col, row, floor: 0 });
        }
      }
    }

    // Pick random candidate
    let entrance;
    if (candidates.length > 0) {
      entrance = this.randomChoice(candidates);
    } else {
      // Fallback
      entrance = {
        col: Math.floor(floorWidth / 2),
        row: Math.floor(height / 2),
        floor: 0
      };
    }

    // Mark as entrance
    grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
    grid[entrance.row][entrance.col].content = 'entrance';

    return entrance;
  }

  /**
   * Place encounters in the tower (one per floor, boss on top)
   * @param {object} interiorMap - Interior map data
   * @param {object} poiData - Original POI data
   * @returns {Array} Array of encounter objects
   */
  placeEncounters(interiorMap, poiData) {
    const floorCount = interiorMap.floorCount;
    const floorWidth = Math.floor(interiorMap.width / floorCount);

    const encounters = [];

    // Place one encounter per floor
    for (let floor = 0; floor < floorCount; floor++) {
      const offsetCol = floor * floorWidth;

      // Get floor tiles for this floor
      const floorTiles = interiorMap.hexes.filter(hex => {
        return hex.col >= offsetCol &&
               hex.col < offsetCol + floorWidth &&
               hex.terrain.walkable &&
               hex.content === null;
      });

      if (floorTiles.length === 0) continue;

      const tile = this.randomChoice(floorTiles);

      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'encounter';
      }

      // Top floor has boss encounter
      const isBoss = floor === floorCount - 1;
      const encounterCR = isBoss ? Math.ceil(interiorMap.cr * 1.5) : interiorMap.cr;

      encounters.push({
        col: tile.col,
        row: tile.row,
        floor: floor,
        cr: encounterCR,
        creatures: isBoss
          ? `Boss: CR ${encounterCR} ${poiData.creatures || 'guardian'}`
          : poiData.creatures || `CR ${encounterCR} enemies`,
        defeated: false,
        discovered: false,
        isBoss: isBoss
      });
    }

    return encounters;
  }

  /**
   * Place loot in the tower (concentrated on upper floors)
   * @param {object} interiorMap - Interior map data
   * @param {number} partySize - Party size for treasure hoard generation
   * @returns {Array} Array of loot objects
   */
  placeLoot(interiorMap, partySize = 4) {
    const cr = interiorMap.cr;
    const floorCount = interiorMap.floorCount;
    const floorWidth = Math.floor(interiorMap.width / floorCount);

    // More loot on higher floors
    const lootCount = Math.max(3, Math.floor(2 + cr * 0.7));

    const treasureGenerator = new TreasureGenerator();
    const loot = [];

    for (let i = 0; i < lootCount; i++) {
      // Bias towards upper floors (70% chance of upper half)
      const targetFloor = this.random() > 0.3
        ? Math.floor(floorCount / 2) + this.randomInt(0, Math.floor(floorCount / 2))
        : this.randomInt(0, Math.floor(floorCount / 2) - 1);

      const offsetCol = targetFloor * floorWidth;

      const floorTiles = interiorMap.hexes.filter(hex => {
        return hex.col >= offsetCol &&
               hex.col < offsetCol + floorWidth &&
               hex.terrain.walkable &&
               hex.content === null;
      });

      if (floorTiles.length === 0) continue;

      const tile = this.randomChoice(floorTiles);

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

      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = contentType;
      }

      loot.push({
        col: tile.col,
        row: tile.row,
        floor: targetFloor,
        type: contentType,
        gold: lootData.gold,
        items: lootData.items || [],
        consumables: lootData.consumables || [],
        rarity: lootData.rarity,
        collected: false,
        discovered: false
      });
    }

    return loot;
  }

  /**
   * Place hazards in the tower
   * @param {object} interiorMap - Interior map data
   * @returns {Array} Array of hazard objects
   */
  placeHazards(interiorMap) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // Fewer hazards in towers (10-20%)
    const hazardPercentage = 0.10 + this.random() * 0.10;
    const hazardCount = Math.floor(floorTiles.length * hazardPercentage);

    const hazards = [];

    for (let i = 0; i < hazardCount && floorTiles.length > 0; i++) {
      const tile = this.randomChoice(floorTiles);

      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'hazard';
      }

      const generatedHazard = this.hazardGenerator.generateHazard(cr, () => this.random());

      hazards.push({
        col: tile.col,
        row: tile.row,
        ...generatedHazard,
        triggered: false,
        discovered: false
      });
    }

    return hazards;
  }
}

export default TowerGenerator;
