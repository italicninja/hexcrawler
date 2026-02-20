// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * CombatTerrainGenerator - Generates hex-based tactical combat battlefields
 * Creates 20x20 hex maps with terrain-appropriate obstacles and features
 */

export class CombatTerrainGenerator {
  constructor() {
    this.seed = null;
    this.rng = null;
  }

  /**
   * Set seed for reproducible generation
   * @param {string} seed - Seed string
   */
  setSeed(seed) {
    this.seed = seed;
    this.rng = this.createSeededRNG(seed);
  }

  /**
   * Create a seeded random number generator
   * @param {string} seed - Seed string
   * @returns {Function} RNG function
   */
  createSeededRNG(seed) {
    let seedValue = 0;
    for (let i = 0; i < seed.length; i++) {
      seedValue = (seedValue << 5) - seedValue + seed.charCodeAt(i);
      seedValue = seedValue & seedValue; // Convert to 32bit integer
    }

    return () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
  }

  /**
   * Get random number (0-1)
   */
  random() {
    if (!this.rng) {
      throw new Error('Seed not set. Call setSeed() first.');
    }
    return this.rng();
  }

  /**
   * Get random integer between min and max (inclusive)
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Pick random element from array
   * @param {Array} array
   * @returns {*}
   */
  randomChoice(array) {
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Generate a 20x20 hex battlefield with obstacles
   * @param {string} encounterType - Type of encounter (standard, ambush, boss, surrounded)
   * @param {string} terrainType - Terrain type (plains, forest, mountain, swamp, desert, dungeon)
   * @param {string} seed - Seed for reproducible generation
   * @returns {Object} {hexes, width: 20, height: 20}
   */
  static generate(encounterType, terrainType, seed) {
    const generator = new CombatTerrainGenerator();
    generator.setSeed(seed);

    const width = 20;
    const height = 20;

    // Get terrain colors and obstacle configuration
    const terrainConfig = generator.getTerrainConfig(terrainType);

    // Initialize all hexes with base terrain
    const hexes = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        hexes.push({
          col,
          row,
          terrain: {
            type: terrainType,
            color: terrainConfig.baseColor,
          },
          blocked: false,
          difficultTerrain: false,
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
    };
  }

  /**
   * Get terrain configuration for a terrain type
   * @param {string} terrainType - Terrain type
   * @returns {Object} Terrain configuration
   */
  getTerrainConfig(terrainType) {
    const configs = {
      plains: {
        baseColor: '#7faa65',
        obstacleColor: '#8B7355',
        obstacleType: 'boulder',
        obstacleCount: { min: 3, max: 6 },
        difficultTerrainColor: '#9fb885',
        difficultTerrainCount: { min: 4, max: 8 },
      },
      forest: {
        baseColor: '#6b8e4e',
        obstacleColor: '#2d5016',
        obstacleType: 'tree',
        obstacleCount: { min: 8, max: 15 },
        difficultTerrainColor: '#7d9a5f',
        difficultTerrainCount: { min: 6, max: 10 },
      },
      mountain: {
        baseColor: '#808080',
        obstacleColor: '#4a4a4a',
        obstacleType: 'rock',
        obstacleCount: { min: 10, max: 18 },
        difficultTerrainColor: '#999999',
        difficultTerrainCount: { min: 5, max: 9 },
      },
      swamp: {
        baseColor: '#5a6b3e',
        obstacleColor: '#2a3a1e',
        obstacleType: 'tree',
        obstacleCount: { min: 5, max: 10 },
        difficultTerrainColor: '#4a5b2e',
        difficultTerrainCount: { min: 10, max: 16 },
      },
      desert: {
        baseColor: '#daa520',
        obstacleColor: '#8B7355',
        obstacleType: 'rock',
        obstacleCount: { min: 4, max: 8 },
        difficultTerrainColor: '#c9a340',
        difficultTerrainCount: { min: 6, max: 12 },
      },
      dungeon: {
        baseColor: '#4a4a4a',
        obstacleColor: '#2a2a2a',
        obstacleType: 'wall',
        obstacleCount: { min: 12, max: 20 },
        difficultTerrainColor: '#5a5a5a',
        difficultTerrainCount: { min: 3, max: 6 },
      },
    };

    return configs[terrainType] || configs.plains;
  }

  /**
   * Add obstacles to battlefield
   * @param {Array} hexes - Hex array
   * @param {number} width - Battlefield width
   * @param {number} height - Battlefield height
   * @param {Object} terrainConfig - Terrain configuration
   */
  addObstacles(hexes, width, height, terrainConfig) {
    const obstacleCount = this.randomInt(
      terrainConfig.obstacleCount.min,
      terrainConfig.obstacleCount.max
    );

    let placed = 0;
    let attempts = 0;
    const maxAttempts = 100;

    while (placed < obstacleCount && attempts < maxAttempts) {
      attempts++;

      // Pick random hex (avoid top 3 and bottom 3 rows)
      const col = this.randomInt(0, width - 1);
      const row = this.randomInt(3, height - 4);

      const index = row * width + col;
      const hex = hexes[index];

      // Skip if hex doesn't exist or is already blocked/difficult
      if (!hex || hex.blocked || hex.difficultTerrain) {
        continue;
      }

      // Place obstacle
      hex.blocked = true;
      hex.terrain.color = terrainConfig.obstacleColor;
      placed++;
    }
  }

  /**
   * Add difficult terrain patches to battlefield
   * @param {Array} hexes - Hex array
   * @param {number} width - Battlefield width
   * @param {number} height - Battlefield height
   * @param {Object} terrainConfig - Terrain configuration
   */
  addDifficultTerrain(hexes, width, height, terrainConfig) {
    const patchCount = this.randomInt(
      terrainConfig.difficultTerrainCount.min,
      terrainConfig.difficultTerrainCount.max
    );

    let placed = 0;
    let attempts = 0;
    const maxAttempts = 100;

    while (placed < patchCount && attempts < maxAttempts) {
      attempts++;

      // Pick random hex (can be anywhere)
      const col = this.randomInt(0, width - 1);
      const row = this.randomInt(0, height - 1);

      const index = row * width + col;
      const hex = hexes[index];

      // Skip if hex doesn't exist or is already blocked/difficult
      if (!hex || hex.blocked || hex.difficultTerrain) {
        continue;
      }

      // Place difficult terrain
      hex.difficultTerrain = true;
      hex.terrain.color = terrainConfig.difficultTerrainColor;
      placed++;
    }
  }
}
