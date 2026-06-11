// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * TowerGenerator - Generates vertical tower structures with true per-floor layouts.
 * Each floor is a separate grid generated on demand.
 * Floors are circular rooms with pillars, connected by stair tiles.
 * Extends InteriorGenerator base class.
 */

import { InteriorGenerator } from './InteriorGenerator';
import { LootGenerator } from './LootGenerator';
import { HazardGenerator } from './HazardGenerator';
import { TreasureGenerator } from './TreasureGenerator';

export class TowerGenerator extends InteriorGenerator {
  constructor() {
    super();
    this.lootGenerator = new LootGenerator();
    this.hazardGenerator = new HazardGenerator();

    // Staircase terrain types
    this.terrainTypes.stairsUp = {
      key: 'stairsUp',
      name: 'Stairs Up',
      color: '#6a5a3a',
      walkable: true,
    };

    this.terrainTypes.stairsDown = {
      key: 'stairsDown',
      name: 'Stairs Down',
      color: '#5a4a2a',
      walkable: true,
    };
  }

  /**
   * Generate the ground floor (floor 0) of the tower.
   * Higher floors are generated on demand via generateFloor().
   * @param {number} width - Grid width per floor
   * @param {number} height - Grid height per floor
   * @param {number} cr - Challenge rating
   * @returns {object} Interior map for floor 0
   */
  generate(width, height, cr) {
    // Determine floor count based on CR (3-6 floors)
    const floorCount = Math.min(6, Math.max(3, 3 + Math.floor(cr / 2)));

    // Generate ground floor
    const { grid, stairsUpPos } = this.generateFloorGrid(width, height, cr, 0, floorCount);

    // Entrance = ground-floor exit (player returns here to leave)
    const entrance = this.placeEntranceAndExit(grid, stairsUpPos);

    const hexes = this.gridToHexes(grid);

    return {
      seed: this.seed,
      poiType: 'tower',
      cr,
      width,
      height,
      hexes,
      encounters: [],
      loot: [],
      hazards: [],
      entrance,
      floorCount,
      currentFloor: 0,
      bossFloor: floorCount - 1,
    };
  }

  /**
   * Generate a specific floor of the tower.
   * Called by the stair-transition logic to lazily create higher floors.
   * @param {number} width
   * @param {number} height
   * @param {number} cr
   * @param {number} floorIndex - 0 = ground, floorCount-1 = top
   * @param {number} floorCount - total floors
   * @returns {object} Interior map for this floor
   */
  generateFloor(width, height, cr, floorIndex, floorCount) {
    const { grid, stairsUpPos, stairsDownPos } = this.generateFloorGrid(
      width,
      height,
      cr,
      floorIndex,
      floorCount
    );

    // Spawn point for this floor depends on direction of travel
    // When going UP, spawn at the stairsDown tile of this floor
    // When going DOWN, spawn at the stairsUp tile of the floor below
    // We store both positions in the map so the caller can choose
    const spawnUp = stairsDownPos; // arrived from below
    const spawnDown = stairsUpPos; // arrived from above

    const hexes = this.gridToHexes(grid);
    const floorCR = cr + Math.floor(floorIndex * 1.5);

    const floorMap = {
      seed: `${this.seed}:floor${floorIndex}`,
      poiType: 'tower',
      cr: floorCR,
      width,
      height,
      hexes,
      encounters: [],
      loot: [],
      hazards: [],
      entrance: spawnUp || spawnDown || { col: Math.floor(width / 2), row: Math.floor(height / 2) },
      spawnUp,
      spawnDown,
      floorIndex,
      floorCount,
      bossFloor: floorCount - 1,
    };

    // Place content scaled to this floor's CR
    floorMap.encounters = this.placeEncountersForFloor(floorMap, floorIndex, floorCount);
    floorMap.loot = this.placeLootForFloor(floorMap, floorIndex, floorCount);
    floorMap.hazards = this.placeHazardsForFloor(floorMap);

    return floorMap;
  }

  /**
   * Build the raw 2D grid for a single tower floor.
   * Returns the grid and positions of stair tiles placed.
   */
  generateFloorGrid(width, height, cr, floorIndex, floorCount) {
    const grid = this.initializeGrid(width, height, this.terrainTypes.wall);

    // Circular room — radius shrinks slightly on upper floors
    const sizeModifier = Math.max(0.6, 1 - floorIndex * 0.08);
    const radius = Math.floor((Math.min(width, height) / 2 - 1) * sizeModifier);
    const centerCol = Math.floor(width / 2);
    const centerRow = Math.floor(height / 2);

    // Carve circular floor
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const dx = col - centerCol;
        const dy = row - centerRow;
        if (Math.sqrt(dx * dx + dy * dy) <= radius) {
          grid[row][col].terrain = this.terrainTypes.floor;
        }
      }
    }

    // Pillars (15% of interior floor tiles)
    this.addPillars(grid, 0.15);

    let stairsUpPos = null;
    let stairsDownPos = null;

    // Stairs DOWN (back to previous floor) — west side of room
    if (floorIndex > 0) {
      const preferredCol = Math.max(1, centerCol - Math.floor(radius * 0.55));
      stairsDownPos = this._placeStairTile(
        grid,
        width,
        height,
        preferredCol,
        centerRow,
        this.terrainTypes.stairsDown,
        'stairsDown',
        floorIndex - 1
      );
    }

    // Stairs UP (advance to next floor) — east side of room
    if (floorIndex < floorCount - 1) {
      const preferredCol = Math.min(width - 2, centerCol + Math.floor(radius * 0.55));
      stairsUpPos = this._placeStairTile(
        grid,
        width,
        height,
        preferredCol,
        centerRow,
        this.terrainTypes.stairsUp,
        'stairsUp',
        floorIndex + 1
      );
    }

    return { grid, stairsUpPos, stairsDownPos };
  }

  /**
   * Place a single stair tile at the preferred position, falling back to the
   * nearest free floor tile (by Manhattan distance) if the preferred spot is
   * occupied or is a wall.
   *
   * @param {Array}  grid
   * @param {number} width
   * @param {number} height
   * @param {number} preferredCol
   * @param {number} preferredRow
   * @param {object} terrainType   - stairsUp or stairsDown terrain object
   * @param {string} contentKey    - 'stairsUp' or 'stairsDown'
   * @param {number} connectedFloor
   * @returns {{ col, row } | null}
   */
  _placeStairTile(
    grid,
    width,
    height,
    preferredCol,
    preferredRow,
    terrainType,
    contentKey,
    connectedFloor
  ) {
    // Collect all free floor tiles on this grid, ordered by distance from preferred spot
    const candidates = [];
    for (let row = 1; row < height - 1; row++) {
      for (let col = 1; col < width - 1; col++) {
        if (grid[row][col].terrain.key === 'floor' && !grid[row][col].content) {
          candidates.push({
            col,
            row,
            d: Math.abs(col - preferredCol) + Math.abs(row - preferredRow),
          });
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.d - b.d);

    const { col, row } = candidates[0];
    grid[row][col].terrain = terrainType;
    grid[row][col].content = contentKey;
    grid[row][col].connectedFloor = connectedFloor;
    return { col, row };
  }

  /**
   * Place entrance + exit on the ground floor.
   * The entrance is on the opposite side from the stairs up.
   * Returns the entrance position.
   */
  placeEntranceAndExit(grid, stairsUpPos) {
    const height = grid.length;
    const width = grid[0].length;

    // Find walkable tiles that are not stairs and not the center
    const candidates = [];
    for (let row = 1; row < height - 1; row++) {
      for (let col = 1; col < width - 1; col++) {
        if (grid[row][col].terrain.key === 'floor' && !grid[row][col].content) {
          // Prefer west half (far from stairsUp which is east)
          if (!stairsUpPos || col <= Math.floor(width / 2)) {
            candidates.push({ col, row });
          }
        }
      }
    }

    // Fallback to any walkable tile
    if (candidates.length === 0) {
      for (let row = 1; row < height - 1; row++) {
        for (let col = 1; col < width - 1; col++) {
          if (grid[row][col].terrain.key === 'floor') candidates.push({ col, row });
        }
      }
    }

    const entrance =
      candidates.length > 0
        ? this.randomChoice(candidates)
        : { col: Math.floor(width / 2), row: Math.floor(height / 2) };

    // Mark as entrance AND exit — player returns here to leave the tower
    grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
    grid[entrance.row][entrance.col].content = 'exit';

    return entrance;
  }

  /**
   * Add pillars to a single floor grid.
   */
  addPillars(grid, percentage) {
    const floorTiles = [];
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col].terrain.key === 'floor' && !grid[row][col].content) {
          floorTiles.push({ col, row });
        }
      }
    }

    const pillarCount = Math.floor(floorTiles.length * percentage);
    for (let i = 0; i < pillarCount; i++) {
      const tile = this.randomChoice(floorTiles);
      if (!tile) break;
      floorTiles.splice(floorTiles.indexOf(tile), 1);
      grid[tile.row][tile.col].terrain = this.terrainTypes.wall;
    }
  }

  // ── placeEncounters / placeLoot / placeHazards (whole-map versions) ────────
  // Used for the ground floor via the standard pipeline in useHexInteraction

  placeEncounters(interiorMap, poiData) {
    return this.placeEncountersForFloor(interiorMap, 0, interiorMap.floorCount, poiData);
  }

  placeLoot(interiorMap, partySize = 4) {
    return this.placeLootForFloor(interiorMap, 0, interiorMap.floorCount, partySize);
  }

  placeHazards(interiorMap) {
    return this.placeHazardsForFloor(interiorMap);
  }

  // ── Per-floor content placement ────────────────────────────────────────────

  placeEncountersForFloor(interiorMap, floorIndex, floorCount, poiData = {}) {
    const floorTiles = interiorMap.hexes.filter(h => h.terrain.walkable && h.content === null);
    const cr = interiorMap.cr;
    const isBossFloor = floorIndex === floorCount - 1;
    const encounterCount = isBossFloor ? 1 : cr >= 5 ? 2 : 1;
    const encounters = [];

    for (let i = 0; i < encounterCount && floorTiles.length > 0; i++) {
      const entrance = interiorMap.entrance;
      const farTiles = floorTiles.filter(
        t => this.getHexDistance(t.col, t.row, entrance.col, entrance.row) >= 3
      );
      const tile =
        farTiles.length > 0 ? this.randomChoice(farTiles) : this.randomChoice(floorTiles);
      floorTiles.splice(floorTiles.indexOf(tile), 1);

      const idx = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (idx !== -1) interiorMap.hexes[idx].content = 'encounter';

      const encounterCR = isBossFloor ? Math.ceil(cr * 1.5) : cr;
      encounters.push({
        col: tile.col,
        row: tile.row,
        floor: floorIndex,
        cr: encounterCR,
        creatures: isBossFloor
          ? `Boss: CR ${encounterCR} ${poiData.creatures || 'guardian'}`
          : poiData.creatures || `CR ${encounterCR} enemies`,
        defeated: false,
        discovered: false,
        isBoss: isBossFloor,
      });
    }
    return encounters;
  }

  placeLootForFloor(interiorMap, floorIndex, floorCount, partySize = 4) {
    const floorTiles = interiorMap.hexes.filter(h => h.terrain.walkable && h.content === null);
    const cr = interiorMap.cr;
    // More loot on higher floors
    const lootCount = Math.max(1, Math.floor(1 + cr * 0.5 + floorIndex * 0.5));
    const treasureGenerator = new TreasureGenerator();
    const loot = [];

    for (let i = 0; i < lootCount && floorTiles.length > 0; i++) {
      const tile = this.randomChoice(floorTiles);
      floorTiles.splice(floorTiles.indexOf(tile), 1);

      const isChest = this.random() < 0.3 || floorIndex === floorCount - 1;
      let lootData;
      if (isChest) {
        lootData = treasureGenerator.generateTreasureHoard(cr, partySize, () => this.random());
      } else {
        lootData = this.lootGenerator.generateLoot(cr, () => this.random());
      }

      const idx = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (idx !== -1) interiorMap.hexes[idx].content = isChest ? 'chest' : 'loot';

      loot.push({
        col: tile.col,
        row: tile.row,
        floor: floorIndex,
        type: isChest ? 'chest' : 'loot',
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

  placeHazardsForFloor(interiorMap) {
    const floorTiles = interiorMap.hexes.filter(h => h.terrain.walkable && h.content === null);
    const cr = interiorMap.cr;
    const hazardPercentage = 0.08 + this.random() * 0.1;
    const hazardCount = Math.floor(floorTiles.length * hazardPercentage);
    const hazards = [];

    for (let i = 0; i < hazardCount && floorTiles.length > 0; i++) {
      const tile = this.randomChoice(floorTiles);
      floorTiles.splice(floorTiles.indexOf(tile), 1);

      const idx = interiorMap.hexes.findIndex(h => h.col === tile.col && h.row === tile.row);
      if (idx !== -1) interiorMap.hexes[idx].content = 'hazard';

      hazards.push({
        col: tile.col,
        row: tile.row,
        ...this.hazardGenerator.generateHazard(cr, () => this.random()),
        triggered: false,
        discovered: false,
      });
    }
    return hazards;
  }
}

export default TowerGenerator;
