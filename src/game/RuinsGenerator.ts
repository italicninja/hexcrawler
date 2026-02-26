// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * RuinsGenerator - Generates ancient ruins with room-based layouts and crumbling walls
 * Extends InteriorGenerator base class
 */

import { InteriorGenerator } from './InteriorGenerator';
import { LootGenerator } from './LootGenerator';
import { HazardGenerator } from './HazardGenerator';
import { TreasureGenerator } from './TreasureGenerator';
import logger from '../utils/logger';

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
      walkable: true,
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
      entrance,
    };
  }

  /**
   * Generate ruins layout with room-based generation.
   * Creates 4-8 rooms connected by corridors with crumbling walls.
   * Guarantees full connectivity via flood-fill after carving.
   * @param {number} width
   * @param {number} height
   * @param {number} cr - Challenge rating affects room count and density
   * @returns {Array} 2D grid
   */
  generateRuinsLayout(width, height, cr) {
    // Initialize grid with walls
    let grid = this.initializeGrid(width, height, this.terrainTypes.wall);

    // More rooms at higher CR (4-8 rooms)
    const roomCount = Math.min(8, Math.max(4, 4 + Math.floor(cr / 2)));

    logger.mapgen.info('Generating ruins', { width, height, cr, roomCount });

    // ── Room placement ───────────────────────────────────────────────────────
    const rooms = [];
    // More attempts so we actually fill the space
    const maxAttempts = 300;
    let attempts = 0;

    while (rooms.length < roomCount && attempts < maxAttempts) {
      attempts++;

      // Rooms range from 3×3 up to 6×6 — larger so there's real space to explore
      const roomWidth = this.randomInt(3, Math.min(6, Math.floor(width / 3)));
      const roomHeight = this.randomInt(3, Math.min(6, Math.floor(height / 3)));

      const maxCol = width - roomWidth - 1;
      const maxRow = height - roomHeight - 1;

      if (maxCol < 1 || maxRow < 1) break;

      const roomCol = this.randomInt(1, maxCol);
      const roomRow = this.randomInt(1, maxRow);

      // Tighter buffer = rooms are allowed to share wall tiles (gives ruin feel)
      const buffer = 1;
      const overlaps = rooms.some(
        room =>
          !(
            roomCol + roomWidth + buffer <= room.col ||
            roomCol >= room.col + room.width + buffer ||
            roomRow + roomHeight + buffer <= room.row ||
            roomRow >= room.row + room.height + buffer
          )
      );

      if (!overlaps) {
        rooms.push({ col: roomCol, row: roomRow, width: roomWidth, height: roomHeight });
      }
    }

    logger.mapgen.info('Generated rooms', { roomCount: rooms.length, attempts });

    // Failsafe — guarantee at least 2 rooms for a meaningful layout
    if (rooms.length === 0) {
      const fw = Math.min(5, Math.floor(width / 2));
      const fh = Math.min(5, Math.floor(height / 2));
      rooms.push({
        col: Math.floor((width - fw) / 2),
        row: Math.floor((height - fh) / 2),
        width: fw,
        height: fh,
      });
    }
    if (rooms.length === 1) {
      // Add a second room offset from the first
      const r = rooms[0];
      const col2 = Math.min(width - 4, r.col + r.width + 2);
      const row2 = Math.min(height - 4, r.row + r.height + 2);
      rooms.push({
        col: col2,
        row: row2,
        width: Math.min(4, width - col2 - 1),
        height: Math.min(4, height - row2 - 1),
      });
    }

    // ── Carve rooms ──────────────────────────────────────────────────────────
    for (const room of rooms) {
      for (let row = room.row; row < room.row + room.height; row++) {
        for (let col = room.col; col < room.col + room.width; col++) {
          if (row > 0 && row < height - 1 && col > 0 && col < width - 1) {
            grid[row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
    }

    // ── Connect every room in sequence (chain guarantees connectivity) ───────
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i];
      const b = rooms[i + 1];
      this.carveRuinsCorridor(
        grid,
        { col: Math.floor(a.col + a.width / 2), row: Math.floor(a.row + a.height / 2) },
        { col: Math.floor(b.col + b.width / 2), row: Math.floor(b.row + b.height / 2) }
      );
    }

    // ── Extra loops for complexity (skip degenerate 1-room case) ────────────
    if (rooms.length >= 3) {
      const extraConnections = Math.floor(rooms.length / 2);
      for (let i = 0; i < extraConnections; i++) {
        const a = this.randomChoice(rooms);
        const b = this.randomChoice(rooms);
        if (a !== b) {
          this.carveRuinsCorridor(
            grid,
            { col: Math.floor(a.col + a.width / 2), row: Math.floor(a.row + a.height / 2) },
            { col: Math.floor(b.col + b.width / 2), row: Math.floor(b.row + b.height / 2) }
          );
        }
      }
    }

    // ── Flood-fill connectivity guarantee ────────────────────────────────────
    // Find the largest connected region and carve straight paths to orphans
    const allFloor = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (grid[row][col].terrain.walkable) allFloor.push({ col, row });
      }
    }
    if (allFloor.length > 0) {
      const seed = allFloor[0];
      const connected = this.floodFill(grid, seed.col, seed.row, h => h.terrain.walkable);
      const orphans = allFloor.filter(t => !connected.has(`${t.col},${t.row}`));
      for (const orphan of orphans) {
        // Carve direct line from orphan to seed
        let cur = { ...orphan };
        while (cur.col !== seed.col || cur.row !== seed.row) {
          if (cur.row > 0 && cur.row < height - 1 && cur.col > 0 && cur.col < width - 1) {
            grid[cur.row][cur.col].terrain = this.terrainTypes.floor;
          }
          const dx = seed.col - cur.col;
          const dy = seed.row - cur.row;
          if (Math.abs(dx) >= Math.abs(dy)) cur.col += dx > 0 ? 1 : -1;
          else cur.row += dy > 0 ? 1 : -1;
        }
      }
    }

    // ── Rubble and chasms — scale with CR, light at low CR ──────────────────
    const rubbleMin = Math.min(0.05 + cr * 0.01, 0.12);
    const rubbleMax = Math.min(0.12 + cr * 0.01, 0.2);
    const chasmMin = Math.min(0.01 + cr * 0.003, 0.03);
    const chasmMax = Math.min(0.02 + cr * 0.005, 0.05);
    this.addRubble(grid, rubbleMin, rubbleMax);
    this.addChasms(grid, chasmMin, chasmMax);

    // ── Re-run connectivity after chasms (chasms are non-walkable) ───────────
    // Chasms can cut off regions that were connected before, so we heal any new
    // orphans by carving floor paths — same technique as the first pass above.
    const allFloor2 = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (grid[row][col].terrain.walkable) allFloor2.push({ col, row });
      }
    }
    if (allFloor2.length > 0) {
      const seed2 = allFloor2[0];
      const connected2 = this.floodFill(grid, seed2.col, seed2.row, h => h.terrain.walkable);
      const orphans2 = allFloor2.filter(t => !connected2.has(`${t.col},${t.row}`));
      for (const orphan of orphans2) {
        let cur = { ...orphan };
        while (cur.col !== seed2.col || cur.row !== seed2.row) {
          if (cur.row > 0 && cur.row < height - 1 && cur.col > 0 && cur.col < width - 1) {
            // Only carve through walls/chasms — don't downgrade rubble
            if (!grid[cur.row][cur.col].terrain.walkable) {
              grid[cur.row][cur.col].terrain = this.terrainTypes.floor;
            }
          }
          const dx = seed2.col - cur.col;
          const dy = seed2.row - cur.row;
          if (Math.abs(dx) >= Math.abs(dy)) cur.col += dx > 0 ? 1 : -1;
          else cur.row += dy > 0 ? 1 : -1;
        }
      }
    }

    // Store rooms for entrance placement
    this._rooms = rooms;

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
   * Place entrance hex at the edge tile of the first (smallest col) room.
   * Falls back to any walkable edge tile, then any walkable tile, then the
   * centre of the grid as an absolute last resort.
   *
   * Crucially, after the entrance tile is chosen we ALWAYS carve a straight
   * corridor from it to the nearest existing floor tile so the player is
   * never left standing in an isolated cell surrounded by walls.
   *
   * @param {Array} grid
   * @returns {object} {col, row} of entrance
   */
  placeEntrance(grid) {
    const height = grid.length;
    const width = grid[0].length;

    let entrance = null;

    // ── 1. Prefer the top-row of the top-left room ───────────────────────────
    if (this._rooms && this._rooms.length > 0) {
      const sorted = [...this._rooms].sort((a, b) => a.row - b.row || a.col - b.col);
      const firstRoom = sorted[0];

      for (let col = firstRoom.col; col < firstRoom.col + firstRoom.width; col++) {
        const row = firstRoom.row;
        if (
          row > 0 &&
          row < height - 1 &&
          col > 0 &&
          col < width - 1 &&
          grid[row][col].terrain.walkable
        ) {
          entrance = { col, row };
          break;
        }
      }

      // ── 2. Fallback: centre of first room ──────────────────────────────────
      if (!entrance) {
        const fc = Math.floor(firstRoom.col + firstRoom.width / 2);
        const fr = Math.floor(firstRoom.row + firstRoom.height / 2);
        if (grid[fr] && grid[fr][fc] && grid[fr][fc].terrain.walkable) {
          entrance = { col: fc, row: fr };
        }
      }
    }

    // ── 3. Generic edge-scan fallback ────────────────────────────────────────
    if (!entrance) {
      const candidates = [];
      for (let col = 1; col < width - 1; col++) {
        if (grid[1][col].terrain.walkable) candidates.push({ col, row: 1 });
        if (grid[height - 2][col].terrain.walkable) candidates.push({ col, row: height - 2 });
      }
      for (let row = 1; row < height - 1; row++) {
        if (grid[row][1].terrain.walkable) candidates.push({ col: 1, row });
        if (grid[row][width - 2].terrain.walkable) candidates.push({ col: width - 2, row });
      }
      if (candidates.length > 0) entrance = this.randomChoice(candidates);
    }

    // ── 4. Any walkable tile at all ──────────────────────────────────────────
    if (!entrance) {
      const walkable = this.getWalkableTiles(grid);
      if (walkable.length > 0) entrance = this.randomChoice(walkable);
    }

    // ── 5. Absolute last resort — grid centre (will be carved in below) ──────
    if (!entrance) {
      entrance = { col: Math.floor(width / 2), row: Math.floor(height / 2) };
    }

    // ── Stamp the entrance tile ───────────────────────────────────────────────
    grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
    grid[entrance.row][entrance.col].content = 'exit';

    // ── Connectivity guarantee ────────────────────────────────────────────────
    // Carve a straight path from the entrance to the nearest existing floor/rubble
    // tile so the player is never isolated in an island of walls, even if chasms
    // consumed the whole first room before this method was called.
    const allFloor = [];
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const t = grid[r][c].terrain;
        if (t.walkable && !(r === entrance.row && c === entrance.col)) {
          allFloor.push({ col: c, row: r });
        }
      }
    }

    if (allFloor.length > 0) {
      // Find the nearest floor tile to the entrance (Manhattan distance)
      allFloor.sort(
        (a, b) =>
          Math.abs(a.col - entrance.col) +
          Math.abs(a.row - entrance.row) -
          (Math.abs(b.col - entrance.col) + Math.abs(b.row - entrance.row))
      );
      const target = allFloor[0];

      // Walk a straight (axis-aligned) path and carve through any walls/chasms
      let cur = { col: entrance.col, row: entrance.row };
      while (cur.col !== target.col || cur.row !== target.row) {
        const dx = target.col - cur.col;
        const dy = target.row - cur.row;
        if (Math.abs(dx) >= Math.abs(dy)) {
          cur = { col: cur.col + (dx > 0 ? 1 : -1), row: cur.row };
        } else {
          cur = { col: cur.col, row: cur.row + (dy > 0 ? 1 : -1) };
        }
        // Only carve non-walkable tiles (don't downgrade rubble or existing floor)
        if (
          cur.row > 0 &&
          cur.row < height - 1 &&
          cur.col > 0 &&
          cur.col < width - 1 &&
          !grid[cur.row][cur.col].terrain.walkable
        ) {
          grid[cur.row][cur.col].terrain = this.terrainTypes.floor;
        }
      }
    }

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

      const tile =
        farTiles.length > 0 ? this.randomChoice(farTiles) : this.randomChoice(floorTiles);

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
        defeated: false,
        discovered: false,
      });
    }

    return encounters;
  }

  /**
   * Place loot in the ruins (ancient treasures)
   * @param {object} interiorMap - Interior map data
   * @param {number} partySize - Party size for treasure hoard generation
   * @returns {Array} Array of loot objects
   */
  placeLoot(interiorMap, partySize = 4) {
    const floorTiles = interiorMap.hexes.filter(
      hex => hex.terrain.walkable && hex.content === null
    );

    const cr = interiorMap.cr;

    // Ruins have more loot than caves (ancient treasures)
    const lootCount = Math.max(3, Math.floor(3 + cr * 0.6));

    const treasureGenerator = new TreasureGenerator();
    const loot = [];

    for (let i = 0; i < lootCount && floorTiles.length > 0; i++) {
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
        ...generatedHazard,
        triggered: false,
        discovered: false,
      });
    }

    return hazards;
  }
}

export default RuinsGenerator;
