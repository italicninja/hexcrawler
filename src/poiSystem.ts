// @ts-nocheck
// TODO: Add proper types
/**
 * POI System - Points of Interest with Events
 * Replaces the old encounter system with a unified POI system
 * Includes visibility rules, event types, and CR scaling
 */

import { getHexDistance } from './utils/hexMath';
import { STARTING_CACHE } from './constants/gameConstants';

/**
 * POI Type Definitions
 */
export const POI_TYPES = {
  CAMP: 'camp',
  VILLAGE: 'village',
  TOWN: 'town',
  CITY: 'city',
  METROPOLIS: 'metropolis',
  DUNGEON: 'dungeon',
  SHRINE: 'shrine',
  ENCOUNTER: 'encounter',
  RUINS: 'ruins',
  CAVE: 'cave',
  TOWER: 'tower',
  STARTING_CACHE: 'starting_cache',
};

/**
 * POI System Class
 */
export class POISystem {
  constructor() {
    // Encounter tables by terrain type
    this.encounterTables = {
      river: [
        { name: 'River pirates', cr: 2, creatures: '1d4 Pirates' },
        { name: 'Giant fish', cr: 1, creatures: '1 Giant Pike' },
        { name: 'Naiads', cr: 3, creatures: '1d3 Naiads' },
        { name: 'Crocodiles', cr: 1, creatures: '1d4 Crocodiles' },
        { name: 'Fishermen', cr: 0, creatures: 'Friendly Fishermen' },
      ],
      grassland: [
        { name: 'Bandits', cr: 2, creatures: '2d4 Bandits' },
        { name: 'Wild horses', cr: 0, creatures: '1d6 Wild Horses' },
        { name: 'Traveling merchants', cr: 0, creatures: 'Merchant Caravan' },
        { name: 'Goblin scouts', cr: 1, creatures: '2d4 Goblins' },
        { name: 'Giant spiders', cr: 1, creatures: '1d4 Giant Spiders' },
      ],
      forest: [
        { name: 'Wolves', cr: 1, creatures: '2d4 Wolves' },
        { name: 'Bears', cr: 2, creatures: '1d2 Brown Bears' },
        { name: 'Elven patrol', cr: 3, creatures: '1d4 Elf Scouts' },
        { name: 'Giant spiders', cr: 2, creatures: '1d6 Giant Spiders' },
        { name: 'Druids', cr: 3, creatures: '1d2 Druids' },
      ],
      hills: [
        { name: 'Hill giants', cr: 5, creatures: '1d2 Hill Giants' },
        { name: 'Gnolls', cr: 2, creatures: '2d4 Gnolls' },
        { name: 'Griffons', cr: 4, creatures: '1 Griffon' },
        { name: 'Kobolds', cr: 1, creatures: '3d6 Kobolds' },
      ],
      mountains: [
        { name: 'Young dragon', cr: 10, creatures: '1 Young Dragon' },
        { name: 'Harpies', cr: 3, creatures: '1d6 Harpies' },
        { name: 'Stone giants', cr: 7, creatures: '1d2 Stone Giants' },
        { name: 'Wyverns', cr: 6, creatures: '1d2 Wyverns' },
      ],
      desert: [
        { name: 'Giant scorpions', cr: 1, creatures: '1d4 Giant Scorpions' },
        { name: 'Mummies', cr: 5, creatures: '1d3 Mummies' },
        { name: 'Sand worms', cr: 8, creatures: '1 Purple Worm' },
        { name: 'Desert nomads', cr: 1, creatures: '2d4 Nomads' },
      ],
      swamp: [
        { name: 'Lizardfolk', cr: 2, creatures: '2d4 Lizardfolk' },
        { name: 'Trolls', cr: 5, creatures: '1d2 Trolls' },
        { name: 'Will-o-wisps', cr: 4, creatures: '1d3 Will-o-wisps' },
        { name: 'Giant crocodiles', cr: 3, creatures: '1d2 Giant Crocodiles' },
      ],
      water: [
        { name: 'Pirates', cr: 2, creatures: '2d4 Pirates' },
        { name: 'Merfolk', cr: 1, creatures: '1d6 Merfolk' },
        { name: 'Sea serpents', cr: 7, creatures: '1 Sea Serpent' },
        { name: 'Sahuagin', cr: 3, creatures: '2d4 Sahuagin' },
      ],
      tundra: [
        { name: 'Frost giants', cr: 8, creatures: '1d2 Frost Giants' },
        { name: 'Yetis', cr: 5, creatures: '1d3 Yetis' },
        { name: 'Winter wolves', cr: 3, creatures: '1d6 Winter Wolves' },
        { name: 'Ice mephits', cr: 2, creatures: '2d4 Ice Mephits' },
      ],
    };

    // Settlement name pools by tier
    this.campNames = [
      "Hunter's Camp",
      'Scout Outpost',
      "Traveler's Rest",
      'Wayside Camp',
      'Ranger Station',
      'Forward Camp',
      'Patrol Post',
      'Crossroads Camp',
      "Trapper's Haven",
      'Explorer Camp',
      'Nomad Encampment',
      'Merchant Stopover',
      "Woodsman's Camp",
      'Border Post',
      'Frontier Camp',
    ];

    this.villageNames = [
      'Little Creek',
      'Brookhaven',
      'Meadowvale',
      'Quiet Hollow',
      'Pinewood',
      'Greenhill',
      'Riverbend',
      'Mossbrook',
      'Willowdale',
      'Fernwood',
      'Hazelton',
      'Springdale',
      'Elmshire',
      'Birchwood',
      'Cloverfield',
    ];

    this.townNames = [
      'Riverdale',
      'Oakwood',
      'Millbrook',
      'Thornhaven',
      'Crossroads',
      'Westmarch',
      'Eastvale',
      'Northwind',
      'Southport',
      'Redstone',
      'Silverpine',
      'Goldleaf',
      'Ironforge',
      'Copperhill',
      'Stonegate',
    ];

    this.cityNames = [
      'Grandhaven',
      'Kingsport',
      'Valorhold',
      'Highbridge',
      'Stormwatch',
      'Goldharbor',
      'Ironkeep',
      'Silvercrest',
      'Brightwater',
      'Liongate',
      'Crownstead',
      'Dragonport',
      'Starfall',
      'Thorncastle',
      'Whitepeak',
    ];

    this.metropolisNames = [
      'Grand City of Lumina',
      'Imperial Citadel',
      'The Eternal City',
      'Platinum Spire',
      'Capital of the Realm',
      'Crown Jewel',
      'Golden Metropolis',
      'Celestial City',
      'The Grand Confluence',
      "Archon's Seat",
    ];

    // Dungeon name pools
    this.dungeonNames = [
      'Ancient Crypt',
      'Abandoned Mine',
      'Cursed Fortress',
      'Dark Tomb',
      'Forgotten Temple',
      'Underground Prison',
      'Haunted Keep',
      'Bone Citadel',
    ];

    // Settlement descriptions by tier (3-5 variants each)
    this.campDescriptions = [
      'A small encampment with a few tents and a campfire.',
      'A temporary camp set up by travelers and traders.',
      'A modest outpost offering basic shelter and supplies.',
      'A rustic camp with weather-worn tents and a supply wagon.',
      'A frontier camp manned by scouts and hunters.',
    ];

    this.villageDescriptions = [
      'A quiet village with a handful of cottages and an inn.',
      'A peaceful hamlet nestled among rolling hills.',
      'A small farming community with a general store and friendly locals.',
      'A cozy village where everyone knows each other.',
      'A rustic settlement surrounded by fields and pastures.',
    ];

    this.townDescriptions = [
      'A bustling town offering rest and supplies.',
      'A well-established town with shops, an inn, and a temple.',
      'A thriving settlement built around a central square.',
      'A prosperous town with cobblestone streets and sturdy buildings.',
      'A fortified town protected by wooden walls and a gate.',
    ];

    this.cityDescriptions = [
      'A large city with towering buildings and busy marketplaces.',
      'A walled city bustling with merchants, artisans, and travelers.',
      'An impressive urban center with grand architecture.',
      'A prosperous city known for its trade and craftsmanship.',
      'A fortified city protected by stone walls and vigilant guards.',
    ];

    this.metropolisDescriptions = [
      'A magnificent metropolis with soaring towers and grand plazas.',
      'An awe-inspiring citadel that serves as a regional capital.',
      'A sprawling city of culture, commerce, and power.',
      'The jewel of the realm, with streets paved in prosperity.',
      'A legendary city-state known throughout the land for its grandeur.',
    ];
  }

  calculateCR(col, row, startCol = 10, startRow = 7, terrainDifficulty = 1, random = Math.random) {
    const distance = getHexDistance(startCol, startRow, col, row);

    let baseCR;
    if (distance <= 2) {
      baseCR = 0;
    } else if (distance <= 5) {
      baseCR = Math.floor(random() * 2);
    } else if (distance <= 10) {
      baseCR = Math.floor(random() * 3) + 1;
    } else if (distance <= 15) {
      baseCR = Math.floor(random() * 3) + 3;
    } else if (distance <= 20) {
      baseCR = Math.floor(random() * 4) + 5;
    } else {
      baseCR = Math.floor(random() * 5) + 8;
    }

    const terrainMod = Math.floor(terrainDifficulty / 2);
    return Math.max(0, baseCR + terrainMod);
  }

  getPOITypesForTerrain(terrain) {
    const terrainName = terrain.name.toLowerCase();

    const preferences = {
      mountains: [POI_TYPES.CAVE, POI_TYPES.TOWER, POI_TYPES.RUINS, POI_TYPES.DUNGEON],
      hills: [POI_TYPES.TOWER, POI_TYPES.RUINS, POI_TYPES.CAMP],
      forest: [POI_TYPES.SHRINE, POI_TYPES.CAMP, POI_TYPES.RUINS, POI_TYPES.ENCOUNTER],
      swamp: [POI_TYPES.RUINS, POI_TYPES.SHRINE, POI_TYPES.ENCOUNTER],
      desert: [POI_TYPES.RUINS, POI_TYPES.CAMP, POI_TYPES.ENCOUNTER],
      tundra: [POI_TYPES.CAVE, POI_TYPES.CAMP, POI_TYPES.ENCOUNTER],
      grassland: [POI_TYPES.CAMP, POI_TYPES.ENCOUNTER, POI_TYPES.RUINS],
      river: [POI_TYPES.CAMP, POI_TYPES.ENCOUNTER],
    };

    return preferences[terrainName] || [POI_TYPES.CAMP, POI_TYPES.ENCOUNTER];
  }

  getEncounterForTerrain(terrain, cr, random = Math.random) {
    const terrainKey = terrain.name.toLowerCase();
    const encounters = this.encounterTables[terrainKey] || this.encounterTables.grassland;

    const suitableEncounters = encounters.filter(e => Math.abs(e.cr - cr) <= 2);

    if (suitableEncounters.length === 0) {
      const index = Math.floor(random() * encounters.length);
      return encounters[index];
    }

    const index = Math.floor(random() * suitableEncounters.length);
    return suitableEncounters[index];
  }

  generatePOI(type, col, row, terrain, startCol = 10, startRow = 7, random = Math.random) {
    const cr = this.calculateCR(col, row, startCol, startRow, terrain.difficulty, random);

    switch (type) {
      case POI_TYPES.CAMP:
        return this.generateCamp(cr, random);
      case POI_TYPES.VILLAGE:
        return this.generateVillage(random);
      case POI_TYPES.TOWN:
        return this.generateTown(random);
      case POI_TYPES.CITY:
        return this.generateCity(random);
      case POI_TYPES.METROPOLIS:
        return this.generateMetropolis(random);
      case POI_TYPES.DUNGEON:
        return this.generateDungeon(cr, terrain, random);
      case POI_TYPES.SHRINE:
        return this.generateShrine(random);
      case POI_TYPES.ENCOUNTER:
        return this.generateEncounter(cr, terrain, random);
      case POI_TYPES.RUINS:
        return this.generateRuins(cr, random);
      case POI_TYPES.CAVE:
        return this.generateCave(cr, random);
      case POI_TYPES.TOWER:
        return this.generateTower(cr, random);
      default:
        return null;
    }
  }

  generateTown(random) {
    const name = this.townNames[Math.floor(random() * this.townNames.length)];
    const description = this.townDescriptions[Math.floor(random() * this.townDescriptions.length)];

    return {
      type: POI_TYPES.TOWN,
      settlementSize: 'town',
      name,
      description,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      icon: 'Settlement',
      color: '#8B4513',
      questChance: 0.75,
    };
  }

  generateDungeon(cr, terrain, random) {
    const name = this.dungeonNames[Math.floor(random() * this.dungeonNames.length)];
    const encounter = this.getEncounterForTerrain(terrain, cr, random);

    return {
      type: POI_TYPES.DUNGEON,
      name,
      description: `A dangerous dungeon filled with ${encounter.creatures}.`,
      visibleWithoutDiscovery: false,
      eventType: 'active',
      cr,
      creatures: encounter.creatures,
      icon: 'Dungeon',
      color: '#2c3e50',
    };
  }

  generateShrine(random) {
    const deities = ['Fortune', 'War', 'Nature', 'Knowledge', 'Light'];
    const deity = deities[Math.floor(random() * deities.length)];

    return {
      type: POI_TYPES.SHRINE,
      name: `Shrine of ${deity}`,
      description: `A sacred shrine dedicated to ${deity}.`,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      icon: 'Shrine',
      color: '#e74c3c',
    };
  }

  generateEncounter(cr, terrain, random) {
    const encounter = this.getEncounterForTerrain(terrain, cr, random);

    return {
      type: POI_TYPES.ENCOUNTER,
      name: encounter.name,
      description: `You've encountered ${encounter.creatures}!`,
      visibleWithoutDiscovery: false,
      eventType: 'active',
      cr: encounter.cr,
      creatures: encounter.creatures,
      icon: null,
      color: null,
    };
  }

  generateCamp(cr, random) {
    const name = this.campNames[Math.floor(random() * this.campNames.length)];
    const description = this.campDescriptions[Math.floor(random() * this.campDescriptions.length)];

    return {
      type: POI_TYPES.CAMP,
      settlementSize: 'camp',
      name,
      description,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      icon: 'Camp',
      color: '#8B7355',
      questChance: 0.25,
    };
  }

  generateVillage(random) {
    const name = this.villageNames[Math.floor(random() * this.villageNames.length)];
    const description =
      this.villageDescriptions[Math.floor(random() * this.villageDescriptions.length)];

    return {
      type: POI_TYPES.VILLAGE,
      settlementSize: 'village',
      name,
      description,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      icon: 'Village',
      color: '#A0826D',
      questChance: 0.5,
    };
  }

  generateCity(random) {
    const name = this.cityNames[Math.floor(random() * this.cityNames.length)];
    const description = this.cityDescriptions[Math.floor(random() * this.cityDescriptions.length)];

    return {
      type: POI_TYPES.CITY,
      settlementSize: 'city',
      name,
      description,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      icon: 'City',
      color: '#654321',
      questChance: 0.9,
    };
  }

  generateMetropolis(random) {
    const name = this.metropolisNames[Math.floor(random() * this.metropolisNames.length)];
    const description =
      this.metropolisDescriptions[Math.floor(random() * this.metropolisDescriptions.length)];

    return {
      type: POI_TYPES.METROPOLIS,
      settlementSize: 'metropolis',
      name,
      description,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      icon: 'Metropolis',
      color: '#8B7500',
      questChance: 1.0,
    };
  }

  generateRuins(cr, random) {
    const adjectives = ['Ancient', 'Forgotten', 'Crumbling', 'Mysterious', 'Overgrown'];
    const adj = adjectives[Math.floor(random() * adjectives.length)];

    return {
      type: POI_TYPES.RUINS,
      name: `${adj} Ruins`,
      description: `${adj} ruins that may contain treasures or dangers.`,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      cr,
      icon: 'Ruins',
      color: '#95a5a6',
    };
  }

  generateCave(cr, random) {
    return {
      type: POI_TYPES.CAVE,
      name: 'Dark Cave',
      description: 'A dark cave entrance beckons explorers.',
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      cr,
      icon: 'Cave',
      color: '#2c3e50',
    };
  }

  generateTower(cr, random) {
    const owners = ['Wizard', 'Hermit', 'Watcher', 'Mage', 'Sorcerer'];
    const owner = owners[Math.floor(random() * owners.length)];

    return {
      type: POI_TYPES.TOWER,
      name: `${owner}'s Tower`,
      description: `A mysterious tower once belonging to a ${owner.toLowerCase()}.`,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      cr,
      icon: 'Tower',
      color: '#34495e',
    };
  }

  /**
   * Generate the starting cache POI — placed on the player's spawn hex.
   * CR 0, no real combat, contains starter gear and a clearly marked Exit Hex.
   * The player begins the game inside this location.
   * @param {Function} random - Seeded RNG
   */
  generateStartingCache(random) {
    const name = STARTING_CACHE.NAMES[Math.floor(random() * STARTING_CACHE.NAMES.length)];
    const description =
      STARTING_CACHE.DESCRIPTIONS[Math.floor(random() * STARTING_CACHE.DESCRIPTIONS.length)];

    return {
      type: POI_TYPES.STARTING_CACHE,
      name,
      description,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      cr: STARTING_CACHE.CR,
      icon: 'Cache',
      color: '#4a7c59',
      isStartingLocation: true,
    };
  }
}
