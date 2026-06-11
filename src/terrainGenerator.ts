import { PerlinNoise } from './noise';
import { TerrainAlgorithms } from './terrainAlgorithms';
import { RiverGenerator } from './riverGenerator';
import { POISystem, POI_TYPES } from './poiSystem';
import { RegionGenerator, type Region } from './RegionGenerator';
import { WeatherSystem, type WeatherType } from './WeatherSystem';
import logger from './utils/logger';
import { getHexDistance } from './utils/hexMath';
import { GAME_DEFAULTS } from './constants/gameConstants';

interface TerrainType {
  key: string;
  name: string;
  color: string;
  difficulty: number;
  // Allows assignment to the structural terrain shapes other modules expect
  [key: string]: unknown;
}

interface POITypeWeight {
  name: string;
  weight: number;
}

interface HexWeather {
  condition: string;
  effect: string;
}

interface GridHex {
  terrain: TerrainType;
  poi: unknown;
  weather: HexWeather | null;
  elevation: number;
  regionId?: number;
  // Compatible with the structural grid shape riverGenerator expects
  [key: string]: unknown;
}

type Grid = GridHex[][];

interface SettlementLocation {
  row: number;
  col: number;
  score: number;
}

interface MapGenerationResult {
  grid: Grid;
  regions: Region[];
  hexToRegion: Map<string, number> | null;
  weatherSystem: WeatherSystem | null;
}

export class TerrainGenerator {
  terrainTypes: Record<string, TerrainType>;
  poiTypes: POITypeWeight[];
  seed: number;
  noise: PerlinNoise;
  terrainAlgorithms: TerrainAlgorithms;
  riverGenerator: RiverGenerator;
  poiSystem: POISystem;
  algorithm: string;
  regionGenerator: RegionGenerator | null;
  weatherSystem: WeatherSystem | null;
  regions: Region[];
  hexToRegion: Map<string, number> | null;
  startCol?: number;
  startRow?: number;

  constructor() {
    this.terrainTypes = {
      water: { key: 'water', name: 'Water', color: '#4682B4', difficulty: 4 },
      river: { key: 'river', name: 'River', color: '#5B9BD5', difficulty: 2 },
      swamp: { key: 'swamp', name: 'Swamp', color: '#4F7942', difficulty: 3 },
      grassland: { key: 'grassland', name: 'Grassland', color: '#90EE90', difficulty: 1 },
      forest: { key: 'forest', name: 'Forest', color: '#228B22', difficulty: 2 },
      hills: { key: 'hills', name: 'Hills', color: '#8B7355', difficulty: 2 },
      mountains: { key: 'mountains', name: 'Mountains', color: '#696969', difficulty: 3 },
      desert: { key: 'desert', name: 'Desert', color: '#EDC9AF', difficulty: 2 },
      tundra: { key: 'tundra', name: 'Tundra', color: '#E0E0E0', difficulty: 2 },
    };

    this.poiTypes = [
      { name: 'Dungeon', weight: 3 },
      { name: 'Settlement', weight: 5 },
      { name: 'Ruins', weight: 4 },
      { name: 'Tower', weight: 2 },
      { name: 'Cave', weight: 4 },
      { name: 'Shrine', weight: 3 },
      { name: 'Camp', weight: 3 },
    ];
    // Legacy per-terrain weatherTypes table removed — all terrain types (including
    // rivers) now inherit their weather from the regional WeatherSystem via
    // applyRegionalWeather(), keeping weather consistent and biome-aware.

    this.seed = Date.now();
    this.noise = new PerlinNoise(this.seed);
    this.terrainAlgorithms = new TerrainAlgorithms(this.noise);
    this.riverGenerator = new RiverGenerator(this.noise);
    this.poiSystem = new POISystem();
    this.algorithm = 'biome'; // default algorithm

    // Region-based generation components
    this.regionGenerator = null;
    this.weatherSystem = null;
    this.regions = [];
    this.hexToRegion = null;
  }

  setSeed(seed: string | number | null): void {
    this.seed = seed ? parseInt(String(seed), 10) : Date.now();
    this.noise.setSeed(this.seed);
  }

  initializeRegions(width: number, height: number): void {
    const { col: startCol, row: startRow } = GAME_DEFAULTS.START_POSITION;
    logger.mapgen.info('Initializing region-based generation', {
      width,
      height,
      seed: this.seed,
      startPos: `${startCol},${startRow}`,
    });

    // Store start position for use during terrain selection (grassland lock)
    this.startCol = startCol;
    this.startRow = startRow;

    this.regionGenerator = new RegionGenerator(this.seed, width, height);
    // Pass start position so region 0 is pinned there and forced to Temperate Forest
    const { regions, hexToRegion } = this.regionGenerator.generate(null, startCol, startRow);
    this.regions = regions;
    this.hexToRegion = hexToRegion;

    // Initialize weather system with actual map dimensions so edge spawning is correct.
    // Region.weatherPattern is typed `unknown` upstream; WeatherSystem narrows it to
    // WeatherType — same runtime objects, so cast through the boundary.
    this.weatherSystem = new WeatherSystem(
      this.regions as unknown as ConstructorParameters<typeof WeatherSystem>[0],
      this.seed + 1000,
      width,
      height
    );
    this.weatherSystem.initializeWeather();

    logger.mapgen.info('Regions initialized', {
      count: regions.length,
      types: regions.map(r => r.biome.key),
    });
  }

  setAlgorithm(algorithm: string): void {
    this.algorithm = algorithm;
  }

  // Simple seeded random number generator
  random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  generate(
    width: number,
    height: number,
    terrainVariety: number,
    poiFrequency: number
  ): MapGenerationResult {
    logger.mapgen.time('full-map-generation');

    // Initialize regions first
    this.initializeRegions(width, height);

    const grid: Grid = [];

    // Generate base terrain using region-aware algorithm
    logger.mapgen.time('terrain-generation');
    for (let row = 0; row < height; row++) {
      grid[row] = [];
      for (let col = 0; col < width; col++) {
        const terrainType = this.generateRegionBasedTerrain(
          col,
          row,
          width,
          height,
          terrainVariety
        );

        grid[row][col] = {
          terrain: terrainType,
          poi: null,
          weather: null, // Will be set by weather system
          elevation: 0, // Will be set during generation
          regionId: this.hexToRegion!.get(`${col},${row}`),
        };
      }
    }
    logger.mapgen.timeEnd('terrain-generation');

    // Generate rivers
    this.generateRivers(grid, width, height, terrainVariety);

    // Apply regional weather to all hexes
    this.applyRegionalWeather(grid, width, height);

    // Generate POIs with smart placement and CR scaling
    this.generateSmartPOIs(grid, width, height, poiFrequency);

    logger.mapgen.timeEnd('full-map-generation');

    return {
      grid,
      regions: this.regions,
      hexToRegion: this.hexToRegion,
      weatherSystem: this.weatherSystem,
    };
  }

  generateTerrain(
    x: number,
    y: number,
    width: number,
    height: number,
    variety: number
  ): TerrainType {
    // Scale controls the zoom level (higher = more zoomed out)
    const scale = variety * 3;

    // Use selected algorithm
    const algorithmName = TerrainAlgorithms.getAlgorithm(this.algorithm);

    // terrainAlgorithms operates on a generic terrain map and is dispatched by
    // name; cast through this dynamic boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const algos = this.terrainAlgorithms as any;
    if (this.algorithm === 'island') {
      return algos.islandTerrain(x, y, width, height, scale, this.terrainTypes);
    }
    return algos[algorithmName](x, y, scale, this.terrainTypes);
  }

  generatePOI(frequency: number): POITypeWeight | null {
    if (this.random() * 100 > frequency) {
      return null;
    }

    const totalWeight = this.poiTypes.reduce((sum, poi) => sum + poi.weight, 0);
    let rand = this.random() * totalWeight;

    for (const poi of this.poiTypes) {
      rand -= poi.weight;
      if (rand <= 0) {
        return { ...poi };
      }
    }

    return null;
  }

  generateRegionBasedTerrain(
    col: number,
    row: number,
    width: number,
    height: number,
    variety: number
  ): TerrainType {
    // Hard-radius grassland lock: any hex within 3 of the player start is
    // always open grassland, guaranteeing a safe, passable starting area.
    const startCol = this.startCol ?? GAME_DEFAULTS.START_POSITION.col;
    const startRow = this.startRow ?? GAME_DEFAULTS.START_POSITION.row;
    if (getHexDistance(col, row, startCol, startRow) <= 3) {
      return this.terrainTypes.grassland;
    }

    const regionId = this.hexToRegion!.get(`${col},${row}`);
    if (regionId === undefined) {
      // Fallback to old algorithm if no region
      return this.generateTerrain(col, row, width, height, variety);
    }

    const region = this.regions[regionId];
    const distanceFromCenter = getHexDistance(col, row, region.centerHex.col, region.centerHex.row);
    const edgeFactor = distanceFromCenter / region.radius;

    // Use noise for local elevation variation
    const scale = variety * 3;
    const localElevation = this.noise.octaveNoise2D(col / scale, row / scale, 3, 0.5, 2.0);
    const normalizedElevation = (localElevation + 1) / 2;

    // Select terrain based on region biome and local variation
    return this.selectTerrainForRegion(region, normalizedElevation, edgeFactor, col, row);
  }

  selectTerrainForRegion(
    region: Region,
    elevation: number,
    edgeFactor: number,
    col: number,
    row: number
  ): TerrainType {
    const biomeTypes = region.biome.biomes;

    // Core region (< 40% of radius)
    if (edgeFactor < 0.4) {
      return this.selectByElevation(biomeTypes, elevation, 'core');
    }

    // Mid region (40-70% of radius)
    if (edgeFactor < 0.7) {
      return this.selectByElevation(biomeTypes, elevation, 'mid');
    }

    // Edge region - blend with neighbors
    const neighborRegions = this.regionGenerator!.getNeighborRegions(col, row, this.hexToRegion!);

    if (neighborRegions.length > 1) {
      // Blend with neighboring region biomes
      const allBiomes = new Set<string>([...biomeTypes]);
      neighborRegions.forEach(nrId => {
        if (nrId !== this.hexToRegion!.get(`${col},${row}`)) {
          const nr = this.regions[nrId];
          nr.biome.biomes.forEach(b => allBiomes.add(b));
        }
      });
      return this.selectByElevation(Array.from(allBiomes), elevation, 'edge');
    }

    return this.selectByElevation(biomeTypes, elevation, 'edge');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectByElevation(biomeTypes: string[], elevation: number, zone: string): TerrainType {
    // Map biome types to elevation preferences
    const elevationMap: Record<string, number[]> = {
      water: [0, 0.2],
      swamp: [0.15, 0.35],
      grassland: [0.25, 0.55],
      forest: [0.35, 0.65],
      desert: [0.3, 0.6],
      hills: [0.5, 0.75],
      mountains: [0.65, 0.9],
      tundra: [0.7, 1.0],
    };

    // Filter biome types to those matching current elevation
    const suitable = biomeTypes.filter(type => {
      const range = elevationMap[type];
      if (!range) return false;
      return elevation >= range[0] && elevation <= range[1];
    });

    if (suitable.length === 0) {
      // Fallback: pick closest match
      let bestType = biomeTypes[0];
      let bestDist = Infinity;

      biomeTypes.forEach(type => {
        const range = elevationMap[type];
        if (range) {
          const mid = (range[0] + range[1]) / 2;
          const dist = Math.abs(elevation - mid);
          if (dist < bestDist) {
            bestDist = dist;
            bestType = type;
          }
        }
      });

      return this.terrainTypes[bestType] || this.terrainTypes.grassland;
    }

    // Pick random from suitable types
    const selectedType = suitable[Math.floor(this.random() * suitable.length)];
    return this.terrainTypes[selectedType] || this.terrainTypes.grassland;
  }

  applyRegionalWeather(grid: Grid, width: number, height: number): void {
    logger.mapgen.time('weather-application');

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const weather = this.weatherSystem!.getWeatherForHex(col, row, this.hexToRegion!);

        // Convert new weather format to old format for compatibility
        grid[row][col].weather = {
          condition: weather.name,
          effect: this.formatWeatherEffect(weather),
        };
      }
    }

    logger.mapgen.timeEnd('weather-application');
  }

  formatWeatherEffect(weather: WeatherType): string {
    const effects: string[] = [];
    const e = weather.effects;
    const visibility = e.visibility;
    const movementCost = e.movementCost;
    // temperature/description are optional extras carried via the effects index signature
    const temperature = e.temperature as number | undefined;
    const description = e.description as string | undefined;

    if (visibility !== 0) {
      effects.push(`Visibility ${visibility > 0 ? '+' : ''}${visibility}`);
    }
    if (movementCost !== 0) {
      effects.push(`Movement +${movementCost}`);
    }
    if (temperature) {
      effects.push(`Temp ${temperature > 0 ? '+' : ''}${temperature}°C`);
    }
    if (description) {
      effects.push(description);
    }

    return effects.length > 0 ? effects.join(', ') : 'Normal conditions';
  }

  /**
   * Get weather for a single hex in the {condition, effect} format used by the map.
   * Used by the infinite terrain expansion path (poiGenerationHelper.generateHex)
   * so newly revealed hexes get biome-coherent weather instead of per-terrain lookups.
   * Falls back to clear skies if the weather system is not yet initialised.
   */
  getWeatherForHex(col: number, row: number): HexWeather {
    if (!this.weatherSystem || !this.hexToRegion) {
      return { condition: 'Clear Skies', effect: 'Normal conditions' };
    }
    const weather = this.weatherSystem.getWeatherForHex(col, row, this.hexToRegion);
    return {
      condition: weather.name,
      effect: this.formatWeatherEffect(weather),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateRivers(grid: Grid, width: number, height: number, terrainVariety: number): void {
    // Number of rivers based on map size
    const numRivers = Math.floor((width * height) / 100) + 2;
    this.riverGenerator.generateRivers(grid, width, height, numRivers, () => this.random());

    // Normalise river terrain objects — weather is applied later by applyRegionalWeather()
    // so all rivers get biome-coherent weather rather than per-terrain string lookups.
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (grid[row][col].terrain.name === 'River') {
          grid[row][col].terrain = this.terrainTypes.river;
        }
      }
    }
  }

  generateSmartPOIs(
    grid: Grid,
    width: number,
    height: number,
    baseFrequency: number,
    startCol = 10,
    startRow = 7
  ): void {
    // Find suitable settlement locations (shared by all tiers)
    const settlementLocations = this.findSettlementLocations(grid, width, height);

    const totalHexes = width * height;

    // Calculate numbers for each settlement tier (independent spawn rates)
    const numCamps = Math.floor((10 / 100) * totalHexes * 0.1);
    const numVillages = Math.floor((5 / 100) * totalHexes * 0.1);
    const numTowns = Math.floor((2.5 / 100) * totalHexes * 0.1);
    const numCities = Math.floor((1.25 / 100) * totalHexes * 0.1);
    const numMetropolises = Math.floor((0.625 / 100) * totalHexes * 0.1);

    let locationIndex = 0;

    // Place metropolises first (best locations)
    for (let i = 0; i < numMetropolises && locationIndex < settlementLocations.length; i++) {
      const loc = settlementLocations[locationIndex++];
      grid[loc.row][loc.col].poi = this.poiSystem.generatePOI(
        POI_TYPES.METROPOLIS,
        loc.col,
        loc.row,
        grid[loc.row][loc.col].terrain,
        startCol,
        startRow,
        () => this.random()
      );
    }

    // Place cities (next best locations)
    for (let i = 0; i < numCities && locationIndex < settlementLocations.length; i++) {
      const loc = settlementLocations[locationIndex++];
      grid[loc.row][loc.col].poi = this.poiSystem.generatePOI(
        POI_TYPES.CITY,
        loc.col,
        loc.row,
        grid[loc.row][loc.col].terrain,
        startCol,
        startRow,
        () => this.random()
      );
    }

    // Place towns
    for (let i = 0; i < numTowns && locationIndex < settlementLocations.length; i++) {
      const loc = settlementLocations[locationIndex++];
      grid[loc.row][loc.col].poi = this.poiSystem.generatePOI(
        POI_TYPES.TOWN,
        loc.col,
        loc.row,
        grid[loc.row][loc.col].terrain,
        startCol,
        startRow,
        () => this.random()
      );
    }

    // Place villages
    for (let i = 0; i < numVillages && locationIndex < settlementLocations.length; i++) {
      const loc = settlementLocations[locationIndex++];
      grid[loc.row][loc.col].poi = this.poiSystem.generatePOI(
        POI_TYPES.VILLAGE,
        loc.col,
        loc.row,
        grid[loc.row][loc.col].terrain,
        startCol,
        startRow,
        () => this.random()
      );
    }

    // Place camps (remaining good locations + random spots)
    for (let i = 0; i < numCamps; i++) {
      let col, row;

      // First half from scored locations, second half random
      if (i < numCamps / 2 && locationIndex < settlementLocations.length) {
        const loc = settlementLocations[locationIndex++];
        col = loc.col;
        row = loc.row;
      } else {
        // Random placement for camps (can be anywhere habitable)
        col = Math.floor(this.random() * width);
        row = Math.floor(this.random() * height);

        // Skip if already has POI or is water/river
        const terrainName = grid[row][col].terrain.name;
        if (grid[row][col].poi || terrainName === 'Water' || terrainName === 'River') {
          continue;
        }

        // Skip if not on habitable terrain
        if (terrainName !== 'Grassland' && terrainName !== 'Forest' && terrainName !== 'Hills') {
          continue;
        }
      }

      grid[row][col].poi = this.poiSystem.generatePOI(
        POI_TYPES.CAMP,
        col,
        row,
        grid[row][col].terrain,
        startCol,
        startRow,
        () => this.random()
      );
    }

    // Calculate number of other POIs (same as before)
    const numEncounters = Math.floor((baseFrequency / 100) * width * height * 0.3);
    const numPassivePOIs = Math.floor((baseFrequency / 100) * width * height * 0.2);

    // Place random encounters
    for (let i = 0; i < numEncounters; i++) {
      const col = Math.floor(this.random() * width);
      const row = Math.floor(this.random() * height);

      // Skip if already has POI or is water/river
      const terrainName = grid[row][col].terrain.name;
      if (grid[row][col].poi || terrainName === 'Water' || terrainName === 'River') {
        continue;
      }

      // Generate encounter
      grid[row][col].poi = this.poiSystem.generatePOI(
        POI_TYPES.ENCOUNTER,
        col,
        row,
        grid[row][col].terrain,
        startCol,
        startRow,
        () => this.random()
      );
    }

    // Place passive POIs (dungeons, shrines, ruins, caves, towers)
    for (let i = 0; i < numPassivePOIs; i++) {
      const col = Math.floor(this.random() * width);
      const row = Math.floor(this.random() * height);

      // Skip if already has POI or is water/river
      const terrainName = grid[row][col].terrain.name;
      if (grid[row][col].poi || terrainName === 'Water' || terrainName === 'River') {
        continue;
      }

      // Get appropriate POI types for this terrain
      const suitableTypes = this.poiSystem.getPOITypesForTerrain(grid[row][col].terrain);
      // Filter out encounters and all settlement types
      const passiveTypes = suitableTypes.filter(
        t =>
          t !== POI_TYPES.ENCOUNTER &&
          t !== POI_TYPES.CAMP &&
          t !== POI_TYPES.VILLAGE &&
          t !== POI_TYPES.TOWN &&
          t !== POI_TYPES.CITY &&
          t !== POI_TYPES.METROPOLIS
      );

      if (passiveTypes.length > 0) {
        // Select random passive POI type
        const poiType = passiveTypes[Math.floor(this.random() * passiveTypes.length)];

        grid[row][col].poi = this.poiSystem.generatePOI(
          poiType,
          col,
          row,
          grid[row][col].terrain,
          startCol,
          startRow,
          () => this.random()
        );
      }
    }
  }

  findSettlementLocations(grid: Grid, width: number, height: number): SettlementLocation[] {
    const locations: SettlementLocation[] = [];

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const score = this.scoreSettlementLocation(grid, width, height, row, col);
        if (score > 0) {
          locations.push({ row, col, score });
        }
      }
    }

    // Sort by score (best first)
    locations.sort((a, b) => b.score - a.score);
    return locations;
  }

  scoreSettlementLocation(
    grid: Grid,
    width: number,
    height: number,
    row: number,
    col: number
  ): number {
    const terrain = grid[row][col].terrain.name;
    let score = 0;

    // Never build on water or rivers
    if (terrain === 'Water' || terrain === 'River') return 0;

    // Preferred terrains
    if (terrain === 'Grassland') score += 10;
    else if (terrain === 'Forest') score += 7;
    else if (terrain === 'Hills') score += 5;
    else return 0; // Don't build on other terrains

    // Check neighbors for rivers (very important)
    const neighbors = this.riverGenerator.getNeighbors(row, col, width, height);
    let hasRiver = false;
    let hasWater = false;

    for (const n of neighbors) {
      const neighborTerrain = grid[n.row][n.col].terrain.name;
      if (neighborTerrain === 'River') {
        hasRiver = true;
        score += 15;
      }
      if (neighborTerrain === 'Water') {
        hasWater = true;
        score += 8;
      }
    }

    // Bonus for being near both river and diverse terrain
    if (hasRiver || hasWater) {
      score += 5;
    }

    // Check for variety in nearby terrain (resources)
    const terrainTypes = new Set<string>();
    for (const n of neighbors) {
      terrainTypes.add(grid[n.row][n.col].terrain.name);
    }
    score += terrainTypes.size * 2;

    return score;
  }

  selectPOIForTerrain(terrain: TerrainType, poiTypes: POITypeWeight[]): POITypeWeight | null {
    const terrainName = terrain.name;

    // Terrain-appropriate POIs
    const preferences: Record<string, string[]> = {
      Mountains: ['Cave', 'Tower', 'Ruins'],
      Hills: ['Tower', 'Ruins', 'Camp'],
      Forest: ['Shrine', 'Camp', 'Ruins'],
      Swamp: ['Ruins', 'Shrine'],
      Desert: ['Ruins', 'Camp'],
      Tundra: ['Cave', 'Camp'],
    };

    const preferred = preferences[terrainName] || ['Camp', 'Shrine'];

    // Filter to preferred types
    const suitable = poiTypes.filter(p => preferred.includes(p.name));

    if (suitable.length === 0) return null;

    // Weighted random selection
    const totalWeight = suitable.reduce((sum, poi) => sum + poi.weight, 0);
    let rand = this.random() * totalWeight;

    for (const poi of suitable) {
      rand -= poi.weight;
      if (rand <= 0) {
        return poi;
      }
    }

    return suitable[0];
  }

  getTerrainTypes(): Record<string, TerrainType> {
    return this.terrainTypes;
  }
}
