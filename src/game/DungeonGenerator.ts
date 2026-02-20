// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * DungeonGenerator - Generates complex dungeons using BSP (Binary Space Partitioning)
 * Extends InteriorGenerator base class
 */

import { InteriorGenerator } from './InteriorGenerator';
import { LootGenerator } from './LootGenerator';
import { HazardGenerator } from './HazardGenerator';
import { TreasureGenerator } from './TreasureGenerator';

export class DungeonGenerator extends InteriorGenerator {
  constructor() {
    super();
    this.lootGenerator = new LootGenerator();
    this.hazardGenerator = new HazardGenerator();
  }

  /**
   * Generate a dungeon interior map using BSP algorithm
   * @param {number} width - Map width
   * @param {number} height - Map height
   * @param {number} cr - Challenge rating
   * @returns {object} Interior map data
   */
  generate(width, height, cr) {
    // Generate dungeon layout using BSP
    const { grid, rooms, bossRoom } = this.generateDungeonLayout(width, height, cr);

    // Place entrance in first room
    const entrance = this.placeEntrance(grid, rooms[0]);

    // Convert grid to hex array
    const hexes = this.gridToHexes(grid);

    // Return interior map data structure
    return {
      seed: this.seed,
      poiType: 'dungeon',
      cr,
      width,
      height,
      hexes,
      encounters: [], // Will be populated later
      loot: [], // Will be populated later
      hazards: [], // Will be populated later
      entrance,
      rooms, // Track all rooms for encounter placement
      bossRoom, // Track boss room location
    };
  }

  /**
   * Generate dungeon layout using Binary Space Partitioning
   * @param {number} width
   * @param {number} height
   * @param {number} cr
   * @returns {object} { grid, rooms, bossRoom }
   */
  generateDungeonLayout(width, height, cr) {
    // Initialize grid with walls
    let grid = this.initializeGrid(width, height, this.terrainTypes.wall);

    // Create BSP tree
    const minRoomSize = 4; // Minimum 4x4 rooms
    const rootNode = {
      x: 1,
      y: 1,
      width: width - 2,
      height: height - 2,
      leftChild: null,
      rightChild: null,
      room: null,
    };

    // Recursively partition space (target 5-10 rooms based on CR)
    const targetDepth = Math.min(4, Math.max(2, 2 + Math.floor(cr / 3)));
    this.partitionNode(rootNode, 0, targetDepth, minRoomSize);

    // Create rooms in leaf nodes
    const rooms = [];
    this.createRooms(rootNode, rooms);

    // Carve out rooms
    for (const room of rooms) {
      for (let row = room.y; row < room.y + room.height; row++) {
        for (let col = room.x; col < room.x + room.width; col++) {
          if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
            grid[row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
    }

    // Connect rooms with corridors
    this.connectRooms(grid, rootNode);

    // Last room is boss room
    const bossRoom = rooms[rooms.length - 1];

    return { grid, rooms, bossRoom };
  }

  /**
   * Recursively partition BSP node
   * @param {object} node - BSP node
   * @param {number} depth - Current depth
   * @param {number} maxDepth - Maximum depth
   * @param {number} minRoomSize - Minimum room size
   */
  partitionNode(node, depth, maxDepth, minRoomSize) {
    if (depth >= maxDepth) {
      return; // Stop partitioning
    }

    // Check if node is too small to split
    const canSplitHorizontally = node.height >= minRoomSize * 2;
    const canSplitVertically = node.width >= minRoomSize * 2;

    if (!canSplitHorizontally && !canSplitVertically) {
      return; // Too small to split
    }

    // Decide split direction
    let splitHorizontally;
    if (canSplitHorizontally && !canSplitVertically) {
      splitHorizontally = true;
    } else if (!canSplitHorizontally && canSplitVertically) {
      splitHorizontally = false;
    } else {
      // Both directions possible, choose randomly with bias towards aspect ratio
      splitHorizontally = node.height > node.width ? true : this.random() > 0.5;
    }

    // Perform split
    if (splitHorizontally) {
      const splitPos = this.randomInt(minRoomSize, node.height - minRoomSize);

      node.leftChild = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: splitPos,
        leftChild: null,
        rightChild: null,
        room: null,
      };

      node.rightChild = {
        x: node.x,
        y: node.y + splitPos,
        width: node.width,
        height: node.height - splitPos,
        leftChild: null,
        rightChild: null,
        room: null,
      };
    } else {
      const splitPos = this.randomInt(minRoomSize, node.width - minRoomSize);

      node.leftChild = {
        x: node.x,
        y: node.y,
        width: splitPos,
        height: node.height,
        leftChild: null,
        rightChild: null,
        room: null,
      };

      node.rightChild = {
        x: node.x + splitPos,
        y: node.y,
        width: node.width - splitPos,
        height: node.height,
        leftChild: null,
        rightChild: null,
        room: null,
      };
    }

    // Recursively partition children
    this.partitionNode(node.leftChild, depth + 1, maxDepth, minRoomSize);
    this.partitionNode(node.rightChild, depth + 1, maxDepth, minRoomSize);
  }

  /**
   * Create rooms in leaf nodes of BSP tree
   * @param {object} node - BSP node
   * @param {Array} rooms - Array to collect rooms
   */
  createRooms(node, rooms) {
    if (node.leftChild === null && node.rightChild === null) {
      // Leaf node - create a room
      const roomWidth = this.randomInt(
        Math.max(3, Math.floor(node.width * 0.5)),
        Math.max(3, node.width - 1)
      );
      const roomHeight = this.randomInt(
        Math.max(3, Math.floor(node.height * 0.5)),
        Math.max(3, node.height - 1)
      );

      const roomX = node.x + this.randomInt(0, node.width - roomWidth);
      const roomY = node.y + this.randomInt(0, node.height - roomHeight);

      node.room = {
        x: roomX,
        y: roomY,
        width: roomWidth,
        height: roomHeight,
      };

      rooms.push(node.room);
    } else {
      // Not a leaf - recurse to children
      if (node.leftChild) {
        this.createRooms(node.leftChild, rooms);
      }
      if (node.rightChild) {
        this.createRooms(node.rightChild, rooms);
      }
    }
  }

  /**
   * Connect rooms in BSP tree with corridors
   * @param {Array} grid - 2D grid
   * @param {object} node - BSP node
   */
  connectRooms(grid, node) {
    if (node.leftChild === null && node.rightChild === null) {
      return; // Leaf node, no connections needed
    }

    // Recursively connect children first
    if (node.leftChild) {
      this.connectRooms(grid, node.leftChild);
    }
    if (node.rightChild) {
      this.connectRooms(grid, node.rightChild);
    }

    // Get random rooms from left and right subtrees
    const leftRoom = this.getRandomRoom(node.leftChild);
    const rightRoom = this.getRandomRoom(node.rightChild);

    if (leftRoom && rightRoom) {
      // Connect centers of rooms
      const leftCenter = {
        col: Math.floor(leftRoom.x + leftRoom.width / 2),
        row: Math.floor(leftRoom.y + leftRoom.height / 2),
      };

      const rightCenter = {
        col: Math.floor(rightRoom.x + rightRoom.width / 2),
        row: Math.floor(rightRoom.y + rightRoom.height / 2),
      };

      this.carveDungeonCorridor(grid, leftCenter, rightCenter);
    }
  }

  /**
   * Get a random room from BSP subtree
   * @param {object} node - BSP node
   * @returns {object|null} Room object
   */
  getRandomRoom(node) {
    if (!node) return null;

    if (node.room) {
      return node.room;
    }

    // Randomly choose left or right subtree
    if (this.random() > 0.5 && node.leftChild) {
      return this.getRandomRoom(node.leftChild);
    } else if (node.rightChild) {
      return this.getRandomRoom(node.rightChild);
    } else if (node.leftChild) {
      return this.getRandomRoom(node.leftChild);
    }

    return null;
  }

  /**
   * Carve L-shaped corridor between two points
   * @param {Array} grid
   * @param {object} start - {col, row}
   * @param {object} end - {col, row}
   */
  carveDungeonCorridor(grid, start, end) {
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
   * Place entrance in first room
   * @param {Array} grid
   * @param {object} firstRoom - First room object
   * @returns {object} {col, row} of entrance
   */
  placeEntrance(grid, firstRoom) {
    // Place entrance in center of first room
    const entrance = {
      col: Math.floor(firstRoom.x + firstRoom.width / 2),
      row: Math.floor(firstRoom.y + firstRoom.height / 2),
    };

    // Mark as entrance
    if (
      entrance.row >= 0 &&
      entrance.row < grid.length &&
      entrance.col >= 0 &&
      entrance.col < grid[0].length
    ) {
      grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
      grid[entrance.row][entrance.col].content = 'entrance';
    }

    return entrance;
  }

  /**
   * Place encounters in the dungeon (one per room, boss in last room)
   * @param {object} interiorMap - Interior map data
   * @param {object} poiData - Original POI data
   * @returns {Array} Array of encounter objects
   */
  placeEncounters(interiorMap, poiData) {
    const rooms = interiorMap.rooms;
    const bossRoom = interiorMap.bossRoom;
    const encounters = [];

    // Place one encounter per room (except first room which has entrance)
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];

      // Get center of room
      const centerCol = Math.floor(room.x + room.width / 2);
      const centerRow = Math.floor(room.y + room.height / 2);

      // Find a walkable tile near center
      const roomTiles = interiorMap.hexes.filter(hex => {
        return (
          hex.col >= room.x &&
          hex.col < room.x + room.width &&
          hex.row >= room.y &&
          hex.row < room.y + room.height &&
          hex.terrain.walkable &&
          hex.content === null
        );
      });

      if (roomTiles.length === 0) continue;

      const tile = this.randomChoice(roomTiles);

      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'encounter';
      }

      // Last room has boss encounter
      const isBoss = room === bossRoom;
      const encounterCR = isBoss ? Math.ceil(interiorMap.cr * 1.5) : interiorMap.cr;

      encounters.push({
        col: tile.col,
        row: tile.row,
        cr: encounterCR,
        creatures: isBoss
          ? `Boss: CR ${encounterCR} ${poiData.creatures || 'dungeon lord'}`
          : poiData.creatures || `CR ${encounterCR} enemies`,
        defeated: false,
        discovered: false,
        isBoss: isBoss,
      });
    }

    return encounters;
  }

  /**
   * Place loot in the dungeon (concentrated in later rooms)
   * @param {object} interiorMap - Interior map data
   * @param {number} partySize - Party size for treasure hoard generation
   * @returns {Array} Array of loot objects
   */
  placeLoot(interiorMap, partySize = 4) {
    const cr = interiorMap.cr;
    const rooms = interiorMap.rooms;

    // More loot in dungeons (CR-based, 3-8 pieces)
    const lootCount = Math.max(3, Math.floor(3 + cr * 0.8));

    const treasureGenerator = new TreasureGenerator();
    const loot = [];

    for (let i = 0; i < lootCount; i++) {
      // Bias towards later rooms (60% chance of later half)
      const targetRoomIndex =
        this.random() > 0.4
          ? Math.floor(rooms.length / 2) + this.randomInt(0, Math.floor(rooms.length / 2))
          : this.randomInt(0, Math.floor(rooms.length / 2) - 1);

      const room = rooms[Math.min(targetRoomIndex, rooms.length - 1)];

      const roomTiles = interiorMap.hexes.filter(hex => {
        return (
          hex.col >= room.x &&
          hex.col < room.x + room.width &&
          hex.row >= room.y &&
          hex.row < room.y + room.height &&
          hex.terrain.walkable &&
          hex.content === null
        );
      });

      if (roomTiles.length === 0) continue;

      const tile = this.randomChoice(roomTiles);

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
   * Place hazards in the dungeon (traps in corridors and rooms)
   * @param {object} interiorMap - Interior map data
   * @returns {Array} Array of hazard objects
   */
  placeHazards(interiorMap) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // Dungeons have the most hazards (20-35%)
    const hazardPercentage = 0.2 + this.random() * 0.15;
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
        discovered: false,
      });
    }

    return hazards;
  }
}

export default DungeonGenerator;
