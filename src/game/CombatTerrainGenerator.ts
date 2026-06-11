/**
 * CombatTerrainGenerator - Generates hex-based tactical combat battlefields
 * Creates 20x20 hex maps with terrain-appropriate obstacles and features
 * Now accepts HexContext from the overworld hex to reflect the current location.
 */

import type { HexContext } from '../types/game';

// ============================================================================
// Terrain configuration lookup
// Maps overworld terrain keys (and POI overrides) to battlefield appearance
// ============================================================================

const TERRAIN_CONFIGS: Record<string, TerrainConfig> = {
  // --- Overworld terrain keys ---
  grassland: {
    baseColor: '#7faa65',
    obstacleColor: '#8B7355',
    obstacleType: 'boulder',
    obstacleCount: { min: 2, max: 5 },
    difficultTerrainColor: '#9fb885',
    difficultTerrainCount: { min: 3, max: 6 },
  },
  forest: {
    baseColor: '#5a7a40',
    obstacleColor: '#2d5016',
    obstacleType: 'tree',
    obstacleCount: { min: 8, max: 15 },
    difficultTerrainColor: '#6b8e4e',
    difficultTerrainCount: { min: 6, max: 10 },
  },
  hills: {
    baseColor: '#8a7a5a',
    obstacleColor: '#5a4a2e',
    obstacleType: 'boulder',
    obstacleCount: { min: 6, max: 12 },
    difficultTerrainColor: '#9a8a6a',
    difficultTerrainCount: { min: 5, max: 9 },
  },
  mountains: {
    baseColor: '#707070',
    obstacleColor: '#3a3a3a',
    obstacleType: 'rock',
    obstacleCount: { min: 12, max: 20 },
    difficultTerrainColor: '#888888',
    difficultTerrainCount: { min: 6, max: 10 },
  },
  desert: {
    baseColor: '#daa520',
    obstacleColor: '#8B7355',
    obstacleType: 'dune',
    obstacleCount: { min: 3, max: 7 },
    difficultTerrainColor: '#c9a340',
    difficultTerrainCount: { min: 6, max: 12 },
  },
  swamp: {
    baseColor: '#4a5e32',
    obstacleColor: '#2a3a1e',
    obstacleType: 'reed',
    obstacleCount: { min: 5, max: 10 },
    difficultTerrainColor: '#3d5028',
    difficultTerrainCount: { min: 12, max: 18 },
  },
  tundra: {
    baseColor: '#c8d8e0',
    obstacleColor: '#788898',
    obstacleType: 'ice',
    obstacleCount: { min: 4, max: 8 },
    difficultTerrainColor: '#b8ccd8',
    difficultTerrainCount: { min: 6, max: 10 },
  },
  water: {
    baseColor: '#3a6090',
    obstacleColor: '#2a5080',
    obstacleType: 'reed',
    obstacleCount: { min: 1, max: 3 },
    difficultTerrainColor: '#2a5070',
    difficultTerrainCount: { min: 14, max: 18 },
  },
  river: {
    baseColor: '#4a7aaa',
    obstacleColor: '#2a5888',
    obstacleType: 'reed',
    obstacleCount: { min: 2, max: 5 },
    difficultTerrainColor: '#3a6898',
    difficultTerrainCount: { min: 10, max: 14 },
  },
  // --- Legacy / fallback keys ---
  plains: {
    baseColor: '#7faa65',
    obstacleColor: '#8B7355',
    obstacleType: 'boulder',
    obstacleCount: { min: 3, max: 6 },
    difficultTerrainColor: '#9fb885',
    difficultTerrainCount: { min: 4, max: 8 },
  },
  mountain: {
    baseColor: '#808080',
    obstacleColor: '#4a4a4a',
    obstacleType: 'rock',
    obstacleCount: { min: 10, max: 18 },
    difficultTerrainColor: '#999999',
    difficultTerrainCount: { min: 5, max: 9 },
  },
  // --- POI overrides ---
  dungeon: {
    baseColor: '#3a3a3a',
    obstacleColor: '#1a1a1a',
    obstacleType: 'wall',
    obstacleCount: { min: 14, max: 22 },
    difficultTerrainColor: '#4a4a4a',
    difficultTerrainCount: { min: 3, max: 6 },
  },
  ruins: {
    baseColor: '#6a6050',
    obstacleColor: '#3a3028',
    obstacleType: 'wall',
    obstacleCount: { min: 10, max: 16 },
    difficultTerrainColor: '#7a7060',
    difficultTerrainCount: { min: 5, max: 9 },
  },
  temple: {
    baseColor: '#8a8070',
    obstacleColor: '#4a4038',
    obstacleType: 'wall',
    obstacleCount: { min: 8, max: 14 },
    difficultTerrainColor: '#9a9080',
    difficultTerrainCount: { min: 4, max: 8 },
  },
  cave: {
    baseColor: '#4a4a50',
    obstacleColor: '#2a2a30',
    obstacleType: 'rock',
    obstacleCount: { min: 12, max: 18 },
    difficultTerrainColor: '#5a5a60',
    difficultTerrainCount: { min: 4, max: 8 },
  },
  village: {
    baseColor: '#8a7a5a',
    obstacleColor: '#5a4a2e',
    obstacleType: 'boulder',
    obstacleCount: { min: 4, max: 8 },
    difficultTerrainColor: '#9a8a6a',
    difficultTerrainCount: { min: 2, max: 5 },
  },
  town: {
    baseColor: '#8a7a5a',
    obstacleColor: '#5a4a2e',
    obstacleType: 'boulder',
    obstacleCount: { min: 4, max: 8 },
    difficultTerrainColor: '#9a8a6a',
    difficultTerrainCount: { min: 2, max: 5 },
  },
  camp: {
    baseColor: '#7a6a4a',
    obstacleColor: '#4a3a2a',
    obstacleType: 'boulder',
    obstacleCount: { min: 3, max: 7 },
    difficultTerrainColor: '#8a7a5a',
    difficultTerrainCount: { min: 3, max: 6 },
  },
  lair: {
    baseColor: '#4a4050',
    obstacleColor: '#2a2030',
    obstacleType: 'rock',
    obstacleCount: { min: 10, max: 16 },
    difficultTerrainColor: '#5a5060',
    difficultTerrainCount: { min: 5, max: 9 },
  },
  tower: {
    baseColor: '#7a7060',
    obstacleColor: '#4a4038',
    obstacleType: 'wall',
    obstacleCount: { min: 8, max: 14 },
    difficultTerrainColor: '#8a8070',
    difficultTerrainCount: { min: 3, max: 7 },
  },
  shrine: {
    baseColor: '#8a8070',
    obstacleColor: '#5a5048',
    obstacleType: 'boulder',
    obstacleCount: { min: 4, max: 8 },
    difficultTerrainColor: '#9a9080',
    difficultTerrainCount: { min: 3, max: 6 },
  },
};

interface TerrainConfig {
  baseColor: string;
  obstacleColor: string;
  obstacleType: string;
  obstacleCount: { min: number; max: number };
  difficultTerrainColor: string;
  difficultTerrainCount: { min: number; max: number };
}

/** A single tile in a generated combat battlefield. */
interface BattlefieldHex {
  col: number;
  row: number;
  terrain: { type: string; key: string; color: string; name: string };
  blocked: boolean;
  difficultTerrain: boolean;
  obstacleType: string;
}

interface Battlefield {
  hexes: BattlefieldHex[];
  width: number;
  height: number;
  hexContext: HexContext | null;
}

/**
 * Apply elevation scaling to obstacle counts.
 * Higher elevation (7-10) → more obstacles.
 * Lower elevation (0-3) → fewer obstacles.
 */
function applyElevationScaling(config: TerrainConfig, elevation: number): TerrainConfig {
  const scale = 0.6 + (elevation / 10) * 0.8; // range: 0.6 at elev 0 → 1.4 at elev 10
  return {
    ...config,
    obstacleCount: {
      min: Math.round(config.obstacleCount.min * scale),
      max: Math.round(config.obstacleCount.max * scale),
    },
  };
}

/**
 * Resolve which terrain config to use, respecting POI overrides and elevation.
 */
function resolveTerrainConfig(
  terrainType: string,
  hexContext: HexContext | undefined
): TerrainConfig {
  // POI overrides take top priority
  const poiType = hexContext?.poiType;
  if (poiType && TERRAIN_CONFIGS[poiType]) {
    const base = TERRAIN_CONFIGS[poiType];
    const elevation = hexContext?.elevation ?? 5;
    return applyElevationScaling(base, elevation);
  }

  // Use overworld terrain key if available
  const terrainKey = hexContext?.terrainKey || terrainType;
  const base = TERRAIN_CONFIGS[terrainKey] || TERRAIN_CONFIGS.plains;
  const elevation = hexContext?.elevation ?? 5;
  return applyElevationScaling(base, elevation);
}

export class CombatTerrainGenerator {
  seed: string | null;
  rng: (() => number) | null;

  constructor() {
    this.seed = null;
    this.rng = null;
  }

  /**
   * Set seed for reproducible generation
   * @param {string} seed - Seed string
   */
  setSeed(seed: string): void {
    this.seed = seed;
    this.rng = this.createSeededRNG(seed);
  }

  /**
   * Create a seeded random number generator
   * @param {string} seed - Seed string
   * @returns {Function} RNG function
   */
  createSeededRNG(seed: string): () => number {
    let seedValue = 0;
    for (let i = 0; i < seed.length; i++) {
      seedValue = (seedValue << 5) - seedValue + seed.charCodeAt(i);
      seedValue = seedValue & seedValue;
    }

    return () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
  }

  /** Get random number (0-1) */
  random() {
    if (!this.rng) {
      throw new Error('Seed not set. Call setSeed() first.');
    }
    return this.rng();
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Pick random element from array
   */
  randomChoice<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Generate a 20x20 hex battlefield with obstacles
   * @param {string} encounterType - Type of encounter (standard, ambush, boss, surrounded)
   * @param {string} terrainType - Fallback terrain type string
   * @param {string} seed - Seed for reproducible generation
   * @param {Object} [hexContext] - Optional HexContext from overworld hex for richer theming
   * @returns {Object} {hexes, width: 20, height: 20, hexContext}
   */
  static generate(
    encounterType: string,
    terrainType: string,
    seed: string,
    hexContext?: HexContext
  ): Battlefield {
    const generator = new CombatTerrainGenerator();
    generator.setSeed(seed);

    const width = 20;
    const height = 20;

    // Resolve terrain config (respects POI override + elevation scaling)
    const terrainConfig = resolveTerrainConfig(terrainType, hexContext);

    // Determine effective terrain key for texture lookup
    const effectiveTerrainKey =
      hexContext?.poiType && TERRAIN_CONFIGS[hexContext.poiType]
        ? hexContext.poiType
        : hexContext?.terrainKey || terrainType;

    // Initialize all hexes with base terrain
    const hexes: BattlefieldHex[] = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        hexes.push({
          col,
          row,
          terrain: {
            type: effectiveTerrainKey,
            key: effectiveTerrainKey,
            color: terrainConfig.baseColor,
            name: hexContext?.terrainName || terrainType,
          },
          blocked: false,
          difficultTerrain: false,
          obstacleType: terrainConfig.obstacleType,
        });
      }
    }

    // Add obstacles (avoid top 3 and bottom 3 rows)
    generator.addObstacles(hexes, width, height, terrainConfig);

    // Add difficult terrain patches
    generator.addDifficultTerrain(hexes, width, height, terrainConfig);

    return {
      hexes,
      width,
      height,
      hexContext: hexContext || null,
    };
  }

  /**
   * Get terrain configuration for a terrain type (kept for backward compatibility)
   * @param {string} terrainType - Terrain type
   * @returns {Object} Terrain configuration
   */
  getTerrainConfig(terrainType: string): TerrainConfig {
    return TERRAIN_CONFIGS[terrainType] || TERRAIN_CONFIGS.plains;
  }

  /**
   * Add obstacles to battlefield
   */
  addObstacles(
    hexes: BattlefieldHex[],
    width: number,
    height: number,
    terrainConfig: TerrainConfig
  ): void {
    const obstacleCount = this.randomInt(
      terrainConfig.obstacleCount.min,
      terrainConfig.obstacleCount.max
    );

    let placed = 0;
    let attempts = 0;
    const maxAttempts = 100;

    while (placed < obstacleCount && attempts < maxAttempts) {
      attempts++;

      const col = this.randomInt(0, width - 1);
      const row = this.randomInt(3, height - 4);

      const index = row * width + col;
      const hex = hexes[index];

      if (!hex || hex.blocked || hex.difficultTerrain) {
        continue;
      }

      hex.blocked = true;
      hex.terrain.color = terrainConfig.obstacleColor;
      placed++;
    }
  }

  /**
   * Add difficult terrain patches to battlefield
   */
  addDifficultTerrain(
    hexes: BattlefieldHex[],
    width: number,
    height: number,
    terrainConfig: TerrainConfig
  ): void {
    const patchCount = this.randomInt(
      terrainConfig.difficultTerrainCount.min,
      terrainConfig.difficultTerrainCount.max
    );

    let placed = 0;
    let attempts = 0;
    const maxAttempts = 100;

    while (placed < patchCount && attempts < maxAttempts) {
      attempts++;

      const col = this.randomInt(0, width - 1);
      const row = this.randomInt(0, height - 1);

      const index = row * width + col;
      const hex = hexes[index];

      if (!hex || hex.blocked || hex.difficultTerrain) {
        continue;
      }

      hex.difficultTerrain = true;
      hex.terrain.color = terrainConfig.difficultTerrainColor;
      placed++;
    }
  }
}
