// @ts-nocheck
import { Item } from './Item';
/**
 * StartingCacheGenerator
 *
 * Generates the tiny CR 0 "starting cache" interior — the location where the
 * player wakes up at the very beginning of the game.
 *
 * Layout (3 rooms + corridors):
 *   Room 1 — Wake-up room:  entrance tile + EXIT tile (green) → return to overworld
 *   Room 2 — Stash room:    starter gear loot + optional weapon chest
 *   Room 3 — Flavor room:   a note / campfire remnants / curiosity item
 *
 * Design goals:
 *   - Zero lethal threats (no combat encounters, no damaging hazards)
 *   - Clear signposting: EXIT hex is bright green and labelled
 *   - Starter items give the player immediate agency
 *   - Tiny map so the tutorial beat is short
 */

import { InteriorGenerator } from './InteriorGenerator';
import { STARTING_CACHE } from '../constants/gameConstants';

export class StartingCacheGenerator extends InteriorGenerator {
  constructor() {
    super();
  }

  /**
   * Generate the starting cache interior map.
   * @param {number} width  - Grid width  (default: STARTING_CACHE.WIDTH)
   * @param {number} height - Grid height (default: STARTING_CACHE.HEIGHT)
   * @param {number} cr     - Always 0 for this generator
   * @returns {object} Interior map data
   */
  generate(width = STARTING_CACHE.WIDTH, height = STARTING_CACHE.HEIGHT, cr = 0) {
    const grid = this.initializeGrid(width, height, this.terrainTypes.wall);

    // ── Build three hand-placed rooms ──────────────────────────────────────
    //
    //   [ Room 1: Wake-up ]   [ Room 2: Stash ]   [ Room 3: Flavor ]
    //    (entrance + exit)     (starter loot)       (note / campfire)
    //
    // All rooms are connected with L-shaped corridors carved between them.

    const rooms = this.placeRooms(grid, width, height);

    // Carve corridors between rooms
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = this.roomCenter(rooms[i]);
      const b = this.roomCenter(rooms[i + 1]);
      this.carveCorridor(grid, a, b);
    }

    // ── Place special tiles ────────────────────────────────────────────────
    // Exit in Room 0 (left), spawn entrance in Room 2 (right — far from exit)
    const entrance = this.placeEntranceAndExit(grid, rooms[0], rooms[2]);

    // ── Convert grid to flat hex array ────────────────────────────────────
    const hexes = this.gridToHexes(grid);

    return {
      seed: this.seed,
      poiType: 'starting_cache',
      cr: 0,
      width,
      height,
      hexes,
      rooms,
      entrance,
      encounters: [], // No combat in the starting cache
      loot: [], // Populated by placeLoot()
      hazards: [], // No hazards
    };
  }

  // ── Room placement ───────────────────────────────────────────────────────

  /**
   * Place three rooms deterministically across the grid.
   * Rooms are evenly spaced horizontally with 1-cell wall margins.
   */
  placeRooms(grid, width, height) {
    const rooms = [];

    // Divide the width into 3 equal sections, one room per section.
    const sectionWidth = Math.floor((width - 2) / 3);
    const roomH = Math.min(5, height - 4);

    for (let i = 0; i < 3; i++) {
      const roomW = sectionWidth - 2;
      const roomX = 1 + i * sectionWidth + 1;
      const roomY = Math.floor((height - roomH) / 2);

      const room = { x: roomX, y: roomY, width: roomW, height: roomH };
      rooms.push(room);

      // Carve room floor tiles
      for (let row = roomY; row < roomY + roomH; row++) {
        for (let col = roomX; col < roomX + roomW; col++) {
          if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
            grid[row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
    }

    return rooms;
  }

  /** Return the center coordinate of a room. */
  roomCenter(room) {
    return {
      col: Math.floor(room.x + room.width / 2),
      row: Math.floor(room.y + room.height / 2),
    };
  }

  /**
   * Carve an L-shaped corridor between two points (horizontal then vertical).
   */
  carveCorridor(grid, start, end) {
    // Horizontal leg
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    for (let col = minCol; col <= maxCol; col++) {
      if (start.row >= 0 && start.row < grid.length && col >= 0 && col < grid[0].length) {
        grid[start.row][col].terrain = this.terrainTypes.floor;
      }
    }
    // Vertical leg
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    for (let row = minRow; row <= maxRow; row++) {
      if (row >= 0 && row < grid.length && end.col >= 0 && end.col < grid[0].length) {
        grid[row][end.col].terrain = this.terrainTypes.floor;
      }
    }
  }

  // ── Special tile placement ───────────────────────────────────────────────

  /**
   * Place the EXIT tile in Room 0 and the ENTRANCE (spawn) in Room 2.
   *
   * Room 0  — Exit room:    exit tile at center. Player must walk back here to leave.
   * Room 2  — Wake-up room: entrance tile at center. Player spawns here.
   *
   * This puts maximum distance between spawn and exit so the player must
   * explore all three rooms before they can leave.
   *
   * @param {Array} grid
   * @param {object} exitRoom   - Room 0 (left-most room)
   * @param {object} spawnRoom  - Room 2 (right-most room)
   */
  placeEntranceAndExit(grid, exitRoom, spawnRoom) {
    // Exit tile — center of Room 0
    const exitCy = Math.floor(exitRoom.y + exitRoom.height / 2);
    const exitCol = Math.floor(exitRoom.x + exitRoom.width / 2);
    if (exitCy >= 0 && exitCy < grid.length && exitCol >= 0 && exitCol < grid[0].length) {
      grid[exitCy][exitCol].terrain = this.terrainTypes.exit;
      grid[exitCy][exitCol].content = 'exit';
    }

    // Spawn point — center of Room 2. Just a plain floor tile, no special marker.
    // The starting cache has no "entrance" tile — the player simply wakes up here.
    const entranceCy = Math.floor(spawnRoom.y + spawnRoom.height / 2);
    const entranceCol = Math.floor(spawnRoom.x + spawnRoom.width / 2);

    return { col: entranceCol, row: entranceCy };
  }

  // ── Loot placement ───────────────────────────────────────────────────────

  /**
   * Place starter loot in Room 2 (stash room) and a flavor note in Room 3.
   * Called by useHexInteraction after generate(), same as other generators.
   *
   * @param {object} interiorMap - Generated interior map
   * @returns {Array} Array of loot objects
   */
  placeLoot(interiorMap) {
    const loot = [];
    const { rooms } = interiorMap;

    if (!rooms || rooms.length < 3) return loot;

    // ── Room 2: Gear cache ────────────────────────────────────────────────
    const stashRoom = rooms[1];
    const stashTiles = this.getWalkableTilesInRoom(interiorMap, stashRoom);

    if (stashTiles.length > 0) {
      // Pick random item configs from starter tables
      const itemCount =
        STARTING_CACHE.ITEM_COUNT_MIN +
        Math.floor(
          this.random() * (STARTING_CACHE.ITEM_COUNT_MAX - STARTING_CACHE.ITEM_COUNT_MIN + 1)
        );

      const chosenItemConfigs = this.pickUnique(STARTING_CACHE.STARTER_ITEMS, itemCount);
      const chosenWeaponConfig =
        STARTING_CACHE.STARTER_WEAPONS[
          Math.floor(this.random() * STARTING_CACHE.STARTER_WEAPONS.length)
        ];

      // Build proper Item instances so the Equipment panel doesn't crash
      const itemInstances = [...chosenItemConfigs, chosenWeaponConfig].map(cfg => new Item(cfg));

      // Gold (scattered coins)
      const gold =
        STARTING_CACHE.STARTER_GOLD_MIN +
        Math.floor(
          this.random() * (STARTING_CACHE.STARTER_GOLD_MAX - STARTING_CACHE.STARTER_GOLD_MIN + 1)
        );

      const tile = this.randomChoice(stashTiles);
      if (!tile) return loot;
      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'loot';
      }

      const itemNames = itemInstances.map(i => i.name).join(', ');
      loot.push({
        col: tile.col,
        row: tile.row,
        type: 'loot',
        gold,
        items: itemInstances,
        consumables: [],
        rarity: 'common',
        collected: false,
        discovered: false,
        label: "Traveler's Cache",
        description: `A dusty pile of supplies — ${itemNames}.`,
      });
    }

    // ── Room 3: Flavor note ───────────────────────────────────────────────
    const flavorRoom = rooms[2];
    // Spawn room is also room[2] — pick a tile that isn't the spawn point
    const flavorTiles = this.getWalkableTilesInRoom(interiorMap, flavorRoom);

    if (flavorTiles.length > 0) {
      const note = STARTING_CACHE.NOTES[Math.floor(this.random() * STARTING_CACHE.NOTES.length)];
      const tile = this.randomChoice(flavorTiles);
      if (!tile) return loot;
      const hexIndex = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (hexIndex !== -1) {
        interiorMap.hexes[hexIndex].content = 'loot';
      }

      loot.push({
        col: tile.col,
        row: tile.row,
        type: 'loot',
        gold: 0,
        items: [
          new Item({
            name: 'Tattered Note',
            type: 'quest',
            rarity: 'common',
            description: note,
            weight: 0,
            value: 0,
          }),
        ],
        consumables: [],
        rarity: 'common',
        collected: false,
        discovered: false,
        label: 'Tattered Note',
        description: note,
      });
    }

    return loot;
  }

  /**
   * No hazards in the starting cache — always returns empty array.
   */
  placeHazards(_interiorMap) {
    return [];
  }

  /**
   * No combat encounters in the starting cache — always returns empty array.
   */
  placeEncounters(_interiorMap, _poiData) {
    return [];
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Get all walkable, content-free tiles within a specific room.
   */
  getWalkableTilesInRoom(interiorMap, room) {
    return interiorMap.hexes.filter(
      hex =>
        hex.col >= room.x &&
        hex.col < room.x + room.width &&
        hex.row >= room.y &&
        hex.row < room.y + room.height &&
        hex.terrain.walkable &&
        hex.content === null
    );
  }

  /**
   * Pick `n` unique random elements from an array.
   */
  pickUnique(array, n) {
    const pool = [...array];
    const result = [];
    const count = Math.min(n, pool.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(this.random() * pool.length);
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }
}

export default StartingCacheGenerator;
