// @ts-nocheck
// TODO: Add proper types
import { PerlinNoise } from './noise';
import logger from './utils/logger';
import { getHexDistance } from './utils/hexMath';

/**
 * Region types with their characteristics
 */
export const REGION_TYPES = {
  TEMPERATE_FOREST: {
    key: 'temperate_forest',
    name: 'Temperate Forest',
    biomes: ['forest', 'grassland', 'hills'],
    moistureRange: [6, 8],
    tempRange: [10, 20],
    weatherTable: {
      clear: 0.6,
      rain: 0.25,
      fog: 0.1,
      storm: 0.05,
    },
  },
  TROPICAL_JUNGLE: {
    key: 'tropical_jungle',
    name: 'Tropical Jungle',
    biomes: ['forest', 'swamp', 'grassland'],
    moistureRange: [8, 10],
    tempRange: [25, 35],
    weatherTable: {
      clear: 0.4,
      rain: 0.4,
      storm: 0.15,
      fog: 0.05,
    },
  },
  ARID_DESERT: {
    key: 'arid_desert',
    name: 'Arid Desert',
    biomes: ['desert', 'grassland', 'hills'],
    moistureRange: [1, 3],
    tempRange: [20, 40],
    weatherTable: {
      clear: 0.8,
      sandstorm: 0.15,
      heatwave: 0.05,
    },
  },
  ARCTIC_TUNDRA: {
    key: 'arctic_tundra',
    name: 'Arctic Tundra',
    biomes: ['tundra', 'mountains', 'hills'],
    moistureRange: [2, 5],
    tempRange: [-10, 5],
    weatherTable: {
      clear: 0.4,
      snow: 0.3,
      blizzard: 0.2,
      aurora: 0.1,
    },
  },
  ALPINE_HIGHLANDS: {
    key: 'alpine_highlands',
    name: 'Alpine Highlands',
    biomes: ['mountains', 'hills', 'tundra'],
    moistureRange: [4, 7],
    tempRange: [0, 15],
    weatherTable: {
      clear: 0.5,
      wind: 0.25,
      snow: 0.15,
      storm: 0.1,
    },
  },
  WETLANDS: {
    key: 'wetlands',
    name: 'Wetlands',
    biomes: ['swamp', 'forest', 'grassland'],
    moistureRange: [7, 10],
    tempRange: [15, 25],
    weatherTable: {
      fog: 0.4,
      rain: 0.35,
      clear: 0.2,
      mist: 0.05,
    },
  },
  COASTAL: {
    key: 'coastal',
    name: 'Coastal',
    biomes: ['grassland', 'water', 'swamp'],
    moistureRange: [5, 8],
    tempRange: [10, 20],
    weatherTable: {
      clear: 0.5,
      rain: 0.25,
      fog: 0.15,
      storm: 0.1,
    },
  },
};

/**
 * RegionGenerator - Creates coherent geographic regions using Voronoi partitioning
 */
export class RegionGenerator {
  constructor(seed, width, height) {
    this.seed = seed;
    this.width = width;
    this.height = height;
    this.noise = new PerlinNoise(seed);
    this.seedCounter = seed;
  }

  /**
   * Seeded random number generator
   */
  random() {
    const x = Math.sin(this.seedCounter++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Generate all regions for the map
   * @param {number} numRegions - Number of regions to create
   * @returns {Object} { regions: Array, hexToRegion: Map }
   */
  generate(numRegions = null) {
    // Auto-calculate number of regions based on map size
    if (!numRegions) {
      const totalHexes = this.width * this.height;
      // Target ~40-80 hexes per region
      numRegions = Math.max(5, Math.min(15, Math.floor(totalHexes / 60)));
    }

    logger.mapgen.time('region-generation');
    logger.mapgen.info('Generating regions', {
      numRegions,
      mapSize: `${this.width}x${this.height}`,
      seed: this.seed,
    });

    // 1. Scatter region centers
    const centers = this.scatterCenters(numRegions);
    logger.mapgen.debug('Region centers scattered', { count: centers.length });

    // 2. Voronoi partitioning - assign each hex to nearest region
    const hexToRegion = this.assignHexesToRegions(centers);
    logger.mapgen.debug('Voronoi partitioning complete', { assignments: hexToRegion.size });

    // 3. Characterize each region
    const regions = this.characterizeRegions(centers, hexToRegion);
    logger.mapgen.debug('Regions characterized', {
      types: regions.map(r => r.biome.key),
    });

    // 4. Calculate boundaries
    this.calculateBoundaries(regions, hexToRegion);
    logger.mapgen.debug('Region boundaries calculated');

    logger.mapgen.timeEnd('region-generation');

    return { regions, hexToRegion };
  }

  /**
   * Scatter region centers across the map using seeded random
   */
  scatterCenters(numRegions) {
    const centers = [];
    const minDistance = Math.sqrt((this.width * this.height) / numRegions) * 0.6;

    let attempts = 0;
    const maxAttempts = numRegions * 50;

    while (centers.length < numRegions && attempts < maxAttempts) {
      attempts++;

      const col = Math.floor(this.random() * this.width);
      const row = Math.floor(this.random() * this.height);

      // Check minimum distance from existing centers
      let tooClose = false;
      for (const center of centers) {
        const dist = getHexDistance(col, row, center.col, center.row);
        if (dist < minDistance) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        centers.push({ col, row });
      }
    }

    // If we couldn't place all regions, fill remaining randomly
    while (centers.length < numRegions) {
      centers.push({
        col: Math.floor(this.random() * this.width),
        row: Math.floor(this.random() * this.height),
      });
    }

    return centers;
  }

  /**
   * Assign each hex to its nearest region center (Voronoi diagram)
   */
  assignHexesToRegions(centers) {
    const map = new Map();

    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        // Find nearest center
        let minDist = Infinity;
        let nearestRegion = 0;

        centers.forEach((center, idx) => {
          const dist = getHexDistance(col, row, center.col, center.row);
          if (dist < minDist) {
            minDist = dist;
            nearestRegion = idx;
          }
        });

        map.set(`${col},${row}`, nearestRegion);
      }
    }

    return map;
  }

  /**
   * Characterize each region using noise layers
   */
  characterizeRegions(centers, hexToRegion) {
    return centers.map((center, idx) => {
      // Use noise to determine region properties (scale for larger features)
      const elevationNoise = this.noise.noise2D(center.col / 15, center.row / 15);
      const moistureNoise = this.noise.noise2D(center.col / 15 + 100, center.row / 15 + 100);
      const tempNoise = this.noise.noise2D(center.col / 15 + 200, center.row / 15 + 200);

      // Normalize to 0-10 range
      const elevation = ((elevationNoise + 1) / 2) * 10;
      const moisture = ((moistureNoise + 1) / 2) * 10;
      const temperature = tempNoise * 25; // -25 to 25°C range

      // Determine region type based on climate
      const regionType = this.determineRegionType(elevation, moisture, temperature);

      // Calculate radius (average distance to boundary)
      const radius = this.calculateRadius(idx, hexToRegion, center);

      return {
        id: `region_${idx}`,
        centerHex: center,
        radius,
        biome: regionType,
        elevation,
        moisture,
        temperature,
        weatherPattern: null, // Will be set by WeatherSystem
        boundaries: new Set(),
      };
    });
  }

  /**
   * Determine region type based on elevation, moisture, and temperature
   */
  determineRegionType(elevation, moisture, temp) {
    // Normalize to 0-1
    const e = elevation / 10;
    const m = moisture / 10;
    const t = (temp + 25) / 50; // -25 to 25 → 0 to 1

    // Cold regions (arctic/alpine)
    if (t < 0.3) {
      return e > 0.6 ? REGION_TYPES.ALPINE_HIGHLANDS : REGION_TYPES.ARCTIC_TUNDRA;
    }

    // Hot regions
    if (t > 0.7) {
      return m < 0.4 ? REGION_TYPES.ARID_DESERT : REGION_TYPES.TROPICAL_JUNGLE;
    }

    // Temperate regions
    if (m < 0.3) {
      return REGION_TYPES.ARID_DESERT;
    }

    if (m > 0.7) {
      return REGION_TYPES.WETLANDS;
    }

    // Coastal check (near water sources, moderate moisture/temp)
    if (m > 0.5 && m < 0.7 && e < 0.4) {
      return REGION_TYPES.COASTAL;
    }

    // Default to temperate forest or highlands
    return e > 0.5 ? REGION_TYPES.ALPINE_HIGHLANDS : REGION_TYPES.TEMPERATE_FOREST;
  }

  /**
   * Calculate average radius of a region
   */
  calculateRadius(regionIdx, hexToRegion, center) {
    let totalDistance = 0;
    let hexCount = 0;

    hexToRegion.forEach((regionId, hexKey) => {
      if (regionId === regionIdx) {
        const [col, row] = hexKey.split(',').map(Number);
        const dist = getHexDistance(col, row, center.col, center.row);
        totalDistance += dist;
        hexCount++;
      }
    });

    return hexCount > 0 ? totalDistance / hexCount : 1;
  }

  /**
   * Calculate boundary hexes for each region
   */
  calculateBoundaries(regions, hexToRegion) {
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const hexKey = `${col},${row}`;
        const regionId = hexToRegion.get(hexKey);

        // Check neighbors
        const neighbors = this.getNeighbors(col, row);
        for (const neighbor of neighbors) {
          const neighborKey = `${neighbor.col},${neighbor.row}`;
          const neighborRegionId = hexToRegion.get(neighborKey);

          // If neighbor is in different region, this is a boundary hex
          if (neighborRegionId !== undefined && neighborRegionId !== regionId) {
            regions[regionId].boundaries.add(hexKey);
            break;
          }
        }
      }
    }
  }

  /**
   * Get neighboring hex coordinates
   */
  getNeighbors(col, row) {
    const neighbors = [];
    const isOddRow = Math.abs(row % 2) === 1;

    const offsets = isOddRow
      ? [
          [-1, 0],
          [-1, 1], // top-left, top-right
          [0, -1],
          [0, 1], // left, right
          [1, 0],
          [1, 1], // bottom-left, bottom-right
        ]
      : [
          [-1, -1],
          [-1, 0], // top-left, top-right
          [0, -1],
          [0, 1], // left, right
          [1, -1],
          [1, 0], // bottom-left, bottom-right
        ];

    for (const [dRow, dCol] of offsets) {
      const newRow = row + dRow;
      const newCol = col + dCol;

      if (newRow >= 0 && newRow < this.height && newCol >= 0 && newCol < this.width) {
        neighbors.push({ col: newCol, row: newRow });
      }
    }

    return neighbors;
  }

  /**
   * Get region for a specific hex
   */
  getRegionForHex(col, row, hexToRegion) {
    return hexToRegion.get(`${col},${row}`);
  }

  /**
   * Check if hex is on region boundary
   */
  isOnBoundary(col, row, regions, hexToRegion) {
    const regionId = hexToRegion.get(`${col},${row}`);
    if (regionId === undefined) return false;
    return regions[regionId].boundaries.has(`${col},${row}`);
  }

  /**
   * Get neighboring regions for blending
   */
  getNeighborRegions(col, row, hexToRegion) {
    const neighbors = this.getNeighbors(col, row);
    const neighborRegions = new Set();

    for (const neighbor of neighbors) {
      const regionId = hexToRegion.get(`${neighbor.col},${neighbor.row}`);
      if (regionId !== undefined) {
        neighborRegions.add(regionId);
      }
    }

    return Array.from(neighborRegions);
  }
}
