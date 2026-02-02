import { PerlinNoise, SimpleNoise } from './noise.js';
import { TerrainAlgorithms } from './terrainAlgorithms.js';
import { RiverGenerator } from './riverGenerator.js';
import { POISystem, POI_TYPES } from './poiSystem.js';
import { RegionGenerator } from './RegionGenerator.js';
import { WeatherSystem } from './WeatherSystem.js';
import logger from './utils/logger.js';

export class TerrainGenerator {
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

    this.weatherTypes = {
      river: [
        { condition: 'Clear skies', effect: 'Calm waters' },
        { condition: 'Light rain', effect: 'Faster current' },
        { condition: 'Heavy rain', effect: 'Dangerous current, flooding risk' },
        { condition: 'Fog', effect: 'Poor visibility on water' },
        { condition: 'Storm', effect: 'Very dangerous crossing' },
      ],
      grassland: [
        { condition: 'Clear skies', effect: 'Normal visibility' },
        { condition: 'Light clouds', effect: 'Normal visibility' },
        { condition: 'Overcast', effect: 'Slightly reduced visibility' },
        { condition: 'Light rain', effect: 'Reduced visibility, muddy ground' },
        { condition: 'Heavy rain', effect: 'Poor visibility, difficult terrain' },
        { condition: 'Thunderstorm', effect: 'Very poor visibility, dangerous' },
        { condition: 'Fog', effect: 'Heavily reduced visibility' },
        { condition: 'Wind', effect: 'Ranged attacks disadvantage' },
      ],
      forest: [
        { condition: 'Clear skies', effect: 'Normal visibility' },
        { condition: 'Misty', effect: 'Reduced visibility' },
        { condition: 'Light rain', effect: 'Slippery terrain' },
        { condition: 'Heavy rain', effect: 'Difficult terrain, poor visibility' },
        { condition: 'Dense fog', effect: 'Heavily reduced visibility' },
        { condition: 'Drizzle', effect: 'Slightly reduced visibility' },
      ],
      hills: [
        { condition: 'Clear skies', effect: 'Excellent visibility' },
        { condition: 'Windy', effect: 'Ranged attacks disadvantage' },
        { condition: 'Light rain', effect: 'Slippery slopes' },
        { condition: 'Heavy rain', effect: 'Dangerous slopes, poor visibility' },
        { condition: 'Fog patches', effect: 'Variable visibility' },
        { condition: 'Storm', effect: 'Very dangerous, seek shelter' },
      ],
      mountains: [
        { condition: 'Clear skies', effect: 'Excellent visibility, cold' },
        { condition: 'Strong winds', effect: 'Difficult climbing, ranged penalty' },
        { condition: 'Snow flurries', effect: 'Reduced visibility, cold' },
        { condition: 'Blizzard', effect: 'Very poor visibility, extreme cold' },
        { condition: 'Hail', effect: 'Dangerous, take cover' },
        { condition: 'Avalanche risk', effect: 'Loud noises dangerous' },
      ],
      desert: [
        { condition: 'Clear skies', effect: 'Extreme heat, water consumption x2' },
        { condition: 'Scorching heat', effect: 'Exhaustion risk, water x3' },
        { condition: 'Dust storm', effect: 'Poor visibility, difficult breathing' },
        { condition: 'Hot wind', effect: 'Increased heat, reduced visibility' },
        { condition: 'Mirage', effect: 'Navigation difficulty' },
        { condition: 'Cold night', effect: 'Extreme temperature drop' },
      ],
      swamp: [
        { condition: 'Humid', effect: 'Exhaustion risk' },
        { condition: 'Dense fog', effect: 'Heavily reduced visibility' },
        { condition: 'Light rain', effect: 'Even wetter terrain' },
        { condition: 'Heavy rain', effect: 'Flooding, difficult terrain' },
        { condition: 'Mist', effect: 'Reduced visibility' },
        { condition: 'Pestilent air', effect: 'Disease risk increased' },
      ],
      water: [
        { condition: 'Calm seas', effect: 'Normal sailing' },
        { condition: 'Light waves', effect: 'Normal sailing' },
        { condition: 'Choppy waters', effect: 'Slower sailing' },
        { condition: 'Storm', effect: 'Dangerous sailing, seek port' },
        { condition: 'Heavy fog', effect: 'Navigation difficulty' },
        { condition: 'Hurricane', effect: 'Extreme danger, capsize risk' },
      ],
      tundra: [
        { condition: 'Clear and cold', effect: 'Extreme cold, frostbite risk' },
        { condition: 'Light snow', effect: 'Reduced visibility, cold' },
        { condition: 'Heavy snow', effect: 'Poor visibility, difficult terrain' },
        { condition: 'Blizzard', effect: 'Whiteout conditions, extreme cold' },
        { condition: 'Ice wind', effect: 'Severe cold, ranged penalty' },
        { condition: 'Aurora', effect: 'Beautiful, normal conditions' },
      ],
    };

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

  setSeed(seed) {
    this.seed = seed ? parseInt(seed) : Date.now();
    this.noise.setSeed(this.seed);
  }

  initializeRegions(width, height) {
    logger.mapgen.info('Initializing region-based generation', { width, height, seed: this.seed });
    this.regionGenerator = new RegionGenerator(this.seed, width, height);
    const { regions, hexToRegion } = this.regionGenerator.generate();
    this.regions = regions;
    this.hexToRegion = hexToRegion;

    // Initialize weather system
    this.weatherSystem = new WeatherSystem(this.regions, this.seed + 1000);
    this.weatherSystem.initializeWeather();

    logger.mapgen.info('Regions initialized', {
      count: regions.length,
      types: regions.map(r => r.biome.key),
    });
  }

  setAlgorithm(algorithm) {
    this.algorithm = algorithm;
  }

  // Simple seeded random number generator
  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  generate(width, height, terrainVariety, poiFrequency) {
    logger.mapgen.time('full-map-generation');

    // Initialize regions first
    this.initializeRegions(width, height);

    const grid = [];

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
          regionId: this.hexToRegion.get(`${col},${row}`),
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

  generateTerrain(x, y, width, height, variety) {
    // Scale controls the zoom level (higher = more zoomed out)
    const scale = variety * 3;

    // Use selected algorithm
    const algorithmName = TerrainAlgorithms.getAlgorithm(this.algorithm);

    if (this.algorithm === 'island') {
      return this.terrainAlgorithms.islandTerrain(x, y, width, height, scale, this.terrainTypes);
    } else {
      return this.terrainAlgorithms[algorithmName](x, y, scale, this.terrainTypes);
    }
  }

  generatePOI(frequency) {
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

  generateRegionBasedTerrain(col, row, width, height, variety) {
    const regionId = this.hexToRegion.get(`${col},${row}`);
    if (regionId === undefined) {
      // Fallback to old algorithm if no region
      return this.generateTerrain(col, row, width, height, variety);
    }

    const region = this.regions[regionId];
    const distanceFromCenter = this.regionGenerator.hexDistance(
      col,
      row,
      region.centerHex.col,
      region.centerHex.row
    );
    const edgeFactor = distanceFromCenter / region.radius;

    // Use noise for local elevation variation
    const scale = variety * 3;
    const localElevation = this.noise.octaveNoise2D(col / scale, row / scale, 3, 0.5, 2.0);
    const normalizedElevation = (localElevation + 1) / 2;

    // Select terrain based on region biome and local variation
    return this.selectTerrainForRegion(region, normalizedElevation, edgeFactor, col, row);
  }

  selectTerrainForRegion(region, elevation, edgeFactor, col, row) {
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
    const neighborRegions = this.regionGenerator.getNeighborRegions(col, row, this.hexToRegion);

    if (neighborRegions.length > 1) {
      // Blend with neighboring region biomes
      const allBiomes = new Set([...biomeTypes]);
      neighborRegions.forEach(nrId => {
        if (nrId !== this.hexToRegion.get(`${col},${row}`)) {
          const nr = this.regions[nrId];
          nr.biome.biomes.forEach(b => allBiomes.add(b));
        }
      });
      return this.selectByElevation(Array.from(allBiomes), elevation, 'edge');
    }

    return this.selectByElevation(biomeTypes, elevation, 'edge');
  }

  selectByElevation(biomeTypes, elevation, zone) {
    // Map biome types to elevation preferences
    const elevationMap = {
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

  applyRegionalWeather(grid, width, height) {
    logger.mapgen.time('weather-application');

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const weather = this.weatherSystem.getWeatherForHex(col, row, this.hexToRegion);

        // Convert new weather format to old format for compatibility
        grid[row][col].weather = {
          condition: weather.name,
          effect: this.formatWeatherEffect(weather),
        };
      }
    }

    logger.mapgen.timeEnd('weather-application');
  }

  formatWeatherEffect(weather) {
    const effects = [];

    if (weather.effects.visibility !== 0) {
      effects.push(
        `Visibility ${weather.effects.visibility > 0 ? '+' : ''}${weather.effects.visibility}`
      );
    }
    if (weather.effects.movementCost !== 0) {
      effects.push(`Movement +${weather.effects.movementCost}`);
    }
    if (weather.effects.temperature) {
      effects.push(
        `Temp ${weather.effects.temperature > 0 ? '+' : ''}${weather.effects.temperature}°C`
      );
    }
    if (weather.effects.description) {
      effects.push(weather.effects.description);
    }

    return effects.length > 0 ? effects.join(', ') : 'Normal conditions';
  }

  generateWeather(terrain) {
    const terrainKey = Object.keys(this.terrainTypes).find(
      key => this.terrainTypes[key] === terrain
    );

    const weatherOptions = this.weatherTypes[terrainKey] || this.weatherTypes.grassland;
    const index = Math.floor(this.random() * weatherOptions.length);

    return weatherOptions[index];
  }

  generateRivers(grid, width, height, terrainVariety) {
    // Number of rivers based on map size
    const numRivers = Math.floor((width * height) / 100) + 2;
    this.riverGenerator.generateRivers(grid, width, height, numRivers, () => this.random());

    // Update river terrain references
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (grid[row][col].terrain.name === 'River') {
          grid[row][col].terrain = this.terrainTypes.river;
          grid[row][col].weather = this.generateWeather(this.terrainTypes.river);
        }
      }
    }
  }

  generateSmartPOIs(grid, width, height, baseFrequency, startCol = 10, startRow = 7) {
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

  findSettlementLocations(grid, width, height) {
    const locations = [];

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

  scoreSettlementLocation(grid, width, height, row, col) {
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
    const terrainTypes = new Set();
    for (const n of neighbors) {
      terrainTypes.add(grid[n.row][n.col].terrain.name);
    }
    score += terrainTypes.size * 2;

    return score;
  }

  selectPOIForTerrain(terrain, poiTypes) {
    const terrainName = terrain.name;

    // Terrain-appropriate POIs
    const preferences = {
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

  getTerrainTypes() {
    return this.terrainTypes;
  }
}
