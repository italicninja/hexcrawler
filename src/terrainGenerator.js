import { PerlinNoise, SimpleNoise } from './noise.js';
import { TerrainAlgorithms } from './terrainAlgorithms.js';
import { RiverGenerator } from './riverGenerator.js';
import { EncounterManager } from './encounters.js';

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
            tundra: { key: 'tundra', name: 'Tundra', color: '#E0E0E0', difficulty: 2 }
        };

        this.poiTypes = [
            { name: 'Dungeon', weight: 3 },
            { name: 'Settlement', weight: 5 },
            { name: 'Ruins', weight: 4 },
            { name: 'Tower', weight: 2 },
            { name: 'Cave', weight: 4 },
            { name: 'Shrine', weight: 3 },
            { name: 'Camp', weight: 3 }
        ];

        this.weatherTypes = {
            river: [
                { condition: 'Clear skies', effect: 'Calm waters' },
                { condition: 'Light rain', effect: 'Faster current' },
                { condition: 'Heavy rain', effect: 'Dangerous current, flooding risk' },
                { condition: 'Fog', effect: 'Poor visibility on water' },
                { condition: 'Storm', effect: 'Very dangerous crossing' }
            ],
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
        this.noise = new PerlinNoise(this.seed);
        this.terrainAlgorithms = new TerrainAlgorithms(this.noise);
        this.riverGenerator = new RiverGenerator(this.noise);
        this.encounterManager = new EncounterManager();
        this.algorithm = 'biome'; // default algorithm
    }

    setSeed(seed) {
        this.seed = seed ? parseInt(seed) : Date.now();
        this.noise.setSeed(this.seed);
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
        const grid = [];

        // Generate base terrain using selected algorithm
        for (let row = 0; row < height; row++) {
            grid[row] = [];
            for (let col = 0; col < width; col++) {
                const terrainType = this.generateTerrain(col, row, width, height, terrainVariety);

                grid[row][col] = {
                    terrain: terrainType,
                    poi: null,
                    encounter: this.encounterManager.getEncounter(terrainType, () => this.random()),
                    weather: this.generateWeather(terrainType),
                    elevation: 0 // Will be set during generation
                };
            }
        }

        // Generate rivers
        this.generateRivers(grid, width, height, terrainVariety);

        // Generate POIs with smart placement
        this.generateSmartPOIs(grid, width, height, poiFrequency);

        return grid;
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
        this.riverGenerator.generateRivers(grid, width, height, numRivers);

        // Update river terrain references
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                if (grid[row][col].terrain.name === 'River') {
                    grid[row][col].terrain = this.terrainTypes.river;
                    grid[row][col].encounter = this.encounterManager.getEncounter(this.terrainTypes.river, () => this.random());
                    grid[row][col].weather = this.generateWeather(this.terrainTypes.river);
                }
            }
        }
    }

    generateSmartPOIs(grid, width, height, baseFrequency) {
        // Find suitable settlement locations
        const settlementLocations = this.findSettlementLocations(grid, width, height);

        // Calculate number of settlements based on frequency
        const numSettlements = Math.floor((baseFrequency / 100) * width * height * 0.3);

        // Place settlements in best locations
        for (let i = 0; i < Math.min(numSettlements, settlementLocations.length); i++) {
            const loc = settlementLocations[i];
            grid[loc.row][loc.col].poi = {
                name: 'Settlement',
                weight: 5
            };
        }

        // Place other POIs randomly but respecting terrain
        const otherPOITypes = this.poiTypes.filter(p => p.name !== 'Settlement');
        const numOtherPOIs = Math.floor((baseFrequency / 100) * width * height * 0.7);

        for (let i = 0; i < numOtherPOIs; i++) {
            const col = Math.floor(this.random() * width);
            const row = Math.floor(this.random() * height);

            // Skip if already has POI or is water
            if (grid[row][col].poi || grid[row][col].terrain.name === 'Water') {
                continue;
            }

            // Select appropriate POI for terrain
            const poi = this.selectPOIForTerrain(grid[row][col].terrain, otherPOITypes);
            if (poi) {
                grid[row][col].poi = { ...poi };
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
            'Mountains': ['Cave', 'Tower', 'Ruins'],
            'Hills': ['Tower', 'Ruins', 'Camp'],
            'Forest': ['Shrine', 'Camp', 'Ruins'],
            'Swamp': ['Ruins', 'Shrine'],
            'Desert': ['Ruins', 'Camp'],
            'Tundra': ['Cave', 'Camp']
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
