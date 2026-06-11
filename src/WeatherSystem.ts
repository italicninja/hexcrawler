import logger from './utils/logger';

interface WeatherEffects {
  visibility: number;
  movementCost: number;
  skillChecks: Record<string, number>;
  // Some weather types carry extra effects (damage, temperature, description, etc.)
  [key: string]: unknown;
}

export interface WeatherType {
  key: string;
  name: string;
  intensity: number;
  effects: WeatherEffects;
}

interface Position {
  col: number;
  row: number;
}

interface Movement {
  dx: number;
  dy: number;
}

/** Loose shape for the region objects WeatherSystem reads/mutates. */
interface WeatherRegion {
  id: string;
  centerHex: { col: number; row: number };
  biome: { key: string; weatherTable: Record<string, number> };
  weatherPattern: WeatherType | null;
}

interface WeatherFrontJSON {
  type: string;
  position: Position;
  radius: number;
  duration: number;
  movement: Movement;
}

/**
 * Weather type definitions with gameplay effects
 */
export const WEATHER_TYPES: Record<string, WeatherType> = {
  // Clear/Neutral
  CLEAR: {
    key: 'clear',
    name: 'Clear Skies',
    intensity: 0,
    effects: {
      visibility: 0,
      movementCost: 0,
      skillChecks: {},
    },
  },

  // Rain variants
  LIGHT_RAIN: {
    key: 'light_rain',
    name: 'Light Rain',
    intensity: 2,
    effects: {
      visibility: -1,
      movementCost: 0.5,
      skillChecks: { perception: -1 },
    },
  },
  RAIN: {
    key: 'rain',
    name: 'Rain',
    intensity: 4,
    effects: {
      visibility: -2,
      movementCost: 1,
      skillChecks: { perception: -2, survival: -1 },
    },
  },
  HEAVY_RAIN: {
    key: 'heavy_rain',
    name: 'Heavy Rain',
    intensity: 6,
    effects: {
      visibility: -4,
      movementCost: 2,
      skillChecks: { perception: -4, survival: -2 },
    },
  },
  STORM: {
    key: 'storm',
    name: 'Storm',
    intensity: 8,
    effects: {
      visibility: -6,
      movementCost: 3,
      skillChecks: { perception: -6, survival: -3 },
      damage: { type: 'lightning', description: 'Risk of lightning strikes' },
    },
  },

  // Snow variants
  LIGHT_SNOW: {
    key: 'light_snow',
    name: 'Light Snow',
    intensity: 2,
    effects: {
      visibility: -1,
      movementCost: 0.5,
      skillChecks: { perception: -1 },
      temperature: -5,
    },
  },
  SNOW: {
    key: 'snow',
    name: 'Snow',
    intensity: 4,
    effects: {
      visibility: -3,
      movementCost: 2,
      skillChecks: { perception: -3, survival: -2 },
      temperature: -10,
    },
  },
  BLIZZARD: {
    key: 'blizzard',
    name: 'Blizzard',
    intensity: 9,
    effects: {
      visibility: -8,
      movementCost: 4,
      skillChecks: { perception: -8, survival: -4 },
      temperature: -20,
      damage: { type: 'cold', description: '1d4 cold damage per hour' },
    },
  },

  // Fog/Mist
  MIST: {
    key: 'mist',
    name: 'Mist',
    intensity: 1,
    effects: {
      visibility: -2,
      movementCost: 0,
      skillChecks: { perception: -2 },
    },
  },
  FOG: {
    key: 'fog',
    name: 'Fog',
    intensity: 3,
    effects: {
      visibility: -5,
      movementCost: 1,
      skillChecks: { perception: -5, survival: -2 },
    },
  },
  DENSE_FOG: {
    key: 'dense_fog',
    name: 'Dense Fog',
    intensity: 5,
    effects: {
      visibility: -8,
      movementCost: 2,
      skillChecks: { perception: -8, survival: -3 },
    },
  },

  // Wind
  WIND: {
    key: 'wind',
    name: 'Strong Winds',
    intensity: 4,
    effects: {
      visibility: -1,
      movementCost: 1,
      skillChecks: { perception: -2 },
      rangedAttackDisadvantage: true,
    },
  },

  // Desert
  SANDSTORM: {
    key: 'sandstorm',
    name: 'Sandstorm',
    intensity: 7,
    effects: {
      visibility: -7,
      movementCost: 3,
      skillChecks: { perception: -7, survival: -4 },
      damage: { type: 'sand', description: 'Difficult breathing, 1d4 damage per hour' },
    },
  },
  HEATWAVE: {
    key: 'heatwave',
    name: 'Heat Wave',
    intensity: 5,
    effects: {
      visibility: -1,
      movementCost: 1,
      skillChecks: { constitution: -2 },
      temperature: 15,
      waterConsumption: 3, // Triple water consumption
    },
  },

  // Special
  AURORA: {
    key: 'aurora',
    name: 'Aurora',
    intensity: 0,
    effects: {
      visibility: 2, // Actually improves visibility at night
      movementCost: 0,
      skillChecks: {},
      description: 'Beautiful aurora borealis lights up the sky',
    },
  },
};

/**
 * Weather front - a moving weather pattern that affects multiple regions
 */
class WeatherFront {
  type: string;
  position: Position;
  radius: number;
  duration: number;
  movement: Movement;
  weather: WeatherType;
  random: () => number;

  constructor(
    type: string,
    position: Position,
    radius: number,
    duration: number,
    movement: Movement,
    random: () => number
  ) {
    this.type = type;
    this.position = { ...position };
    this.radius = radius;
    this.duration = duration; // hours
    this.movement = { ...movement }; // hexes per hour
    this.weather = WEATHER_TYPES[type];
    this.random = random;
  }

  /**
   * Move the front based on elapsed time
   */
  move(hours: number): void {
    this.position.col += this.movement.dx * hours;
    this.position.row += this.movement.dy * hours;
    this.duration -= hours;
  }

  /**
   * Check if front affects a position
   */
  affects(col: number, row: number): boolean {
    const dx = this.position.col - col;
    const dy = this.position.row - row;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius;
  }

  /**
   * Check if front is expired
   */
  isExpired(): boolean {
    return this.duration <= 0;
  }
}

/**
 * WeatherSystem - Manages regional weather patterns and fronts
 */
export class WeatherSystem {
  regions: WeatherRegion[];
  seed: number;
  seedCounter: number;
  mapWidth: number;
  mapHeight: number;
  weatherFronts: WeatherFront[];
  lastUpdateTime: number;
  lastEvolutionTime: number;

  constructor(regions: WeatherRegion[], seed: number, mapWidth = 50, mapHeight = 30) {
    this.regions = regions;
    this.seed = seed;
    this.seedCounter = seed;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.weatherFronts = [];
    this.lastUpdateTime = 0; // Game time in hours
    this.lastEvolutionTime = 0; // Tracks when natural weather last evolved
  }

  /**
   * Seeded random number generator
   */
  random(): number {
    const x = Math.sin(this.seedCounter++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Initialize weather for all regions
   */
  initializeWeather(): void {
    logger.general.time('weather-init');
    logger.general.info('Initializing regional weather', { regions: this.regions.length });

    this.regions.forEach(region => {
      const weather = this.rollWeatherForRegion(region);
      region.weatherPattern = weather;
      logger.general.debug('Region weather set', {
        regionId: region.id,
        biome: region.biome.key,
        weather: weather.key,
      });
    });

    // Spawn initial weather fronts (10% chance per region)
    const initialFronts = Math.floor(this.regions.length * 0.1);
    for (let i = 0; i < initialFronts; i++) {
      this.spawnWeatherFront();
    }

    logger.general.timeEnd('weather-init');
  }

  /**
   * Roll weather for a region based on its biome weather table
   */
  rollWeatherForRegion(region: WeatherRegion): WeatherType {
    const weatherTable = region.biome.weatherTable;
    const roll = this.random();
    let cumulative = 0;

    for (const [weatherKey, probability] of Object.entries(weatherTable)) {
      cumulative += probability;
      if (roll < cumulative) {
        return this.getWeatherByKey(weatherKey);
      }
    }

    // Fallback to clear
    return WEATHER_TYPES.CLEAR;
  }

  /**
   * Get weather type by key (handles aliases)
   */
  getWeatherByKey(key: string): WeatherType {
    // Handle common aliases
    const aliases: Record<string, string> = {
      clear: 'CLEAR',
      rain: 'RAIN',
      storm: 'STORM',
      snow: 'SNOW',
      blizzard: 'BLIZZARD',
      fog: 'FOG',
      mist: 'MIST',
      wind: 'WIND',
      sandstorm: 'SANDSTORM',
      heatwave: 'HEATWAVE',
      aurora: 'AURORA',
    };

    const weatherKey = aliases[key] || key.toUpperCase();
    return WEATHER_TYPES[weatherKey] || WEATHER_TYPES.CLEAR;
  }

  /**
   * Advance weather simulation by hours
   */
  advanceTime(hours: number): void {
    if (hours <= 0) return;

    logger.general.debug('Advancing weather', { hours, currentTime: this.lastUpdateTime });

    // Move existing fronts
    this.weatherFronts.forEach(front => front.move(hours));

    // Remove expired fronts
    const expiredCount = this.weatherFronts.filter(f => f.isExpired()).length;
    this.weatherFronts = this.weatherFronts.filter(f => !f.isExpired());

    if (expiredCount > 0) {
      logger.general.debug('Weather fronts expired', { count: expiredCount });
    }

    // Chance to spawn new fronts (scaled by time)
    const spawnChance = 0.05 * hours; // 5% chance per hour
    if (this.random() < spawnChance) {
      this.spawnWeatherFront();
    }

    // Update regional weather based on fronts
    this.updateRegionalWeather();

    // Natural weather evolution every 6 hours — compare elapsed time rather
    // than using modulo on lastUpdateTime, which breaks for non-unit step sizes.
    this.lastUpdateTime += hours;
    if (this.lastUpdateTime - this.lastEvolutionTime >= 6) {
      this.evolveNaturalWeather();
      this.lastEvolutionTime = this.lastUpdateTime;
    }
  }

  /**
   * Pick a weather front type from a region's biome weather table.
   * This ensures fronts feel climatically appropriate for their origin region —
   * sandstorms only spawn near deserts, blizzards near arctic/alpine, etc.
   */
  pickFrontTypeFromRegion(region: WeatherRegion): string {
    const weatherTable = region.biome.weatherTable;
    const roll = this.random();
    let cumulative = 0;

    for (const [weatherKey, probability] of Object.entries(weatherTable)) {
      cumulative += probability;
      if (roll < cumulative) {
        // Map the biome weather key to a WEATHER_TYPES key via the same alias
        // lookup used by rollWeatherForRegion, then return the string key for
        // WeatherFront construction (which expects the WEATHER_TYPES key name).
        const aliases: Record<string, string> = {
          clear: 'CLEAR',
          rain: 'RAIN',
          storm: 'STORM',
          snow: 'SNOW',
          blizzard: 'BLIZZARD',
          fog: 'FOG',
          mist: 'MIST',
          wind: 'WIND',
          sandstorm: 'SANDSTORM',
          heatwave: 'HEATWAVE',
          aurora: 'AURORA',
        };
        const resolved = aliases[weatherKey] || weatherKey.toUpperCase();
        // Only use types that exist as WeatherFront-capable entries (skip CLEAR/AURORA
        // as standalone fronts — they're cosmetic and don't need a moving mass).
        if (resolved === 'CLEAR' || resolved === 'AURORA') return 'LIGHT_RAIN';
        return resolved;
      }
    }
    return 'RAIN';
  }

  /**
   * Find the region whose center is nearest to a given position.
   * Used to pick a biome-appropriate front type when spawning from a map edge.
   */
  nearestRegionTo(col: number, row: number): WeatherRegion {
    let nearest = this.regions[0];
    let minDist = Infinity;
    for (const region of this.regions) {
      const dx = region.centerHex.col - col;
      const dy = region.centerHex.row - row;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = region;
      }
    }
    return nearest;
  }

  /**
   * Spawn a new weather front.
   * Front type is drawn from the biome weather table of the region nearest to
   * the spawn point, so fronts are always climatically coherent with their origin.
   */
  spawnWeatherFront(): void {
    // Random starting position (edge of map or random region center)
    let position: Position;
    let sourceRegion: WeatherRegion;
    const spawnAtEdge = this.random() < 0.5;

    if (spawnAtEdge) {
      // Spawn at map edge, then find the nearest region to determine front type
      const edge = Math.floor(this.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
      position = this.getEdgePosition(edge);
      sourceRegion = this.nearestRegionTo(position.col, position.row);
    } else {
      // Spawn at a random region center — that region defines the front type
      sourceRegion = this.regions[Math.floor(this.random() * this.regions.length)];
      position = { ...sourceRegion.centerHex };
    }

    // Pick a front type that fits the source region's climate
    const selectedType = this.pickFrontTypeFromRegion(sourceRegion);

    // Random movement direction
    const angle = this.random() * Math.PI * 2;
    const speed = 0.5 + this.random() * 1.0; // 0.5-1.5 hexes per hour
    const movement = {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
    };

    // Front properties
    const radius = 3 + Math.floor(this.random() * 5); // 3-7 hex radius
    const duration = 6 + Math.floor(this.random() * 24); // 6-30 hours

    const front = new WeatherFront(selectedType, position, radius, duration, movement, () =>
      this.random()
    );

    this.weatherFronts.push(front);

    logger.general.debug('Weather front spawned', {
      type: selectedType,
      sourceBiome: sourceRegion.biome.key,
      position,
      radius,
      duration,
      movement,
    });
  }

  /**
   * Get position at map edge
   */
  getEdgePosition(edge: number): Position {
    const width = this.mapWidth;
    const height = this.mapHeight;

    switch (edge) {
      case 0: // top
        return { col: Math.floor(this.random() * width), row: 0 };
      case 1: // right
        return { col: width - 1, row: Math.floor(this.random() * height) };
      case 2: // bottom
        return { col: Math.floor(this.random() * width), row: height - 1 };
      case 3: // left
        return { col: 0, row: Math.floor(this.random() * height) };
      default:
        return { col: 0, row: 0 };
    }
  }

  /**
   * Update regional weather based on active fronts
   */
  updateRegionalWeather(): void {
    this.regions.forEach(region => {
      // Check if any front affects this region
      const affectingFront = this.weatherFronts.find(front =>
        front.affects(region.centerHex.col, region.centerHex.row)
      );

      if (affectingFront) {
        // Front overrides natural weather
        region.weatherPattern = affectingFront.weather;
      }
    });
  }

  /**
   * Natural weather evolution (gradual changes over time)
   */
  evolveNaturalWeather(): void {
    this.regions.forEach(region => {
      // Skip if currently affected by a front
      const hasActiveFront = this.weatherFronts.some(front =>
        front.affects(region.centerHex.col, region.centerHex.row)
      );

      if (!hasActiveFront) {
        // 30% chance to change weather
        if (this.random() < 0.3) {
          region.weatherPattern = this.rollWeatherForRegion(region);
        }
      }
    });
  }

  /**
   * Get weather for a specific hex
   */
  getWeatherForHex(col: number, row: number, hexToRegion: Map<string, number>): WeatherType {
    const regionId = hexToRegion.get(`${col},${row}`);
    if (regionId === undefined || !this.regions[regionId]) {
      return WEATHER_TYPES.CLEAR;
    }

    return this.regions[regionId].weatherPattern || WEATHER_TYPES.CLEAR;
  }

  /**
   * Get all active weather fronts
   */
  getActiveFronts(): WeatherFront[] {
    return this.weatherFronts;
  }

  /**
   * Serialize weather state for saving
   */
  toJSON() {
    return {
      seed: this.seed,
      seedCounter: this.seedCounter,
      lastUpdateTime: this.lastUpdateTime,
      lastEvolutionTime: this.lastEvolutionTime,
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      weatherFronts: this.weatherFronts.map(front => ({
        type: front.type,
        position: front.position,
        radius: front.radius,
        duration: front.duration,
        movement: front.movement,
      })),
      regionalWeather: this.regions.map(region => ({
        id: region.id,
        weatherKey: region.weatherPattern?.key || 'clear',
      })),
    };
  }

  /**
   * Deserialize weather state from save
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any, regions: WeatherRegion[]): WeatherSystem {
    const weather = new WeatherSystem(
      regions,
      data.seed,
      data.mapWidth ?? 50,
      data.mapHeight ?? 30
    );
    weather.seedCounter = data.seedCounter;
    weather.lastUpdateTime = data.lastUpdateTime;
    weather.lastEvolutionTime = data.lastEvolutionTime ?? data.lastUpdateTime;

    // Restore weather fronts
    weather.weatherFronts = data.weatherFronts.map(
      (frontData: WeatherFrontJSON) =>
        new WeatherFront(
          frontData.type,
          frontData.position,
          frontData.radius,
          frontData.duration,
          frontData.movement,
          () => weather.random()
        )
    );

    // Restore regional weather
    data.regionalWeather.forEach((rw: { id: string; weatherKey: string }) => {
      const region = regions.find(r => r.id === rw.id);
      if (region) {
        region.weatherPattern = weather.getWeatherByKey(rw.weatherKey);
      }
    });

    return weather;
  }
}
