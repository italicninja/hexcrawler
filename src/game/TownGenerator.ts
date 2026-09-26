/**
 * TownGenerator - walkable settlement interiors (camp → metropolis).
 *
 * Layout is street-first on the odd-r hex grid:
 *   - a two-hex-wide avenue runs north from the gate at the bottom edge
 *   - east–west streets cross it every 4 rows (street, 2 building rows, 1 yard row)
 *   - the street nearest the middle gets a plaza with a well/campfire and the quest board
 *   - buildings sit in lots on the north side of each street, 1-hex alleys between them,
 *     with a doorstep tile on the street directly below the facade (the 3/4 view shows
 *     south faces, so every door faces south onto a street)
 *
 * Building tiles are solid; the doorstep is the walkable, interactive tile.
 */

import { InteriorGenerator } from './InteriorGenerator';
import type { InteriorGrid, InteriorHex, HexCoord, TerrainType } from './InteriorGenerator';
import logger from '../utils/logger';

/** Settlement metadata passed into generate(). */
interface TownData {
  name?: string;
  settlementSize?: string;
  [key: string]: unknown;
}

/** A placed building or prop. `door` is its walkable doorstep (null for decor). */
export interface Building {
  id: number;
  type: string;
  name: string;
  col: number;
  row: number;
  width: number;
  height: number;
  door: HexCoord | null;
}

/** A generated settlement interior map. Extra fields ride the index signature. */
export interface TownMap {
  hexes: InteriorHex[];
  buildings: Building[];
  entrance: HexCoord;
  encounters: Record<string, unknown>[];
  loot: Record<string, unknown>[];
  hazards: Record<string, unknown>[];
  [key: string]: unknown;
}

interface SettlementSpec {
  perimeter: 'fence' | 'wall' | null;
  street: 'road' | 'path';
  plaza: 'townSquare' | 'path';
  /** Plaza extends this many hexes either side of the avenue. */
  plazaRadius: number;
  centerpiece: 'well' | 'campfire';
  /** Placed nearest the plaza first; each needs a lot at least FOOTPRINT.minWidth wide. */
  essentials: string[];
  fillers: string[];
  lotWidth: [number, number];
  /** Chance a leftover lot gets a filler instead of staying a garden. */
  density: number;
}

const SPECS: Record<string, SettlementSpec> = {
  camp: {
    perimeter: null, street: 'path', plaza: 'path', plazaRadius: 1, centerpiece: 'campfire',
    essentials: ['supplyWagon'], fillers: ['tent', 'tent', 'tent', 'supplyWagon'], lotWidth: [2, 2], density: 0.8,
  },
  village: {
    perimeter: 'fence', street: 'road', plaza: 'townSquare', plazaRadius: 2, centerpiece: 'well',
    essentials: ['inn', 'shop'], fillers: ['house'], lotWidth: [2, 3], density: 0.65,
  },
  town: {
    perimeter: 'fence', street: 'road', plaza: 'townSquare', plazaRadius: 2, centerpiece: 'well',
    essentials: ['inn', 'shop', 'temple', 'blacksmith'], fillers: ['house'], lotWidth: [2, 3], density: 0.75,
  },
  city: {
    perimeter: 'wall', street: 'road', plaza: 'townSquare', plazaRadius: 3, centerpiece: 'well',
    essentials: ['inn', 'shop', 'temple', 'market', 'blacksmith', 'barracks'], fillers: ['house'], lotWidth: [2, 3], density: 0.9,
  },
  metropolis: {
    perimeter: 'wall', street: 'road', plaza: 'townSquare', plazaRadius: 4, centerpiece: 'well',
    essentials: ['inn', 'shop', 'temple', 'market', 'blacksmith', 'barracks', 'inn', 'shop', 'market'],
    fillers: ['house'], lotWidth: [2, 4], density: 0.95,
  },
};

const FOOTPRINT: Record<string, { minWidth: number; height: 1 | 2 }> = {
  inn: { minWidth: 3, height: 2 },
  shop: { minWidth: 3, height: 2 },
  blacksmith: { minWidth: 3, height: 2 },
  temple: { minWidth: 4, height: 2 },
  barracks: { minWidth: 4, height: 2 },
  market: { minWidth: 3, height: 1 },
  house: { minWidth: 2, height: 2 },
  tent: { minWidth: 2, height: 1 },
  supplyWagon: { minWidth: 2, height: 1 },
};

const NAMES: Record<string, string[]> = {
  inn: ['The Weary Traveler', 'The Gilded Tankard', 'The Sleeping Griffin', 'The Rusty Lantern', 'The Drunken Dragon', 'The Hearth & Horn'],
  shop: ['Oakbarrel Provisions', 'The Copper Kettle', "Wayfarer's Supply", 'Hilltop Goods', 'The Lucky Satchel'],
  blacksmith: ['The Iron Anvil', 'Emberforge Smithy', 'Hammer & Tongs'],
  temple: ['Temple of the Morning Light', 'Chapel of the Silver Flame', 'House of the Harvest'],
  market: ['Market Stalls', 'Traders’ Row', 'Bazaar'],
  barracks: ['Watch Barracks', 'Garrison Hall'],
  house: ['Cottage', 'Townhouse', 'Homestead'],
  tent: ["Traveler's Tent", "Trapper's Tent", "Scout's Tent"],
  supplyWagon: ['Supply Wagon'],
  questBoard: ['Quest Board'],
  well: ['Town Well'],
  campfire: ['Campfire'],
};

const TERRAIN: Record<string, TerrainType> = {
  road: { key: 'road', name: 'Cobblestone Road', color: '#8B7355', walkable: true },
  path: { key: 'path', name: 'Dirt Path', color: '#8a6e4a', walkable: true },
  grass: { key: 'grass', name: 'Grass', color: '#567d46', walkable: true },
  townSquare: { key: 'townSquare', name: 'Town Square', color: '#a89968', walkable: true },
  building: { key: 'building', name: 'Building', color: '#8B4513', walkable: false },
  buildingEntrance: { key: 'buildingEntrance', name: 'Doorstep', color: '#654321', walkable: true, isInteractive: true },
  gate: { key: 'gate', name: 'Gate', color: '#5C4033', walkable: true },
  fence: { key: 'fence', name: 'Fence', color: '#4a3f35', walkable: false },
  wall: { key: 'wall', name: 'City Wall', color: '#4a4740', walkable: false },
};

/** Horizontal position in hex widths on the odd-r grid (odd rows shift right by half). */
const px = (col: number, row: number) => col + (row & 1) * 0.5;

export class TownGenerator extends InteriorGenerator {
  constructor() {
    super();
    this.terrainTypes = { ...this.terrainTypes, ...TERRAIN };
  }

  generate(width: number, height: number, townData: TownData = {}): TownMap {
    const size = townData.settlementSize && SPECS[townData.settlementSize] ? townData.settlementSize : 'town';
    const spec = SPECS[size];
    const grid = this.initializeGrid(width, height, TERRAIN.grass);
    const at = (col: number, row: number) => grid[row]?.[col];
    const paint = (col: number, row: number, key: string) => {
      const h = at(col, row);
      if (h) h.terrain = TERRAIN[key];
    };
    const ac = Math.floor(width / 2) - 1; // avenue columns: ac, ac + 1

    if (spec.perimeter) {
      for (let c = 0; c < width; c++) [0, height - 1].forEach(r => paint(c, r, spec.perimeter!));
      for (let r = 0; r < height; r++) [0, width - 1].forEach(c => paint(c, r, spec.perimeter!));
    }

    // Streets every 4 rows up from the gate (heights are 4n + 2, so they fill the map);
    // the one nearest the middle gets the plaza.
    const streets: number[] = [];
    for (let r = height - 3; r >= 3; r -= 4) streets.unshift(r);
    const mid = (height - 1) / 2;
    const plazaStreet = [...streets].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || b - a)[0];
    for (const s of streets) for (let c = 1; c < width - 1; c++) paint(c, s, spec.street);
    for (let r = streets[0]; r < height - 1; r++) [ac, ac + 1].forEach(c => paint(c, r, spec.street));

    const R = spec.plazaRadius;
    for (let r = plazaStreet - 3; r < plazaStreet; r++)
      for (let c = ac - R; c <= ac + 1 + R; c++) paint(c, r, spec.plaza);

    // Gate: two hexes wide at the bottom edge; the player spawns just inside.
    const gate = spec.perimeter === 'wall' ? { ...TERRAIN.gate, name: 'City Gate' } : TERRAIN.gate;
    grid[height - 1][ac].terrain = grid[height - 1][ac + 1].terrain = gate;
    grid[height - 1][ac].content = 'entrance';

    const names = Object.fromEntries(Object.entries(NAMES).map(([k, v]) => [k, [...v]]));
    // Landmarks draw without replacement so a metropolis's two inns differ; homes may repeat
    const nameFor = (type: string) => {
      const pool = names[type];
      const i = Math.floor(this.random() * pool.length);
      return pool.length > 1 && type !== 'house' && type !== 'tent' ? pool.splice(i, 1)[0] : pool[i];
    };
    const buildings: Building[] = [];
    const place = (type: string, col: number, bottom: number, w: number, h: number, withDoor: boolean) => {
      const b: Building = { id: buildings.length + 1, type, name: nameFor(type), col, row: bottom - h + 1, width: w, height: h, door: null };
      for (let r = b.row; r <= bottom; r++) for (let c = col; c < col + w; c++) this.tag(at(c, r)!, TERRAIN.building, b);
      if (withDoor) {
        b.door = this.doorstep(grid, col, bottom, w, ac + 0.5);
        this.tag(at(b.door.col, b.door.row)!, TERRAIN.buildingEntrance, b);
      }
      buildings.push(b);
    };

    // Plaza props: centerpiece in the middle, quest board at the plaza's north-east corner.
    place(spec.centerpiece, ac, plazaStreet - 2, 1, 1, false);
    place('questBoard', ac + 1 + R, plazaStreet - 3, 1, 1, true);

    // Frontage: runs of free grass on the two rows above each street.
    const runs: Array<{ row: number; start: number; end: number }> = [];
    for (const s of streets) {
      const free = (x: number) => x < width - 1 && at(x, s - 1)?.terrain.key === 'grass' && at(x, s - 2)?.terrain.key === 'grass';
      for (let c = 1; c < width - 1; c++) {
        if (!free(c)) continue;
        const start = c;
        while (free(c + 1)) c++;
        runs.push({ row: s - 1, start, end: c });
      }
    }

    // Essentials are carved from the run end nearest the plaza, leaving a 1-hex alley.
    const plazaX = ac + 0.5, plazaY = plazaStreet - 2;
    const reach = (col: number, row: number) => Math.hypot(col - plazaX, (row - plazaY) * 1.5);
    for (const type of spec.essentials) {
      const w = FOOTPRINT[type].minWidth;
      const options = runs
        .filter(r => r.end - r.start + 1 >= w)
        .map(r => ({ r, fromEnd: reach(r.end, r.row) < reach(r.start, r.row) }))
        .sort((a, b) => reach(a.fromEnd ? a.r.end : a.r.start, a.r.row) - reach(b.fromEnd ? b.r.end : b.r.start, b.r.row));
      const pick = options[0];
      if (!pick) {
        logger.general.warn('TownGenerator: no frontage for essential building', { type, size, seed: this.seed });
        continue;
      }
      const { r, fromEnd } = pick;
      place(type, fromEnd ? r.end - w + 1 : r.start, r.row, w, FOOTPRINT[type].height, true);
      if (fromEnd) r.end -= w + 1;
      else r.start += w + 1;
    }

    // Whatever frontage is left becomes house lots or gardens.
    for (const r of runs) {
      for (let x = r.start; x <= r.end; ) {
        const w = Math.min(this.randomInt(spec.lotWidth[0], spec.lotWidth[1]), r.end - x + 1);
        if (w >= 2 && this.random() < spec.density) {
          const type = this.randomChoice(spec.fillers);
          place(type, x, r.row, w, FOOTPRINT[type].height, true);
        }
        x += w + 1;
      }
    }

    return {
      seed: this.seed,
      poiType: size,
      name: townData.name,
      width,
      height,
      hexes: this.gridToHexes(grid),
      buildings,
      entrance: { col: ac, row: height - 2 },
      encounters: [],
      loot: [],
      hazards: [],
    };
  }

  private tag(hex: InteriorHex, terrain: TerrainType, b: Building) {
    hex.terrain = terrain;
    hex.buildingType = b.type;
    hex.buildingId = b.id;
    hex.buildingName = b.name;
  }

  /** The hex below the bottom row closest to the building's middle (ties go toward `towardX`). */
  private doorstep(grid: InteriorGrid, col: number, bottom: number, w: number, towardX: number): HexCoord {
    const centre = px(col, bottom) + (w - 1) / 2, row = bottom + 1;
    const score = (c: number) => Math.abs(px(c, row) - centre) * 100 + Math.abs(px(c, row) - towardX);
    let best = col;
    for (let c = col - 1; c <= col + w; c++) if (grid[row]?.[c] && score(c) < score(best)) best = c;
    return { col: best, row };
  }
}

export default TownGenerator;
