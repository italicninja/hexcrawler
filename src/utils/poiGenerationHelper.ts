/**
 * POI Generation Helper Utility
 *
 * Provides reusable functions for generating Points of Interest (POIs) on the hex map.
 * This eliminates code duplication in map generation and terrain expansion.
 */

import { GAME_DEFAULTS, POI_SPAWN, isSettlement } from '../constants/gameConstants';
import { getHexDistance } from './hexMath';

interface TerrainType {
  name: string;
  [key: string]: unknown;
}

interface POISystemLike {
  getPOITypesForTerrain(terrain: TerrainType): string[] | null | undefined;
  generatePOI(
    poiType: string,
    col: number,
    row: number,
    terrain: TerrainType,
    startCol: number,
    startRow: number,
    random: () => number
  ): unknown;
}

interface TerrainGeneratorLike {
  random(): number;
  streamFor(purpose: string, col?: number, row?: number): () => number;
  poiSystem: POISystemLike;
  generateTerrain(
    col: number,
    row: number,
    mapWidth: number,
    mapHeight: number,
    variety: number
  ): TerrainType;
  getWeatherForHex(col: number, row: number): unknown;
}

interface GeneratedHex {
  row: number;
  col: number;
  terrain: TerrainType;
  poi: unknown;
  weather: unknown;
}

/** Terrain a settlement can be built on (matches the starting map's settlement scoring). */
const SETTLED_TERRAIN = ['Grassland', 'Forest', 'Hills'];

/** Settlement size by where the hex's roll falls within the settlement chance (bigger = rarer). */
const EXPANSION_SETTLEMENTS: [type: string, upTo: number][] = [
  ['city', 0.05],
  ['town', 0.2],
  ['village', 0.55],
  ['camp', 1],
];

const settlementRoll = (tg: TerrainGeneratorLike, col: number, row: number) =>
  tg.streamFor('settlement', col, row)();

/**
 * Settlement type for this hex, or null. A hex settles when its roll is under the chance
 * AND is the lowest roll within the spacing radius, so settlements stay
 * POI_SPAWN.SETTLEMENT_MIN_SPACING apart using only seed + coords (chunk order can't matter).
 */
function settlementForHex(tg: TerrainGeneratorLike, col: number, row: number): string | null {
  const roll = settlementRoll(tg, col, row);
  if (roll >= POI_SPAWN.EXPANSION_SETTLEMENT_CHANCE) return null;

  const r = POI_SPAWN.SETTLEMENT_MIN_SPACING - 1;
  for (let dr = -r; dr <= r; dr++) {
    for (let dc = -r; dc <= r; dc++) {
      if (!dc && !dr) continue;
      if (getHexDistance(col, row, col + dc, row + dr) > r) continue;
      if (settlementRoll(tg, col + dc, row + dr) < roll) return null;
    }
  }

  const u = roll / POI_SPAWN.EXPANSION_SETTLEMENT_CHANCE;
  return EXPANSION_SETTLEMENTS.find(([, upTo]) => u < upTo)![0];
}

/**
 * Generates a POI for a hex beyond the starting map: a spaced-out settlement on habitable
 * terrain, otherwise (at `chance`) a terrain-appropriate site or encounter.
 */
export function generatePOIForHex(
  terrainGenerator: TerrainGeneratorLike | null,
  terrainType: TerrainType | null,
  col: number,
  row: number,
  chance: number = POI_SPAWN.EXPANSION_SITE_CHANCE,
  random: () => number = () => terrainGenerator!.random()
): unknown {
  if (!terrainGenerator || !terrainType) {
    return null;
  }

  // Never generate POIs on water or rivers
  if (terrainType.name === 'Water' || terrainType.name === 'River') {
    return null;
  }

  const { poiSystem } = terrainGenerator;
  const { col: startCol, row: startRow } = GAME_DEFAULTS.START_POSITION;

  const settlement = SETTLED_TERRAIN.includes(terrainType.name)
    ? settlementForHex(terrainGenerator, col, row)
    : null;
  if (settlement) {
    return poiSystem.generatePOI(settlement, col, row, terrainType, startCol, startRow, random);
  }

  // Check if POI should be generated based on chance
  if (random() >= chance) {
    return null;
  }

  // Sites only — settlements come from the spaced roll above
  const suitableTypes = poiSystem.getPOITypesForTerrain(terrainType)?.filter(t => !isSettlement(t));

  if (!suitableTypes || suitableTypes.length === 0) {
    return null;
  }

  const poiType = suitableTypes[Math.floor(random() * suitableTypes.length)];
  return poiSystem.generatePOI(poiType, col, row, terrainType, startCol, startRow, random);
}

/**
 * Generates a complete hex object with terrain, POI, and weather
 */
export function generateHex(
  terrainGenerator: TerrainGeneratorLike,
  col: number,
  row: number,
  mapWidth: number,
  mapHeight: number,
  terrainVariety = 0.5,
  poiChance: number = POI_SPAWN.EXPANSION_SITE_CHANCE
): GeneratedHex {
  if (!terrainGenerator) {
    throw new Error('poiGenerationHelper.generateHex: terrainGenerator is required');
  }

  // Generate terrain type
  const terrainType = terrainGenerator.generateTerrain(
    col,
    row,
    mapWidth,
    mapHeight,
    terrainVariety
  );

  // Generate POI (if applicable). Per-hex stream: the result depends only on seed + coords,
  // not on which chunk/order the hex was generated in.
  const poi = generatePOIForHex(
    terrainGenerator,
    terrainType,
    col,
    row,
    poiChance,
    terrainGenerator.streamFor('poi', col, row)
  );

  // Generate weather from the regional weather system for biome coherence
  const weather = terrainGenerator.getWeatherForHex(col, row);

  return {
    row,
    col,
    terrain: terrainType,
    poi,
    weather,
  };
}
