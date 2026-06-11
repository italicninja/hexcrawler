/**
 * Terrain generation algorithms
 * Uses noise functions to generate realistic terrain distributions
 */

interface NoiseGenerator {
  noise2D(x: number, y: number): number;
  octaveNoise2D(
    x: number,
    y: number,
    octaves: number,
    persistence: number,
    lacunarity: number
  ): number;
}

type TerrainDef = Record<string, unknown>;
type TerrainTypeMap = Record<string, TerrainDef>;

export class TerrainAlgorithms {
  noise: NoiseGenerator;

  constructor(noiseGenerator: NoiseGenerator) {
    this.noise = noiseGenerator;
  }

  /**
   * Simple terrain mapping - maps noise value directly to terrain
   */
  simpleMapping(x: number, y: number, scale: number, terrainTypes: TerrainTypeMap): TerrainDef {
    const noiseValue = this.noise.noise2D(x / scale, y / scale);
    const terrainKeys = Object.keys(terrainTypes);
    const index = Math.floor(((noiseValue + 1) / 2) * terrainKeys.length);
    const clampedIndex = Math.max(0, Math.min(terrainKeys.length - 1, index));
    return terrainTypes[terrainKeys[clampedIndex]];
  }

  /**
   * Multi-octave terrain - uses multiple noise frequencies for more detail
   */
  multiOctaveTerrain(x: number, y: number, scale: number, terrainTypes: TerrainTypeMap): TerrainDef {
    const noiseValue = this.noise.octaveNoise2D(
      x / scale,
      y / scale,
      4, // octaves
      0.5, // persistence
      2.0 // lacunarity
    );

    return this.mapNoiseToTerrain(noiseValue, terrainTypes);
  }

  /**
   * Realistic biome-based terrain generation
   * Uses elevation and moisture to determine terrain type
   */
  biomeBasedTerrain(x: number, y: number, scale: number, terrainTypes: TerrainTypeMap): TerrainDef {
    // Use different noise layers for elevation and moisture
    const elevation = this.noise.octaveNoise2D(x / scale, y / scale, 4, 0.5, 2.0);
    const moisture = this.noise.octaveNoise2D(x / scale + 1000, y / scale + 1000, 3, 0.6, 2.0);

    // Map to terrain based on elevation and moisture
    return this.mapBiome(elevation, moisture, terrainTypes);
  }

  /**
   * Island generation - creates island-like landmasses
   */
  islandTerrain(
    x: number,
    y: number,
    width: number,
    height: number,
    scale: number,
    terrainTypes: TerrainTypeMap
  ): TerrainDef {
    // Get base noise
    const noiseValue = this.noise.octaveNoise2D(x / scale, y / scale, 4, 0.5, 2.0);

    // Calculate distance from center (for island shape)
    const centerX = width / 2;
    const centerY = height / 2;
    const dx = (x - centerX) / (width / 2);
    const dy = (y - centerY) / (height / 2);
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

    // Combine noise with distance gradient
    const islandFactor = Math.max(0, 1 - distanceFromCenter);
    const combinedValue = noiseValue * islandFactor;

    return this.mapNoiseToTerrain(combinedValue, terrainTypes);
  }

  /**
   * Map noise value to terrain type using thresholds
   */
  mapNoiseToTerrain(noiseValue: number, terrainTypes: TerrainTypeMap): TerrainDef {
    // Normalize to 0-1 range
    const normalized = (noiseValue + 1) / 2;

    // Define elevation-based terrain thresholds
    // Note: River terrain is added separately after base generation
    if (normalized < 0.2) return terrainTypes.water;
    if (normalized < 0.3) return terrainTypes.swamp;
    if (normalized < 0.45) return terrainTypes.grassland;
    if (normalized < 0.6) return terrainTypes.forest;
    if (normalized < 0.7) return terrainTypes.hills;
    if (normalized < 0.85) return terrainTypes.mountains;
    return terrainTypes.tundra;
  }

  /**
   * Map biome based on elevation and moisture
   */
  mapBiome(elevation: number, moisture: number, terrainTypes: TerrainTypeMap): TerrainDef {
    // Normalize to 0-1
    const e = (elevation + 1) / 2;
    const m = (moisture + 1) / 2;

    // Water
    if (e < 0.2) return terrainTypes.water;

    // Coastal/low elevation
    if (e < 0.4) {
      if (m < 0.3) return terrainTypes.desert;
      if (m < 0.6) return terrainTypes.grassland;
      return terrainTypes.swamp;
    }

    // Mid elevation
    if (e < 0.6) {
      if (m < 0.3) return terrainTypes.desert;
      if (m < 0.6) return terrainTypes.grassland;
      return terrainTypes.forest;
    }

    // High elevation
    if (e < 0.8) {
      if (m < 0.4) return terrainTypes.hills;
      return terrainTypes.forest;
    }

    // Very high elevation
    if (e < 0.9) return terrainTypes.mountains;
    return terrainTypes.tundra;
  }

  /**
   * Get algorithm by name
   */
  static getAlgorithm(name: string): string {
    const algorithms: Record<string, string> = {
      simple: 'simpleMapping',
      octave: 'multiOctaveTerrain',
      biome: 'biomeBasedTerrain',
      island: 'islandTerrain',
    };
    return algorithms[name] || 'biomeBasedTerrain';
  }
}
