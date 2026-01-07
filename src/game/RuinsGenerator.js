/**
 * RuinsGenerator - Generates ancient ruins with room-based layouts and crumbling walls
 * Extends InteriorGenerator base class
 */

import { InteriorGenerator } from './InteriorGenerator.js';
import { LootGenerator } from './LootGenerator.js';
import { HazardGenerator } from './HazardGenerator.js';

export class RuinsGenerator extends InteriorGenerator {
  constructor() {
    super();
    this.lootGenerator = new LootGenerator();
    this.hazardGenerator = new HazardGenerator();

    // Add rubble terrain for ruins
    this.terrainTypes.rubble = {
      key: 'rubble',
      name: 'Rubble',
      color: '#5a5a5a',
      walkable: true
    };
  }

  /**
   * Generate a ruins interior map
   * @param {number} width - Map width
   * @param {number} height - Map height
   * @param {number} cr - Challenge rating
   * @returns {object} Interior map data
   */
  generate(width, height, cr) {
    // Generate ruins layout with room-based generation
    const grid = this.generateRuinsLayout(width, height, cr);

    // Place entrance
    const entrance = this.placeEntrance(grid);

    // Convert grid to hex array
    const hexes = this.gridToHexes(grid);

    // Return interior map data structure
    return {
      seed: this.seed,
      poiType: 'ruins',
      cr,
      width,
      height,
      hexes,
      encounters: [], // Will be populated later
      loot: [], // Will be populated later
      hazards: [], // Will be populated later
      entrance
    };
  }

  /**
   * Generate ruins layout with room-based generation
   * Creates 3-7 rooms connected by corridors with crumbling walls
   * @param {number} width
   * @param {number} height
   * @param {number} cr - Challenge rating affects room count
   * @returns {Array} 2D grid
   */
  generateRuinsLayout(width, height, cr) {
    // Initialize grid with walls
    let grid = this.initializeGrid(width, height, this.terrainTypes.wall);

    // Determine room count based on CR (3-7 rooms)
    const roomCount = Math.min(7, Math.max(3, 3 + Math.floor(cr / 2)));

    // Generate rooms
    const rooms = [];
    let attempts = 0;
    const maxAttempts = 100;

    while (rooms.length < roomCount && attempts < maxAttempts) {
      attempts++;

      // Random room size (3x3 to 5x5 hexes)
      const roomWidth = this.randomInt(3, 5);
      const roomHeight = this.randomInt(3, 5);

      // Random position (ensure room fits within bounds)
      const roomCol = this.randomInt(1, width - roomWidth - 1);
      const roomRow = this.randomInt(1, height - roomHeight - 1);

      // Check if room overlaps with existing rooms
      const overlaps = rooms.some(room => {
        return !(roomCol + roomWidth < room.col ||
                roomCol > room.col + room.width ||
                roomRow + roomHeight < room.row ||
                roomRow > room.row + room.height);
      });

      if (!overlaps) {
        rooms.push({
          col: roomCol,
          row: roomRow,
          width: roomWidth,
          height: roomHeight
        });
      }
    }

    // Carve out rooms
    for (const room of rooms) {
      for (let row = room.row; row < room.row + room.height; row++) {
        for (let col = room.col; col < room.col + room.width; col++) {
          if (row >= 0 && row < height && col >= 0 && col < width) {
            grid[row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
    }

    // Connect rooms with corridors
    for (let i = 0; i < rooms.length - 1; i++) {
      const roomA = rooms[i];
      const roomB = rooms[i + 1];

      // Find center of each room
      const centerA = {
        col: Math.floor(roomA.col + roomA.width / 2),
        row: Math.floor(roomA.row + roomA.height / 2)
      };
      const centerB = {
        col: Math.floor(roomB.col + roomB.width / 2),
        row: Math.floor(roomB.row + roomB.height / 2)
      };

      // Carve corridor (L-shaped)
      this.carveRuinsCorridor(grid, centerA, centerB);
    }

    // Add some additional random connections for complexity
    if (rooms.length >= 4) {
      const extraConnections = Math.floor(rooms.length / 3);
      for (let i = 0; i < extraConnections; i++) {
        const roomA = this.randomChoice(rooms);
        const roomB = this.randomChoice(rooms);

        if (roomA !== roomB) {
          const centerA = {
            col: Math.floor(roomA.col + roomA.width / 2),
            row: Math.floor(roomA.row + roomA.height / 2)
          };
          const centerB = {
            col: Math.floor(roomB.col + roomB.width / 2),
            row: Math.floor(roomB.row + roomB.height / 2)
          };

          this.carveRuinsCorridor(grid, centerA, centerB);
        }
      }
    }

    // Add rubble to simulate crumbling walls (10-20% of floor tiles)
    this.addRubble(grid, 0.10, 0.20);

    // Add occasional chasms (collapsed floors)
    this.addChasms(grid, 0.02, 0.05);

    return grid;
  }

  /**
   * Carve L-shaped corridor between two points
   * @param {Array} grid
   * @param {object} start - {col, row}
   * @param {object} end - {col, row}
   */
  carveRuinsCorridor(grid, start, end) {
    // Choose to go horizontal first or vertical first randomly
    const horizontalFirst = this.random() > 0.5;

    if (horizontalFirst) {
      // Horizontal then vertical
      for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
        if (start.row >= 0 && start.row < grid.length && col >= 0 && col < grid[0].length) {
          grid[start.row][col].terrain = this.terrainTypes.floor;
        }
      }
      for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
        if (row >= 0 && row < grid.length && end.col >= 0 && end.col < grid[0].length) {
          grid[row][end.col].terrain = this.terrainTypes.floor;
        }
      }
    } else {
      // Vertical then horizontal
      for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
        if (row >= 0 && row < grid.length && start.col >= 0 && start.col < grid[0].length) {
          grid[row][start.col].terrain = this.terrainTypes.floor;
        }
      }
      for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
        if (end.row >= 0 && end.row < grid.length && col >= 0 && col < grid[0].length) {
          grid[end.row][col].terrain = this.terrainTypes.floor;
        }
      }
    }
  }

  /**
   * Add rubble to simulate crumbling structures
   * @param {Array} grid
   * @param {number} minPercent - Minimum percentage of floor tiles to convert
   * @param {number} maxPercent - Maximum percentage of floor tiles to convert
   */
  addRubble(grid, minPercent, maxPercent) {
    const floorTiles = [];
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col].terrain.key === 'floor') {
          floorTiles.push({ col, row });
        }
      }
    }

    const rubblePercent = minPercent + this.random() * (maxPercent - minPercent);
    const rubbleCount = Math.floor(floorTiles.length * rubblePercent);

    for (let i = 0; i < rubbleCount; i++) {
      const tile = this.randomChoice(floorTiles);
      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      grid[tile.row][tile.col].terrain = this.terrainTypes.rubble;
    }
  }

  /**
   * Add chasms (collapsed floors)
   * @param {Array} grid
   * @param {number} minPercent - Minimum percentage
   * @param {number} maxPercent - Maximum percentage
   */
  addChasms(grid, minPercent, maxPercent) {
    const floorTiles = [];
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col].terrain.key === 'floor' || grid[row][col].terrain.key === 'rubble') {
          floorTiles.push({ col, row });
        }
      }
    }

    const chasmPercent = minPercent + this.random() * (maxPercent - minPercent);
    const chasmCount = Math.floor(floorTiles.length * chasmPercent);

    for (let i = 0; i < chasmCount; i++) {
      const tile = this.randomChoice(floorTiles);
      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      grid[tile.row][tile.col].terrain = this.terrainTypes.chasm;
    }
  }

  /**
   * Place entrance hex at edge of a random room
   * @param {Array} grid
   * @returns {object} {col, row} of entrance
   */
  placeEntrance(grid) {
    const height = grid.length;
    const width = grid[0].length;

    // Find floor tiles near edges
    const candidates = [];

    for (let col = 1; col < width - 1; col++) {
      if (grid[1][col].terrain.walkable) {
        candidates.push({ col, row: 1 });
      }
      if (grid[height - 2][col].terrain.walkable) {
        candidates.push({ col, row: height - 2 });
      }
    }

    for (let row = 1; row < height - 1; row++) {
      if (grid[row][1].terrain.walkable) {
        candidates.push({ col: 1, row });
      }
      if (grid[row][width - 2].terrain.walkable) {
        candidates.push({ col: width - 2, row });
      }
    }

    // Pick random candidate or fallback
    let entrance;
    if (candidates.length > 0) {
      entrance = this.randomChoice(candidates);
    } else {
      const walkableTiles = this.getWalkableTiles(grid);
      entrance = walkableTiles.length > 0
        ? this.randomChoice(walkableTiles)
        : { col: Math.floor(width / 2), row: Math.floor(height / 2) };
    }

    // Mark as entrance
    grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
    grid[entrance.row][entrance.col].content = 'entrance';

    return entrance;
  }

  /**
   * Place encounters in the ruins
   * @param {object} interiorMap - Interior map data
   * @param {object} poiData - Original POI data
   * @returns {Array} Array of encounter objects
   */
  placeEncounters(interiorMap, poiData) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // Determine number of encounters (1-3 based on CR)
    let encounterCount = 1;
    if (cr >= 3 && cr <= 5) encounterCount = 2;
    else if (cr > 5) encounterCount = 3;

    const encounters = [];

    for (let i = 0; i < encounterCount && floorTiles.length > 0; i++) {
      const entrance = interiorMap.entrance;
      const farTiles = floorTiles.filter(tile => {
        const dist = this.getHexDistance(tile.col, tile.row, entrance.col, entrance.row);
        return dist >= 4;
      });

      const tile = farTiles.length > 0
        ? this.randomChoice(farTiles)
        : this.randomChoice(floorTiles);

      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'encounter';
      }

      encounters.push({
        col: tile.col,
        row: tile.row,
        cr: cr,
        creatures: poiData.creatures || `CR ${cr} guardians`,
        defeated: false
      });
    }

    return encounters;
  }

  /**
   * Place loot in the ruins (ancient treasures)
   * @param {object} interiorMap - Interior map data
   * @returns {Array} Array of loot objects
   */
  placeLoot(interiorMap) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // Ruins have more loot than caves (ancient treasures)
    const lootCount = Math.max(3, Math.floor(3 + cr * 0.6));

    const loot = [];

    for (let i = 0; i < lootCount && floorTiles.length > 0; i++) {
      const tile = this.randomChoice(floorTiles);

      const index = floorTiles.indexOf(tile);
      floorTiles.splice(index, 1);

      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'loot';
      }

      const generatedLoot = this.lootGenerator.generateLoot(cr, () => this.random());

      loot.push({
        col: tile.col,
        row: tile.row,
        gold: generatedLoot.gold,
        items: generatedLoot.items,
        rarity: generatedLoot.rarity,
        collected: false
      });
    }

    return loot;
  }

  /**
   * Place hazards in the ruins (traps, unstable floors)
   * @param {object} interiorMap - Interior map data
   * @returns {Array} Array of hazard objects
   */
  placeHazards(interiorMap) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // More hazards than caves (15-30% of remaining floor tiles)
    const hazardPercentage = 0.15 + this.random() * 0.15;
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
        ...generatedHazard
      });
    }

    return hazards;
  }
}

export default RuinsGenerator;
