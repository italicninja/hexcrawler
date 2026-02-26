// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * TownGenerator - Generates walkable town interiors with buildings, roads, and NPCs
 * Towns are structured layouts with a central square and organized districts
 */

import { InteriorGenerator } from './InteriorGenerator';

export class TownGenerator extends InteriorGenerator {
  constructor() {
    super();

    // Town-specific terrain types
    this.terrainTypes = {
      ...this.terrainTypes,
      road: {
        key: 'road',
        name: 'Cobblestone Road',
        color: '#8B7355',
        walkable: true,
      },
      grass: {
        key: 'grass',
        name: 'Grass',
        color: '#567d46',
        walkable: true,
      },
      townSquare: {
        key: 'townSquare',
        name: 'Town Square',
        color: '#a89968',
        walkable: true,
      },
      building: {
        key: 'building',
        name: 'Building',
        color: '#8B4513',
        walkable: false,
      },
      buildingEntrance: {
        key: 'buildingEntrance',
        name: 'Building Entrance',
        color: '#654321',
        walkable: true,
        isInteractive: true,
      },
      gate: {
        key: 'gate',
        name: 'Town Gate',
        color: '#5C4033',
        walkable: true,
      },
      fence: {
        key: 'fence',
        name: 'Fence',
        color: '#4a3f35',
        walkable: false,
      },
    };

    // Building types with their metadata
    this.buildingTypes = {
      inn: {
        key: 'inn',
        name: 'The Weary Traveler Inn',
        icon: '🏨',
        size: { width: 3, height: 3 },
        entranceOffset: { col: 1, row: 2 }, // Bottom center
      },
      shop: {
        key: 'shop',
        name: 'General Store',
        icon: '🏪',
        size: { width: 3, height: 2 },
        entranceOffset: { col: 1, row: 1 }, // Bottom center
      },
      questBoard: {
        key: 'questBoard',
        name: 'Quest Board',
        icon: '📋',
        size: { width: 2, height: 2 },
        entranceOffset: { col: 0, row: 1 }, // Bottom left
      },
      blacksmith: {
        key: 'blacksmith',
        name: 'Blacksmith',
        icon: '⚒️',
        size: { width: 3, height: 2 },
        entranceOffset: { col: 1, row: 1 },
      },
      temple: {
        key: 'temple',
        name: 'Temple',
        icon: '⛪',
        size: { width: 4, height: 3 },
        entranceOffset: { col: 2, row: 2 },
      },
      house: {
        key: 'house',
        name: 'House',
        icon: '🏠',
        size: { width: 2, height: 2 },
        entranceOffset: { col: 0, row: 1 },
      },
      tent: {
        key: 'tent',
        name: 'Tent',
        icon: '⛺',
        size: { width: 2, height: 1 },
        entranceOffset: { col: 0, row: 0 },
      },
      campfire: {
        key: 'campfire',
        name: 'Campfire',
        icon: '🔥',
        size: { width: 1, height: 1 },
        entranceOffset: { col: 0, row: 0 },
      },
      supplyWagon: {
        key: 'supplyWagon',
        name: 'Supply Wagon',
        icon: '🛒',
        size: { width: 2, height: 1 },
        entranceOffset: { col: 0, row: 0 },
      },
      market: {
        key: 'market',
        name: 'Market',
        icon: '🏬',
        size: { width: 3, height: 2 },
        entranceOffset: { col: 1, row: 1 },
      },
      barracks: {
        key: 'barracks',
        name: 'Barracks',
        icon: '🛡️',
        size: { width: 4, height: 2 },
        entranceOffset: { col: 2, row: 1 },
      },
    };
  }

  /**
   * Generate a settlement interior map (routed by settlement size)
   * @param {number} width - Map width
   * @param {number} height - Map height
   * @param {object} townData - Settlement metadata (name, settlementSize, etc.)
   * @returns {object} Interior map data
   */
  generate(width, height, townData = {}) {
    const settlementSize = townData.settlementSize || 'town';

    switch (settlementSize) {
      case 'camp':
        return this.generateCampLayout(width, height, townData);
      case 'village':
        return this.generateVillageLayout(width, height, townData);
      case 'town':
        return this.generateTownLayout(width, height, townData);
      case 'city':
        return this.generateCityLayout(width, height, townData);
      case 'metropolis':
        return this.generateMetropolisLayout(width, height, townData);
      default:
        return this.generateTownLayout(width, height, townData);
    }
  }

  /**
   * Generate a camp layout (smallest settlement)
   * @param {number} width - Map width (12×10)
   * @param {number} height - Map height
   * @param {object} townData - Camp metadata
   * @returns {object} Interior map data
   */
  generateCampLayout(width, height, townData) {
    // Initialize grid with grass (no walls)
    const grid = this.initializeGrid(width, height, this.terrainTypes.grass);

    const centerCol = Math.floor(width / 2);
    const centerRow = Math.floor(height / 2);
    const buildings = [];

    // Place campfire in center
    const campfire = this.placeBuilding(grid, this.buildingTypes.campfire, centerCol, centerRow);
    if (campfire) buildings.push(campfire);

    // Place 2-3 tents around campfire
    const numTents = this.randomInt(2, 3);
    const tentPositions = [
      { col: centerCol - 3, row: centerRow - 2 },
      { col: centerCol + 2, row: centerRow - 2 },
      { col: centerCol - 1, row: centerRow + 2 },
    ];

    for (let i = 0; i < numTents && i < tentPositions.length; i++) {
      const tent = this.placeBuilding(
        grid,
        this.buildingTypes.tent,
        tentPositions[i].col,
        tentPositions[i].row
      );
      if (tent) buildings.push(tent);
    }

    // Place supply wagon (acts as shop)
    const wagon = this.placeBuilding(
      grid,
      this.buildingTypes.supplyWagon,
      centerCol + 3,
      centerRow + 1
    );
    if (wagon) buildings.push(wagon);

    // Place quest board
    const questBoard = this.placeBuilding(
      grid,
      this.buildingTypes.questBoard,
      centerCol - 4,
      centerRow + 1
    );
    if (questBoard) buildings.push(questBoard);

    // Place entrance at bottom center — row height-2 so it lands on grass,
    // not on the perimeter fence (row height-1) which is non-walkable.
    const entranceCol = centerCol;
    const entranceRow = height - 2;
    grid[entranceRow][entranceCol].terrain = this.terrainTypes.gate;
    grid[entranceRow][entranceCol].content = 'entrance';

    // Convert grid to hex array
    const hexes = this.gridToHexes(grid);
    const entrance = { col: entranceCol, row: entranceRow };
    const centerSquare = { col: centerCol, row: centerRow, radius: 1 };

    return {
      seed: this.seed,
      poiType: 'camp',
      width,
      height,
      hexes,
      buildings,
      encounters: [],
      loot: [],
      hazards: [],
      entrance,
      centerSquare,
    };
  }

  /**
   * Generate a village layout (small settlement)
   * @param {number} width - Map width (18×14)
   * @param {number} height - Map height
   * @param {object} townData - Village metadata
   * @returns {object} Interior map data
   */
  generateVillageLayout(width, height, townData) {
    // Initialize grid with grass
    const grid = this.initializeGrid(width, height, this.terrainTypes.grass);

    // Add fence perimeter
    this.generateTownWalls(grid);

    const centerCol = Math.floor(width / 2);
    const centerRow = Math.floor(height / 2);
    const buildings = [];

    // Small 3×3 town square in center
    const squareRadius = 1;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const distance = this.getHexDistance(col, row, centerCol, centerRow);
        if (distance <= squareRadius) {
          grid[row][col].terrain = this.terrainTypes.townSquare;
        }
      }
    }

    // Single horizontal road through center
    for (let col = 0; col < width; col++) {
      if (grid[centerRow][col].terrain.key !== 'townSquare') {
        grid[centerRow][col].terrain = this.terrainTypes.road;
      }
    }

    // Place essential buildings: inn, shop, quest board only
    const inn = this.placeBuilding(grid, this.buildingTypes.inn, centerCol - 5, centerRow - 3);
    if (inn) buildings.push(inn);

    const shop = this.placeBuilding(grid, this.buildingTypes.shop, centerCol + 3, centerRow - 3);
    if (shop) buildings.push(shop);

    const questBoard = this.placeBuilding(
      grid,
      this.buildingTypes.questBoard,
      centerCol - 1,
      centerRow - 4
    );
    if (questBoard) buildings.push(questBoard);

    // Place 2-4 houses
    const numHouses = this.randomInt(2, 4);
    let housesPlaced = 0;
    let attempts = 0;

    while (housesPlaced < numHouses && attempts < 30) {
      attempts++;
      const col = this.randomInt(3, width - 4);
      const row = this.randomInt(3, height - 4);

      if (this.getHexDistance(col, row, centerCol, centerRow) < 3) {
        continue;
      }

      const house = this.placeBuilding(grid, this.buildingTypes.house, col, row);
      if (house) {
        buildings.push(house);
        housesPlaced++;
      }
    }

    // Place gate at bottom
    this.placeGate(grid);

    // Convert grid to hex array
    const hexes = this.gridToHexes(grid);
    const entrance = this.findEntrance(grid);
    const centerSquare = { col: centerCol, row: centerRow, radius: squareRadius };

    return {
      seed: this.seed,
      poiType: 'village',
      width,
      height,
      hexes,
      buildings,
      encounters: [],
      loot: [],
      hazards: [],
      entrance,
      centerSquare,
    };
  }

  /**
   * Generate a town layout (original logic)
   * @param {number} width - Map width (typically 20-25)
   * @param {number} height - Map height (typically 15-20)
   * @param {object} townData - Town metadata
   * @returns {object} Interior map data
   */
  generateTownLayout(width, height, townData) {
    // Initialize grid with grass
    const grid = this.initializeGrid(width, height, this.terrainTypes.grass);

    // Generate town layout
    this.generateTownWalls(grid);
    const centerSquare = this.generateTownSquare(grid);
    this.generateMainRoads(grid, centerSquare);
    const buildings = this.placeBuildings(grid, townData);
    this.generateSecondaryRoads(grid, buildings);
    this.placeGate(grid);

    // Convert grid to hex array
    const hexes = this.gridToHexes(grid);

    // Find entrance (at gate)
    const entrance = this.findEntrance(grid);

    // Return interior map data structure
    return {
      seed: this.seed,
      poiType: 'town',
      width,
      height,
      hexes,
      buildings, // Building metadata with positions
      encounters: [], // Towns have no random encounters
      loot: [], // Towns have no random loot
      hazards: [], // Towns have no hazards
      entrance,
      centerSquare,
    };
  }

  /**
   * Generate a city or metropolis layout (larger settlement)
   * @param {number} width - Map width (30×24 for city, 36×30 for metropolis)
   * @param {number} height - Map height
   * @param {object} townData - City metadata
   * @returns {object} Interior map data
   */
  generateCityLayout(width, height, townData) {
    const isMetropolis = townData.settlementSize === 'metropolis';

    // Initialize grid with grass
    const grid = this.initializeGrid(width, height, this.terrainTypes.grass);

    // Generate walls
    this.generateTownWalls(grid);

    const centerCol = Math.floor(width / 2);
    const centerRow = Math.floor(height / 2);

    // Bigger town square (radius 2 for city, 3 for metropolis)
    const squareRadius = isMetropolis ? 3 : 2;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const distance = this.getHexDistance(col, row, centerCol, centerRow);
        if (distance <= squareRadius) {
          grid[row][col].terrain = this.terrainTypes.townSquare;
        }
      }
    }

    // Grid pattern roads (every 6 hexes)
    for (let col = 0; col < width; col += 6) {
      for (let row = 0; row < height; row++) {
        if (grid[row][col].terrain.key !== 'townSquare' && grid[row][col].terrain.key !== 'fence') {
          grid[row][col].terrain = this.terrainTypes.road;
        }
      }
    }

    for (let row = 0; row < height; row += 6) {
      for (let col = 0; col < width; col++) {
        if (grid[row][col].terrain.key !== 'townSquare' && grid[row][col].terrain.key !== 'fence') {
          grid[row][col].terrain = this.terrainTypes.road;
        }
      }
    }

    // Main roads through center
    for (let col = 0; col < width; col++) {
      if (grid[centerRow][col].terrain.key !== 'townSquare') {
        grid[centerRow][col].terrain = this.terrainTypes.road;
      }
    }

    for (let row = 0; row < height; row++) {
      if (grid[row][centerCol].terrain.key !== 'townSquare') {
        grid[row][centerCol].terrain = this.terrainTypes.road;
      }
    }

    const buildings = [];

    // Place all town buildings + market + barracks
    const essentialPositions = [
      { type: this.buildingTypes.inn, position: { col: centerCol - 8, row: centerRow - 6 } },
      { type: this.buildingTypes.shop, position: { col: centerCol + 5, row: centerRow - 6 } },
      { type: this.buildingTypes.questBoard, position: { col: centerCol - 1, row: centerRow - 7 } },
      { type: this.buildingTypes.blacksmith, position: { col: centerCol - 8, row: centerRow + 5 } },
      { type: this.buildingTypes.temple, position: { col: centerCol + 4, row: centerRow + 5 } },
      { type: this.buildingTypes.market, position: { col: centerCol - 12, row: centerRow - 2 } },
      { type: this.buildingTypes.barracks, position: { col: centerCol + 8, row: centerRow - 2 } },
    ];

    // Metropolis gets duplicate inns and shops
    if (isMetropolis) {
      essentialPositions.push(
        { type: this.buildingTypes.inn, position: { col: centerCol - 14, row: centerRow + 8 } },
        { type: this.buildingTypes.shop, position: { col: centerCol + 10, row: centerRow + 8 } }
      );
    }

    // Place essential buildings
    for (const { type, position } of essentialPositions) {
      const building = this.placeBuilding(grid, type, position.col, position.row);
      if (building) {
        buildings.push(building);
      }
    }

    // Place houses (8-12 for city, 12-18 for metropolis)
    const numHouses = isMetropolis ? this.randomInt(12, 18) : this.randomInt(8, 12);
    let housesPlaced = 0;
    let attempts = 0;

    while (housesPlaced < numHouses && attempts < 100) {
      attempts++;
      const col = this.randomInt(3, width - 4);
      const row = this.randomInt(3, height - 4);

      if (this.getHexDistance(col, row, centerCol, centerRow) < squareRadius + 3) {
        continue;
      }

      const house = this.placeBuilding(grid, this.buildingTypes.house, col, row);
      if (house) {
        buildings.push(house);
        housesPlaced++;
      }
    }

    // Connect buildings to roads
    this.generateSecondaryRoads(grid, buildings);

    // Place gate
    this.placeGate(grid);

    // Convert grid to hex array
    const hexes = this.gridToHexes(grid);
    const entrance = this.findEntrance(grid);
    const centerSquare = { col: centerCol, row: centerRow, radius: squareRadius };

    return {
      seed: this.seed,
      poiType: isMetropolis ? 'metropolis' : 'city',
      width,
      height,
      hexes,
      buildings,
      encounters: [],
      loot: [],
      hazards: [],
      entrance,
      centerSquare,
    };
  }

  /**
   * Generate a metropolis layout (alias to city with larger dimensions)
   * @param {number} width - Map width (36×30)
   * @param {number} height - Map height
   * @param {object} townData - Metropolis metadata
   * @returns {object} Interior map data
   */
  generateMetropolisLayout(width, height, townData) {
    return this.generateCityLayout(width, height, townData);
  }

  /**
   * Generate town walls/fence around perimeter
   * @param {Array} grid - 2D grid
   */
  generateTownWalls(grid) {
    const height = grid.length;
    const width = grid[0].length;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        // Perimeter fence
        if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
          grid[row][col].terrain = this.terrainTypes.fence;
        }
      }
    }
  }

  /**
   * Generate central town square
   * @param {Array} grid - 2D grid
   * @returns {object} Center square coordinates {col, row, radius}
   */
  generateTownSquare(grid) {
    const height = grid.length;
    const width = grid[0].length;

    const centerCol = Math.floor(width / 2);
    const centerRow = Math.floor(height / 2);
    const radius = 2;

    // Create circular town square
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const distance = this.getHexDistance(col, row, centerCol, centerRow);
        if (distance <= radius) {
          grid[row][col].terrain = this.terrainTypes.townSquare;
        }
      }
    }

    return { col: centerCol, row: centerRow, radius };
  }

  /**
   * Generate main roads radiating from town square
   * @param {Array} grid - 2D grid
   * @param {object} centerSquare - Center square data
   */
  generateMainRoads(grid, centerSquare) {
    const height = grid.length;
    const width = grid[0].length;
    const { col: centerCol, row: centerRow } = centerSquare;

    // Horizontal road through center
    for (let col = 0; col < width; col++) {
      if (grid[centerRow][col].terrain.key !== 'townSquare') {
        grid[centerRow][col].terrain = this.terrainTypes.road;
      }
    }

    // Vertical road through center
    for (let row = 0; row < height; row++) {
      if (grid[row][centerCol].terrain.key !== 'townSquare') {
        grid[row][centerCol].terrain = this.terrainTypes.road;
      }
    }
  }

  /**
   * Place buildings in the town
   * @param {Array} grid - 2D grid
   * @param {object} townData - Town metadata
   * @returns {Array} Array of placed buildings with metadata
   */
  placeBuildings(grid, townData) {
    const buildings = [];
    const height = grid.length;
    const width = grid[0].length;
    const centerCol = Math.floor(width / 2);
    const centerRow = Math.floor(height / 2);

    // Essential buildings (always present)
    const essentialBuildings = [
      { type: this.buildingTypes.inn, position: { col: centerCol - 6, row: centerRow - 4 } },
      { type: this.buildingTypes.shop, position: { col: centerCol + 4, row: centerRow - 4 } },
      { type: this.buildingTypes.questBoard, position: { col: centerCol - 1, row: centerRow - 5 } },
      { type: this.buildingTypes.blacksmith, position: { col: centerCol - 6, row: centerRow + 3 } },
      { type: this.buildingTypes.temple, position: { col: centerCol + 3, row: centerRow + 3 } },
    ];

    // Place essential buildings
    for (const { type, position } of essentialBuildings) {
      const building = this.placeBuilding(grid, type, position.col, position.row);
      if (building) {
        buildings.push(building);
      }
    }

    // Place random houses in remaining spaces
    const numHouses = this.randomInt(3, 6);
    let attempts = 0;
    let housesPlaced = 0;

    while (housesPlaced < numHouses && attempts < 50) {
      attempts++;

      // Random position avoiding center
      const col = this.randomInt(3, width - 5);
      const row = this.randomInt(3, height - 5);

      // Don't place too close to center
      if (this.getHexDistance(col, row, centerCol, centerRow) < 4) {
        continue;
      }

      const house = this.placeBuilding(grid, this.buildingTypes.house, col, row);
      if (house) {
        buildings.push(house);
        housesPlaced++;
      }
    }

    return buildings;
  }

  /**
   * Place a single building on the grid
   * @param {Array} grid - 2D grid
   * @param {object} buildingType - Building type metadata
   * @param {number} startCol - Top-left column
   * @param {number} startRow - Top-left row
   * @returns {object|null} Building data or null if placement failed
   */
  placeBuilding(grid, buildingType, startCol, startRow) {
    const { width: bWidth, height: bHeight } = buildingType.size;
    const height = grid.length;
    const width = grid[0].length;

    // Check if area is available
    for (let r = 0; r < bHeight; r++) {
      for (let c = 0; c < bWidth; c++) {
        const col = startCol + c;
        const row = startRow + r;

        if (col < 0 || col >= width || row < 0 || row >= height) {
          return null; // Out of bounds
        }

        const terrain = grid[row][col].terrain;
        // Can only build on grass or road (will overwrite)
        if (terrain.key !== 'grass' && terrain.key !== 'road') {
          return null; // Space occupied
        }
      }
    }

    // Place building
    for (let r = 0; r < bHeight; r++) {
      for (let c = 0; c < bWidth; c++) {
        const col = startCol + c;
        const row = startRow + r;
        grid[row][col].terrain = this.terrainTypes.building;
        grid[row][col].buildingType = buildingType.key;
      }
    }

    // Place entrance
    const entranceCol = startCol + buildingType.entranceOffset.col;
    const entranceRow = startRow + buildingType.entranceOffset.row;
    grid[entranceRow][entranceCol].terrain = this.terrainTypes.buildingEntrance;
    grid[entranceRow][entranceCol].buildingType = buildingType.key;

    return {
      type: buildingType.key,
      name: buildingType.name,
      icon: buildingType.icon,
      col: startCol,
      row: startRow,
      width: bWidth,
      height: bHeight,
      entrance: { col: entranceCol, row: entranceRow },
    };
  }

  /**
   * Generate secondary roads connecting buildings
   * @param {Array} grid - 2D grid
   * @param {Array} buildings - Placed buildings
   */
  generateSecondaryRoads(grid, buildings) {
    // Connect each building entrance to nearest main road
    for (const building of buildings) {
      const { entrance } = building;
      this.connectToNearestRoad(grid, entrance.col, entrance.row);
    }
  }

  /**
   * Connect a point to the nearest road
   * @param {Array} grid - 2D grid
   * @param {number} startCol
   * @param {number} startRow
   */
  connectToNearestRoad(grid, startCol, startRow) {
    const height = grid.length;
    const width = grid[0].length;

    // Carve path to nearest road (simple straight line)
    const centerCol = Math.floor(width / 2);
    const centerRow = Math.floor(height / 2);

    let current = { col: startCol, row: startRow };

    // Move toward center roads
    while (
      grid[current.row][current.col].terrain.key !== 'road' &&
      grid[current.row][current.col].terrain.key !== 'townSquare'
    ) {
      // Determine direction to move
      const dx = centerCol - current.col;
      const dy = centerRow - current.row;

      // Move horizontally or vertically toward center
      if (Math.abs(dx) > Math.abs(dy) && dx !== 0) {
        current.col += dx > 0 ? 1 : -1;
      } else if (dy !== 0) {
        current.row += dy > 0 ? 1 : -1;
      } else {
        break; // Already at center
      }

      // Bounds check
      if (current.col < 0 || current.col >= width || current.row < 0 || current.row >= height) {
        break;
      }

      // Place road if on grass
      const currentTerrain = grid[current.row][current.col].terrain;
      if (currentTerrain.key === 'grass') {
        grid[current.row][current.col].terrain = this.terrainTypes.road;
      } else if (currentTerrain.key === 'building' || currentTerrain.key === 'fence') {
        // Don't overwrite buildings or fences
        break;
      }
    }
  }

  /**
   * Place town gate (entrance/exit)
   * @param {Array} grid - 2D grid
   */
  placeGate(grid) {
    const height = grid.length;
    const width = grid[0].length;

    // Place gate at bottom center (where main road exits)
    const gateCol = Math.floor(width / 2);
    const gateRow = height - 1;

    grid[gateRow][gateCol].terrain = this.terrainTypes.gate;
    grid[gateRow][gateCol].content = 'entrance';
  }

  /**
   * Find entrance hex
   * @param {Array} grid - 2D grid
   * @returns {object} {col, row}
   */
  findEntrance(grid) {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col].content === 'entrance') {
          return { col, row };
        }
      }
    }

    // Fallback to bottom center
    return { col: Math.floor(grid[0].length / 2), row: grid.length - 1 };
  }

  /**
   * No encounters in towns (override parent method)
   */
  placeEncounters(interiorMap, poi) {
    return [];
  }

  /**
   * No loot in towns (override parent method)
   */
  placeLoot(interiorMap) {
    return [];
  }

  /**
   * No hazards in towns (override parent method)
   */
  placeHazards(interiorMap) {
    return [];
  }
}

export default TownGenerator;
