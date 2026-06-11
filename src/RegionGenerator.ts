import { PerlinNoise } from './noise';
import logger from './utils/logger';
import { getHexDistance, getHexNeighbors } from './utils/hexMath';

export interface RegionType {
  key: string;
  name: string;
  biomes: string[];
  moistureRange: number[];
  tempRange: number[];
  weatherTable: Record<string, number>;
}

interface HexCoord {
  col: number;
  row: number;
}

export interface Region {
  id: string;
  centerHex: HexCoord;
  radius: number;
  biome: RegionType;
  elevation: number;
  moisture: number;
  temperature: number;
  weatherPattern: unknown;
  boundaries: Set<string>;
}

/**
 * Region types with their characteristics
 */
export const REGION_TYPES: Record<string, RegionType> = {
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
  seed: number;
  width: number;
  height: number;
  noise: PerlinNoise;
  seedCounter: number;

  constructor(seed: number, width: number, height: number) {
    this.seed = seed;
    this.width = width;
    this.height = height;
    this.noise = new PerlinNoise(seed);
    this.seedCounter = seed;
  }

  /**
   * Seeded random number generator
   */
  random(): number {
    const x = Math.sin(this.seedCounter++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Generate all regions for the map
   * @param {number} numRegions - Number of regions to create
   * @param {number} startCol - Player start column (pinned as first region center)
   * @param {number} startRow - Player start row (pinned as first region center)
   * @returns { regions, hexToRegion }
   */
  generate(
    numRegions: number | null = null,
    startCol = 10,
    startRow = 7
  ): { regions: Region[]; hexToRegion: Map<string, number> } {
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
      startPos: `${startCol},${startRow}`,
    });

    // 1. Scatter region centers, pinning the start position as center[0]
    const centers = this.scatterCenters(numRegions, startCol, startRow);
    logger.mapgen.debug('Region centers scattered', { count: centers.length });

    // 2. Voronoi partitioning - assign each hex to nearest region
    const hexToRegion = this.assignHexesToRegions(centers);
    logger.mapgen.debug('Voronoi partitioning complete', { assignments: hexToRegion.size });

    // 3. Characterize each region
    const regions = this.characterizeRegions(centers, hexToRegion);
    logger.mapgen.debug('Regions characterized', {
      types: regions.map(r => r.biome.key),
    });

    // 4. Force the start region (index 0) to Temperate Forest so the player
    //    always begins in a plains-capable biome regardless of noise values.
    regions[0].biome = REGION_TYPES.TEMPERATE_FOREST;
    logger.mapgen.debug('Start region forced to Temperate Forest');

    // 5. Calculate boundaries
    this.calculateBoundaries(regions, hexToRegion);
    logger.mapgen.debug('Region boundaries calculated');

    logger.mapgen.timeEnd('region-generation');

    return { regions, hexToRegion };
  }

  /**
   * Scatter region centers across the map using seeded random.
   * The start position is always placed first so it owns region index 0,
   * which is then forced to Temperate Forest in generate().
   */
  scatterCenters(numRegions: number, startCol = 10, startRow = 7): HexCoord[] {
    // Pin the player start as the very first center (region 0).
    const centers: HexCoord[] = [{ col: startCol, row: startRow }];
    const minDistance = Math.sqrt((this.width * this.height) / numRegions) * 0.6;

    let attempts = 0;
    const maxAttempts = numRegions * 50;

    while (centers.length < numRegions && attempts < maxAttempts) {
      attempts++;

      const col = Math.floor(this.random() * this.width);
      const row = Math.floor(this.random() * this.height);

      // Check minimum distance from existing centers (including the pinned start)
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
  assignHexesToRegions(centers: HexCoord[]): Map<string, number> {
    const map = new Map<string, number>();

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
  characterizeRegions(centers: HexCoord[], hexToRegion: Map<string, number>): Region[] {
    return centers.map((center, idx): Region => {
      // Use noise to determine region properties.
      // Scale /50 ensures adjacent region centers sample from the same broad
      // noise feature, producing natural climate gradients instead of random jumps.
      const elevationNoise = this.noise.noise2D(center.col / 50, center.row / 50);
      const moistureNoise = this.noise.noise2D(center.col / 50 + 100, center.row / 50 + 100);
      const tempNoise = this.noise.noise2D(center.col / 50 + 200, center.row / 50 + 200);

      // Normalize to 0-10 range
      const elevation = ((elevationNoise + 1) / 2) * 10;
      const moisture = ((moistureNoise + 1) / 2) * 10;

      // Latitude temperature gradient: row 0 (north) is coldest, bottom is warmest.
      // Blend 60% noise + 40% latitude so polar/tropical regions cluster naturally
      // while still having local variation (a southern desert isn't perfectly uniform).
      const latitudeBias = (center.row / this.height - 0.5) * 2; // -1 (north) to +1 (south)
      const blendedTempNoise = tempNoise * 0.6 + latitudeBias * 0.4;
      const temperature = blendedTempNoise * 25; // ~-25 to 25°C range

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
        boundaries: new Set<string>(),
      };
    });
  }

  /**
   * Determine region type based on elevation, moisture, and temperature.
   *
   * Classification order (highest specificity first):
   *   1. Cold (t < 0.3)  → Alpine if very high elevation, else Arctic
   *   2. Hot  (t > 0.7)  → Desert if dry, else Jungle
   *   3. Temperate dry   → Desert
   *   4. Temperate wet   → Wetlands
   *   5. Low elevation + moderate moisture → Coastal
   *   6. Very high elevation (any temperate moisture) → Alpine Highlands
   *   7. Default → Temperate Forest
   *
   * Alpine now requires e > 0.7 in the temperate fallback (was 0.5),
   * reducing overclaiming from ~50% of temperate regions to ~15%.
   */
  determineRegionType(elevation: number, moisture: number, temp: number): RegionType {
    // Normalize to 0-1
    const e = elevation / 10;
    const m = moisture / 10;
    const t = (temp + 25) / 50; // -25 to 25 → 0 to 1

    // Cold regions
    if (t < 0.3) {
      return e > 0.6 ? REGION_TYPES.ALPINE_HIGHLANDS : REGION_TYPES.ARCTIC_TUNDRA;
    }

    // Hot regions
    if (t > 0.7) {
      return m < 0.4 ? REGION_TYPES.ARID_DESERT : REGION_TYPES.TROPICAL_JUNGLE;
    }

    // Temperate: dry → desert regardless of elevation
    if (m < 0.3) {
      return REGION_TYPES.ARID_DESERT;
    }

    // Temperate: very wet → wetlands
    if (m > 0.7) {
      return REGION_TYPES.WETLANDS;
    }

    // Coastal: low-lying land with moderate moisture (not fully inland)
    if (e < 0.35 && m > 0.4 && m < 0.7) {
      return REGION_TYPES.COASTAL;
    }

    // Genuinely high elevation in temperate zone → alpine
    if (e > 0.7) {
      return REGION_TYPES.ALPINE_HIGHLANDS;
    }

    // Default: temperate forest (grassland, forest, hills mix)
    return REGION_TYPES.TEMPERATE_FOREST;
  }

  /**
   * Calculate average radius of a region
   */
  calculateRadius(regionIdx: number, hexToRegion: Map<string, number>, center: HexCoord): number {
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
  calculateBoundaries(regions: Region[], hexToRegion: Map<string, number>): void {
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const hexKey = `${col},${row}`;
        const regionId = hexToRegion.get(hexKey);
        if (regionId === undefined) continue;

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
   * Get neighboring hex coordinates.
   * Delegates to the shared hexMath utility to avoid offset-logic duplication.
   * Filters out neighbors that fall outside the map bounds.
   */
  getNeighbors(col: number, row: number): HexCoord[] {
    return getHexNeighbors(col, row).filter(
      n => n.col >= 0 && n.col < this.width && n.row >= 0 && n.row < this.height
    );
  }

  /**
   * Get region for a specific hex
   */
  getRegionForHex(col: number, row: number, hexToRegion: Map<string, number>): number | undefined {
    return hexToRegion.get(`${col},${row}`);
  }

  /**
   * Check if hex is on region boundary
   */
  isOnBoundary(
    col: number,
    row: number,
    regions: Region[],
    hexToRegion: Map<string, number>
  ): boolean {
    const regionId = hexToRegion.get(`${col},${row}`);
    if (regionId === undefined) return false;
    return regions[regionId].boundaries.has(`${col},${row}`);
  }

  /**
   * Get neighboring regions for blending
   */
  getNeighborRegions(col: number, row: number, hexToRegion: Map<string, number>): number[] {
    const neighbors = this.getNeighbors(col, row);
    const neighborRegions = new Set<number>();

    for (const neighbor of neighbors) {
      const regionId = hexToRegion.get(`${neighbor.col},${neighbor.row}`);
      if (regionId !== undefined) {
        neighborRegions.add(regionId);
      }
    }

    return Array.from(neighborRegions);
  }
}
