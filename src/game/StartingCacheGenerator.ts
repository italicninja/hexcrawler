// @ts-nocheck
import { Item } from './Item';
/**
 * StartingCacheGenerator
 *
 * Generates the tiny CR 0 "starting cache" interior — the location where the
 * player wakes up at the very beginning of the game.
 *
 * Layout (3 rooms + corridors):
 *   Room 1 — Wake-up room:  entrance tile + ladder (exit) → return to overworld
 *   Room 2 — Stash room:    starter gear loot + optional weapon chest
 *   Room 3 — Flavor room:   a note / campfire remnants / curiosity item
 *
 * Design goals:
 *   - Zero lethal threats (no combat encounters, no damaging hazards)
 *   - Clear signposting: EXIT hex shows a climbable ladder
 *   - Starter items give the player immediate agency
 *   - Tiny map so the tutorial beat is short
 */

import { InteriorGenerator } from './InteriorGenerator';
import { STARTING_CACHE, GAME_DEFAULTS } from '../constants/gameConstants';
import { getHexDistance } from '../utils/hexMath';

// Settlement POI types that count as "a place to head to"
const SETTLEMENT_TYPES = new Set(['camp', 'village', 'town', 'city', 'metropolis']);

/**
 * Given a delta (target - origin) in offset-grid col/row space, return the
 * nearest cardinal/intercardinal compass direction as a lowercase string.
 */
function getCompassDirection(dCol, dRow) {
  // In an offset hex grid, increasing row goes DOWN on screen (south),
  // increasing col goes RIGHT (east).  We treat dRow as the N/S axis and
  // dCol as the E/W axis, then snap to the 8 compass points.
  const angle = Math.atan2(dRow, dCol) * (180 / Math.PI); // –180 … +180
  // Rotate so that 0° = East, positive = clockwise
  const dirs = [
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
    'north',
    'northeast',
  ];
  const index = Math.round((((angle % 360) + 360) % 360) / 45) % 8;
  return dirs[index];
}

/**
 * Build a natural-language travel-time string from a hex distance.
 * 1 hex = 1 game-day of travel (per TIME.TRAVEL_TIME_PER_HEX_MINUTES × 48 = 1 440 min).
 */
function formatTravelTime(hexDistance) {
  const days = Math.round(hexDistance);
  if (days <= 0) return "less than a day's walk";
  if (days === 1) return "a day's walk";
  return `${days} days' walk`;
}

/**
 * Find the nearest settlement hex to the starting position.
 * Returns { name, col, row, distance, direction } or null if none found.
 */
function findNearestSettlement(worldHexes, startCol, startRow) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const hex of worldHexes) {
    if (!hex.poi || !SETTLEMENT_TYPES.has(hex.poi.type)) continue;
    // Skip the starting cache itself
    if (hex.col === startCol && hex.row === startRow) continue;

    const dist = getHexDistance(startCol, startRow, hex.col, hex.row);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = hex;
    }
  }

  if (!nearest) return null;

  return {
    name: nearest.poi.name,
    col: nearest.col,
    row: nearest.row,
    distance: nearestDist,
    direction: getCompassDirection(nearest.col - startCol, nearest.row - startRow),
  };
}

/**
 * Build the dynamic survival note text using real world data.
 * Falls back to a vague version if no settlement is found.
 */
function buildSurvivalNote(worldHexes, startCol, startRow) {
  const settlement = findNearestSettlement(worldHexes, startCol, startRow);

  if (!settlement) {
    return 'A scrawled note reads: "If you\'re reading this, you survived the ambush. Keep moving — find the nearest settlement. Stay off the main road."';
  }

  const travelTime = formatTravelTime(settlement.distance);
  return (
    `A scrawled note reads: "If you're reading this, you survived the ambush. ` +
    `Head ${settlement.direction} — there's ${settlement.name} ${travelTime}. ` +
    `Stay off the main road."`
  );
}

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
   * Place 1–2 guaranteed treasures in the stash room (Room 1) plus a flavor note
   * in the spawn room (Room 2).
   *
   * Treasure layout:
   *   Chest 1 — Weapon cache:  starter weapon + 1–2 misc items  (always present)
   *   Chest 2 — Coin pouch:    gold + 1–2 remaining misc items  (always present, different tile)
   *   Note    — Flavor lore:   tattered note in the spawn room
   *
   * Having two physical pickups gives the player a reason to explore both the
   * stash room and the spawn room before leaving.
   *
   * @param {object} interiorMap  - Generated interior map
   * @param {Array}  worldHexes   - Full overworld hex array (used to find nearest settlement)
   * @param {number} startCol     - Player starting col on overworld (default from GAME_DEFAULTS)
   * @param {number} startRow     - Player starting row on overworld (default from GAME_DEFAULTS)
   * @returns {Array} Array of loot objects
   */
  placeLoot(
    interiorMap,
    worldHexes: any[] = [],
    startCol = GAME_DEFAULTS.START_POSITION.col,
    startRow = GAME_DEFAULTS.START_POSITION.row
  ) {
    const loot = [];
    const { rooms } = interiorMap;

    if (!rooms || rooms.length < 3) return loot;

    // ── Room 1 (index 1): Stash room — two separate treasure pickups ──────
    const stashRoom = rooms[1];
    const stashTiles = this.getWalkableTilesInRoom(interiorMap, stashRoom);

    if (stashTiles.length > 0) {
      // Choose a random starter weapon
      const chosenWeaponConfig =
        STARTING_CACHE.STARTER_WEAPONS[
          Math.floor(this.random() * STARTING_CACHE.STARTER_WEAPONS.length)
        ];

      // Split misc items into two groups so each chest is distinct
      const totalMiscCount =
        STARTING_CACHE.ITEM_COUNT_MIN +
        Math.floor(
          this.random() * (STARTING_CACHE.ITEM_COUNT_MAX - STARTING_CACHE.ITEM_COUNT_MIN + 1)
        );
      const allMiscConfigs = this.pickUnique(STARTING_CACHE.STARTER_ITEMS, totalMiscCount);
      const splitAt = Math.max(1, Math.ceil(allMiscConfigs.length / 2));
      const miscForWeaponChest = allMiscConfigs.slice(0, splitAt);
      const miscForCoinPouch = allMiscConfigs.slice(splitAt);

      // Gold split between the two chests (total stays the same)
      const totalGold =
        STARTING_CACHE.STARTER_GOLD_MIN +
        Math.floor(
          this.random() * (STARTING_CACHE.STARTER_GOLD_MAX - STARTING_CACHE.STARTER_GOLD_MIN + 1)
        );
      const goldInPouch = Math.floor(totalGold * (0.5 + this.random() * 0.4)); // 50–90% in pouch
      const goldInCache = totalGold - goldInPouch;

      // ── Chest 1: Weapon cache ───────────────────────────────────────────
      const weaponItems = [chosenWeaponConfig, ...miscForWeaponChest].map(cfg => new Item(cfg));
      // Pick a tile near the far edge of the stash room (not the corridor end)
      // so the chest isn't immediately adjacent to the entrance corridor.
      const tile1 = this.randomChoice(stashTiles);
      if (tile1) {
        const idx1 = interiorMap.hexes.findIndex(h => h.col === tile1.col && h.row === tile1.row);
        if (idx1 !== -1) {
          interiorMap.hexes[idx1].content = 'chest';
        }

        // Remove used tile so Chest 2 lands on a different hex
        stashTiles.splice(stashTiles.indexOf(tile1), 1);

        const itemNames1 = weaponItems.map(i => i.name).join(', ');
        loot.push({
          col: tile1.col,
          row: tile1.row,
          type: 'chest',
          gold: goldInCache,
          items: weaponItems,
          consumables: [],
          rarity: 'common',
          collected: false,
          discovered: true, // always visible — no reason to hide starting gear
          label: "Traveler's Weapon Cache",
          description: `A worn pack containing ${itemNames1}.`,
        });
      }

      // ── Chest 2: Coin pouch + supplies ─────────────────────────────────
      if (stashTiles.length > 0) {
        const coinItems = miscForCoinPouch.map(cfg => new Item(cfg));
        const tile2 = this.randomChoice(stashTiles);
        if (tile2) {
          const idx2 = interiorMap.hexes.findIndex(h => h.col === tile2.col && h.row === tile2.row);
          if (idx2 !== -1) {
            interiorMap.hexes[idx2].content = 'chest';
          }

          const desc2 =
            coinItems.length > 0
              ? `A coin pouch with ${goldInPouch} gold and ${coinItems.map(i => i.name).join(', ')}.`
              : `A coin pouch with ${goldInPouch} gold.`;

          loot.push({
            col: tile2.col,
            row: tile2.row,
            type: 'chest',
            gold: goldInPouch,
            items: coinItems,
            consumables: [],
            rarity: 'common',
            collected: false,
            discovered: true, // always visible — starting cache contents are in plain sight
            label: 'Coin Pouch & Supplies',
            description: desc2,
          });
        }
      }
    }

    // ── Room 2 (index 2): Spawn room — flavor notes ───────────────────────
    //
    // Two notes are placed here:
    //   1. A dynamic survival note — always generated with real world data
    //      (nearest settlement name, true direction, and actual travel distance).
    //   2. A random flavor note from STARTING_CACHE.NOTES (atmosphere / lore).
    //
    // The dynamic note is always present so its world-specific claims are
    // guaranteed to be accurate for every map seed.
    const flavorRoom = rooms[2];
    const flavorTiles = this.getWalkableTilesInRoom(interiorMap, flavorRoom);

    if (flavorTiles.length > 0) {
      // ── Note 1: Dynamic survival note (always accurate) ─────────────────
      const survivalNote = buildSurvivalNote(worldHexes, startCol, startRow);
      const tile1 = this.randomChoice(flavorTiles);

      if (tile1) {
        const hexIndex1 = interiorMap.hexes.findIndex(
          h => h.col === tile1.col && h.row === tile1.row
        );
        if (hexIndex1 !== -1) interiorMap.hexes[hexIndex1].content = 'loot';

        loot.push({
          col: tile1.col,
          row: tile1.row,
          type: 'loot',
          gold: 0,
          items: [
            new Item({
              name: 'Tattered Note',
              type: 'quest',
              rarity: 'common',
              description: survivalNote,
              weight: 0,
              value: 0,
            }),
          ],
          consumables: [],
          rarity: 'common',
          collected: false,
          discovered: true, // note is visible on the ground from spawn
          label: 'Tattered Note',
          description: survivalNote,
        });

        // Remove used tile so Note 2 lands on a different hex (if space allows)
        flavorTiles.splice(flavorTiles.indexOf(tile1), 1);
      }

      // ── Note 2: Random flavor note (atmosphere / lore) ──────────────────
      if (flavorTiles.length > 0 && STARTING_CACHE.NOTES.length > 0) {
        const flavorNote =
          STARTING_CACHE.NOTES[Math.floor(this.random() * STARTING_CACHE.NOTES.length)];
        const tile2 = this.randomChoice(flavorTiles);

        if (tile2) {
          const hexIndex2 = interiorMap.hexes.findIndex(
            h => h.col === tile2.col && h.row === tile2.row
          );
          if (hexIndex2 !== -1) interiorMap.hexes[hexIndex2].content = 'loot';

          loot.push({
            col: tile2.col,
            row: tile2.row,
            type: 'loot',
            gold: 0,
            items: [
              new Item({
                name: 'Tattered Note',
                type: 'quest',
                rarity: 'common',
                description: flavorNote,
                weight: 0,
                value: 0,
              }),
            ],
            consumables: [],
            rarity: 'common',
            collected: false,
            discovered: true,
            label: 'Tattered Note',
            description: flavorNote,
          });
        }
      }
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
