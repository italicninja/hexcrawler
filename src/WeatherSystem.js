import logger from './utils/logger.js';

/**
 * Weather type definitions with gameplay effects
 */
export const WEATHER_TYPES = {
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
  constructor(type, position, radius, duration, movement, random) {
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
  move(hours) {
    this.position.col += this.movement.dx * hours;
    this.position.row += this.movement.dy * hours;
    this.duration -= hours;
  }

  /**
   * Check if front affects a position
   */
  affects(col, row) {
    const dx = this.position.col - col;
    const dy = this.position.row - row;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius;
  }

  /**
   * Check if front is expired
   */
  isExpired() {
    return this.duration <= 0;
  }
}

/**
 * WeatherSystem - Manages regional weather patterns and fronts
 */
export class WeatherSystem {
  constructor(regions, seed) {
    this.regions = regions;
    this.seed = seed;
    this.seedCounter = seed;
    this.weatherFronts = [];
    this.lastUpdateTime = 0; // Game time in hours
  }

  /**
   * Seeded random number generator
   */
  random() {
    const x = Math.sin(this.seedCounter++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Initialize weather for all regions
   */
  initializeWeather() {
    logger.general.time('weather-init');
    logger.general.info('Initializing regional weather', { regions: this.regions.length });

    this.regions.forEach((region, idx) => {
      region.weatherPattern = this.rollWeatherForRegion(region);
      logger.general.debug('Region weather set', {
        regionId: region.id,
        biome: region.biome.key,
        weather: region.weatherPattern.key,
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
  rollWeatherForRegion(region) {
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
  getWeatherByKey(key) {
    // Handle common aliases
    const aliases = {
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
  advanceTime(hours) {
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

    // Natural weather evolution every 6 hours
    if (this.lastUpdateTime % 6 === 0) {
      this.evolveNaturalWeather();
    }

    this.lastUpdateTime += hours;
  }

  /**
   * Spawn a new weather front
   */
  spawnWeatherFront() {
    // Random front type (weighted toward common weather)
    const frontTypes = [
      { type: 'RAIN', weight: 30 },
      { type: 'STORM', weight: 10 },
      { type: 'FOG', weight: 20 },
      { type: 'WIND', weight: 15 },
      { type: 'SNOW', weight: 10 },
      { type: 'BLIZZARD', weight: 5 },
      { type: 'SANDSTORM', weight: 5 },
      { type: 'LIGHT_RAIN', weight: 25 },
    ];

    const totalWeight = frontTypes.reduce((sum, ft) => sum + ft.weight, 0);
    let roll = this.random() * totalWeight;
    let selectedType = 'RAIN';

    for (const ft of frontTypes) {
      roll -= ft.weight;
      if (roll <= 0) {
        selectedType = ft.type;
        break;
      }
    }

    // Random starting position (edge of map or random region)
    let position;
    const spawnAtEdge = this.random() < 0.5;

    if (spawnAtEdge) {
      // Spawn at map edge
      const edge = Math.floor(this.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
      position = this.getEdgePosition(edge);
    } else {
      // Spawn at random region center
      const region = this.regions[Math.floor(this.random() * this.regions.length)];
      position = { ...region.centerHex };
    }

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
      position,
      radius,
      duration,
      movement,
    });
  }

  /**
   * Get position at map edge
   */
  getEdgePosition(edge) {
    const width = 50; // Assume map width (will be passed properly later)
    const height = 30; // Assume map height

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
  updateRegionalWeather() {
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
  evolveNaturalWeather() {
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
  getWeatherForHex(col, row, hexToRegion) {
    const regionId = hexToRegion.get(`${col},${row}`);
    if (regionId === undefined || !this.regions[regionId]) {
      return WEATHER_TYPES.CLEAR;
    }

    return this.regions[regionId].weatherPattern || WEATHER_TYPES.CLEAR;
  }

  /**
   * Get all active weather fronts
   */
  getActiveFronts() {
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
  static fromJSON(data, regions) {
    const weather = new WeatherSystem(regions, data.seed);
    weather.seedCounter = data.seedCounter;
    weather.lastUpdateTime = data.lastUpdateTime;

    // Restore weather fronts
    weather.weatherFronts = data.weatherFronts.map(
      frontData =>
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
    data.regionalWeather.forEach(rw => {
      const region = regions.find(r => r.id === rw.id);
      if (region) {
        region.weatherPattern = weather.getWeatherByKey(rw.weatherKey);
      }
    });

    return weather;
  }
}
