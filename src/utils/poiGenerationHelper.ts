/**
 * POI Generation Helper Utility
 *
 * Provides reusable functions for generating Points of Interest (POIs) on the hex map.
 * This eliminates code duplication in map generation and terrain expansion.
 */

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
    playerLevel: number,
    partySize: number,
    random: () => number
  ): unknown;
}

interface TerrainGeneratorLike {
  random(): number;
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

/**
 * Generates a POI for a hex based on terrain type
 */
export function generatePOIForHex(
  terrainGenerator: TerrainGeneratorLike | null,
  terrainType: TerrainType | null,
  col: number,
  row: number,
  chance = 0.2
): unknown {
  if (!terrainGenerator || !terrainType) {
    return null;
  }

  // Never generate POIs on water or rivers
  if (terrainType.name === 'Water' || terrainType.name === 'River') {
    return null;
  }

  // Check if POI should be generated based on chance
  if (terrainGenerator.random() >= chance) {
    return null;
  }

  // Get POI types suitable for this terrain
  const suitableTypes = terrainGenerator.poiSystem.getPOITypesForTerrain(terrainType);

  if (!suitableTypes || suitableTypes.length === 0) {
    return null;
  }

  // Select random POI type from suitable types
  const poiType = suitableTypes[Math.floor(terrainGenerator.random() * suitableTypes.length)];

  // Generate POI using terrain generator's POI system
  const poi = terrainGenerator.poiSystem.generatePOI(
    poiType,
    col,
    row,
    terrainType,
    10, // playerLevel
    7, // partySize
    () => terrainGenerator.random()
  );

  return poi;
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
  poiChance = 0.2
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

  // Generate POI (if applicable)
  const poi = generatePOIForHex(terrainGenerator, terrainType, col, row, poiChance);

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
