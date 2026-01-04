export class TerrainGenerator {
    constructor() {
        this.terrainTypes = {
            grassland: { name: 'Grassland', color: '#90EE90', difficulty: 1 },
            forest: { name: 'Forest', color: '#228B22', difficulty: 2 },
            hills: { name: 'Hills', color: '#8B7355', difficulty: 2 },
            mountains: { name: 'Mountains', color: '#696969', difficulty: 3 },
            desert: { name: 'Desert', color: '#EDC9AF', difficulty: 2 },
            swamp: { name: 'Swamp', color: '#4F7942', difficulty: 3 },
            water: { name: 'Water', color: '#4682B4', difficulty: 4 },
            tundra: { name: 'Tundra', color: '#E0E0E0', difficulty: 2 }
        };

        this.poiTypes = [
            { name: 'Dungeon', icon: '⚔️', weight: 3 },
            { name: 'Settlement', icon: '🏘️', weight: 5 },
            { name: 'Ruins', icon: '🏛️', weight: 4 },
            { name: 'Tower', icon: '🗼', weight: 2 },
            { name: 'Cave', icon: '🕳️', weight: 4 },
            { name: 'Shrine', icon: '⛩️', weight: 3 },
            { name: 'Camp', icon: '⛺', weight: 3 }
        ];

        this.weatherTypes = {
            grassland: [
                { condition: 'Clear skies', effect: 'Normal visibility' },
                { condition: 'Light clouds', effect: 'Normal visibility' },
                { condition: 'Overcast', effect: 'Slightly reduced visibility' },
                { condition: 'Light rain', effect: 'Reduced visibility, muddy ground' },
                { condition: 'Heavy rain', effect: 'Poor visibility, difficult terrain' },
                { condition: 'Thunderstorm', effect: 'Very poor visibility, dangerous' },
                { condition: 'Fog', effect: 'Heavily reduced visibility' },
                { condition: 'Wind', effect: 'Ranged attacks disadvantage' }
            ],
            forest: [
                { condition: 'Clear skies', effect: 'Normal visibility' },
                { condition: 'Misty', effect: 'Reduced visibility' },
                { condition: 'Light rain', effect: 'Slippery terrain' },
                { condition: 'Heavy rain', effect: 'Difficult terrain, poor visibility' },
                { condition: 'Dense fog', effect: 'Heavily reduced visibility' },
                { condition: 'Drizzle', effect: 'Slightly reduced visibility' }
            ],
            hills: [
                { condition: 'Clear skies', effect: 'Excellent visibility' },
                { condition: 'Windy', effect: 'Ranged attacks disadvantage' },
                { condition: 'Light rain', effect: 'Slippery slopes' },
                { condition: 'Heavy rain', effect: 'Dangerous slopes, poor visibility' },
                { condition: 'Fog patches', effect: 'Variable visibility' },
                { condition: 'Storm', effect: 'Very dangerous, seek shelter' }
            ],
            mountains: [
                { condition: 'Clear skies', effect: 'Excellent visibility, cold' },
                { condition: 'Strong winds', effect: 'Difficult climbing, ranged penalty' },
                { condition: 'Snow flurries', effect: 'Reduced visibility, cold' },
                { condition: 'Blizzard', effect: 'Very poor visibility, extreme cold' },
                { condition: 'Hail', effect: 'Dangerous, take cover' },
                { condition: 'Avalanche risk', effect: 'Loud noises dangerous' }
            ],
            desert: [
                { condition: 'Clear skies', effect: 'Extreme heat, water consumption x2' },
                { condition: 'Scorching heat', effect: 'Exhaustion risk, water x3' },
                { condition: 'Dust storm', effect: 'Poor visibility, difficult breathing' },
                { condition: 'Hot wind', effect: 'Increased heat, reduced visibility' },
                { condition: 'Mirage', effect: 'Navigation difficulty' },
                { condition: 'Cold night', effect: 'Extreme temperature drop' }
            ],
            swamp: [
                { condition: 'Humid', effect: 'Exhaustion risk' },
                { condition: 'Dense fog', effect: 'Heavily reduced visibility' },
                { condition: 'Light rain', effect: 'Even wetter terrain' },
                { condition: 'Heavy rain', effect: 'Flooding, difficult terrain' },
                { condition: 'Mist', effect: 'Reduced visibility' },
                { condition: 'Pestilent air', effect: 'Disease risk increased' }
            ],
            water: [
                { condition: 'Calm seas', effect: 'Normal sailing' },
                { condition: 'Light waves', effect: 'Normal sailing' },
                { condition: 'Choppy waters', effect: 'Slower sailing' },
                { condition: 'Storm', effect: 'Dangerous sailing, seek port' },
                { condition: 'Heavy fog', effect: 'Navigation difficulty' },
                { condition: 'Hurricane', effect: 'Extreme danger, capsize risk' }
            ],
            tundra: [
                { condition: 'Clear and cold', effect: 'Extreme cold, frostbite risk' },
                { condition: 'Light snow', effect: 'Reduced visibility, cold' },
                { condition: 'Heavy snow', effect: 'Poor visibility, difficult terrain' },
                { condition: 'Blizzard', effect: 'Whiteout conditions, extreme cold' },
                { condition: 'Ice wind', effect: 'Severe cold, ranged penalty' },
                { condition: 'Aurora', effect: 'Beautiful, normal conditions' }
            ]
        };

        this.seed = Date.now();
    }

    setSeed(seed) {
        this.seed = seed ? parseInt(seed) : Date.now();
    }

    // Simple seeded random number generator
    random() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    generate(width, height, terrainVariety, poiFrequency) {
        const grid = [];

        // Generate base terrain using simple noise
        for (let row = 0; row < height; row++) {
            grid[row] = [];
            for (let col = 0; col < width; col++) {
                const terrainType = this.generateTerrain(col, row, terrainVariety);
                const poi = this.generatePOI(poiFrequency);
                const encounter = this.generateEncounter(terrainType);

                grid[row][col] = {
                    terrain: terrainType,
                    poi: poi,
                    encounter: encounter,
                    weather: this.generateWeather(terrainType)
                };
            }
        }

        return grid;
    }

    generateTerrain(x, y, variety) {
        // Simple noise-like generation
        const noise = this.noise2D(x / variety, y / variety);

        const terrainKeys = Object.keys(this.terrainTypes);
        const index = Math.floor((noise + 1) / 2 * terrainKeys.length);
        const clampedIndex = Math.max(0, Math.min(terrainKeys.length - 1, index));

        return this.terrainTypes[terrainKeys[clampedIndex]];
    }

    noise2D(x, y) {
        // Very simple pseudo-noise function
        const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed * 0.001) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
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

    generateEncounter(terrain) {
        const encounters = {
            grassland: ['Bandits', 'Wild horses', 'Traveling merchants', 'Goblin scouts'],
            forest: ['Wolves', 'Bears', 'Elven patrol', 'Giant spiders', 'Druids'],
            hills: ['Hill giants', 'Gnolls', 'Griffons', 'Kobolds'],
            mountains: ['Dragons', 'Harpies', 'Stone giants', 'Wyverns'],
            desert: ['Scorpions', 'Mummies', 'Sand worms', 'Desert nomads'],
            swamp: ['Lizardfolk', 'Trolls', 'Will-o-wisps', 'Giant crocodiles'],
            water: ['Pirates', 'Merfolk', 'Sea serpents', 'Sahuagin'],
            tundra: ['Frost giants', 'Yetis', 'Winter wolves', 'Ice mephits']
        };

        const terrainKey = Object.keys(this.terrainTypes).find(
            key => this.terrainTypes[key] === terrain
        );

        const options = encounters[terrainKey] || ['Wandering monster'];
        const index = Math.floor(this.random() * options.length);

        return options[index];
    }

    generateWeather(terrain) {
        const terrainKey = Object.keys(this.terrainTypes).find(
            key => this.terrainTypes[key] === terrain
        );

        const weatherOptions = this.weatherTypes[terrainKey] || this.weatherTypes.grassland;
        const index = Math.floor(this.random() * weatherOptions.length);

        return weatherOptions[index];
    }

    getTerrainTypes() {
        return this.terrainTypes;
    }
}
