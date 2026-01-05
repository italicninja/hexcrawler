/**
 * Encounter and difficulty management
 * Handles terrain-based encounters and travel difficulty calculations
 */

export class EncounterManager {
    constructor() {
        this.encounterTables = {
            river: [
                { name: 'River pirates', cr: 2 },
                { name: 'Giant fish', cr: 1 },
                { name: 'Naiads', cr: 3 },
                { name: 'Crocodiles', cr: 1 },
                { name: 'Fishermen', cr: 0 }
            ],
            grassland: [
                { name: 'Bandits', cr: 2 },
                { name: 'Wild horses', cr: 0 },
                { name: 'Traveling merchants', cr: 0 },
                { name: 'Goblin scouts', cr: 1 }
            ],
            forest: [
                { name: 'Wolves', cr: 1 },
                { name: 'Bears', cr: 2 },
                { name: 'Elven patrol', cr: 3 },
                { name: 'Giant spiders', cr: 2 },
                { name: 'Druids', cr: 3 }
            ],
            hills: [
                { name: 'Hill giants', cr: 5 },
                { name: 'Gnolls', cr: 2 },
                { name: 'Griffons', cr: 4 },
                { name: 'Kobolds', cr: 1 }
            ],
            mountains: [
                { name: 'Dragons', cr: 10 },
                { name: 'Harpies', cr: 3 },
                { name: 'Stone giants', cr: 7 },
                { name: 'Wyverns', cr: 6 }
            ],
            desert: [
                { name: 'Scorpions', cr: 1 },
                { name: 'Mummies', cr: 5 },
                { name: 'Sand worms', cr: 8 },
                { name: 'Desert nomads', cr: 1 }
            ],
            swamp: [
                { name: 'Lizardfolk', cr: 2 },
                { name: 'Trolls', cr: 5 },
                { name: 'Will-o-wisps', cr: 4 },
                { name: 'Giant crocodiles', cr: 3 }
            ],
            water: [
                { name: 'Pirates', cr: 2 },
                { name: 'Merfolk', cr: 1 },
                { name: 'Sea serpents', cr: 7 },
                { name: 'Sahuagin', cr: 3 }
            ],
            tundra: [
                { name: 'Frost giants', cr: 8 },
                { name: 'Yetis', cr: 5 },
                { name: 'Winter wolves', cr: 3 },
                { name: 'Ice mephits', cr: 2 }
            ]
        };

        this.difficultyModifiers = {
            weather: {
                'Clear skies': 0,
                'Light clouds': 0,
                'Overcast': 0,
                'Light rain': 1,
                'Heavy rain': 2,
                'Thunderstorm': 2,
                'Fog': 1,
                'Dense fog': 2,
                'Wind': 1,
                'Strong winds': 2,
                'Storm': 3,
                'Blizzard': 3,
                'Hurricane': 4,
                'Dust storm': 2,
                'Scorching heat': 2
            }
        };
    }

    /**
     * Get a random encounter for a terrain type
     */
    getEncounter(terrainType, random) {
        const terrainKey = terrainType.name.toLowerCase();
        const encounters = this.encounterTables[terrainKey] || [{ name: 'Wandering monster', cr: 1 }];
        const index = Math.floor(random() * encounters.length);
        return encounters[index];
    }

    /**
     * Calculate total travel difficulty for a hex
     */
    calculateDifficulty(terrain, weather) {
        let difficulty = terrain.difficulty || 1;

        // Add weather modifier
        if (weather && weather.condition) {
            const weatherMod = this.difficultyModifiers.weather[weather.condition] || 0;
            difficulty += weatherMod;
        }

        return Math.min(difficulty, 10); // Cap at 10
    }

    /**
     * Get difficulty description
     */
    getDifficultyDescription(difficulty) {
        if (difficulty <= 1) return 'Easy';
        if (difficulty <= 2) return 'Moderate';
        if (difficulty <= 3) return 'Difficult';
        if (difficulty <= 4) return 'Very Difficult';
        return 'Extremely Difficult';
    }

    /**
     * Calculate movement speed modifier
     */
    getMovementModifier(difficulty) {
        // Base movement is 1.0, reduced by difficulty
        return Math.max(0.25, 1.0 - (difficulty * 0.15));
    }
}
