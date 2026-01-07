/**
 * POI System - Points of Interest with Events
 * Replaces the old encounter system with a unified POI system
 * Includes visibility rules, event types, and CR scaling
 */

/**
 * Calculate hex distance (cube coordinates)
 */
function getHexDistance(col1, row1, col2, row2) {
  const x1 = col1 - Math.floor(row1 / 2);
  const z1 = row1;
  const y1 = -x1 - z1;

  const x2 = col2 - Math.floor(row2 / 2);
  const z2 = row2;
  const y2 = -x2 - z2;

  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

/**
 * POI Type Definitions
 */
export const POI_TYPES = {
  TOWN: 'town',
  DUNGEON: 'dungeon',
  SHRINE: 'shrine',
  ENCOUNTER: 'encounter',
  CAMP: 'camp',
  RUINS: 'ruins',
  CAVE: 'cave',
  TOWER: 'tower'
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
        { name: 'Fishermen', cr: 0, creatures: 'Friendly Fishermen' }
      ],
      grassland: [
        { name: 'Bandits', cr: 2, creatures: '2d4 Bandits' },
        { name: 'Wild horses', cr: 0, creatures: '1d6 Wild Horses' },
        { name: 'Traveling merchants', cr: 0, creatures: 'Merchant Caravan' },
        { name: 'Goblin scouts', cr: 1, creatures: '2d4 Goblins' },
        { name: 'Giant spiders', cr: 1, creatures: '1d4 Giant Spiders' }
      ],
      forest: [
        { name: 'Wolves', cr: 1, creatures: '2d4 Wolves' },
        { name: 'Bears', cr: 2, creatures: '1d2 Brown Bears' },
        { name: 'Elven patrol', cr: 3, creatures: '1d4 Elf Scouts' },
        { name: 'Giant spiders', cr: 2, creatures: '1d6 Giant Spiders' },
        { name: 'Druids', cr: 3, creatures: '1d2 Druids' }
      ],
      hills: [
        { name: 'Hill giants', cr: 5, creatures: '1d2 Hill Giants' },
        { name: 'Gnolls', cr: 2, creatures: '2d4 Gnolls' },
        { name: 'Griffons', cr: 4, creatures: '1 Griffon' },
        { name: 'Kobolds', cr: 1, creatures: '3d6 Kobolds' }
      ],
      mountains: [
        { name: 'Young dragon', cr: 10, creatures: '1 Young Dragon' },
        { name: 'Harpies', cr: 3, creatures: '1d6 Harpies' },
        { name: 'Stone giants', cr: 7, creatures: '1d2 Stone Giants' },
        { name: 'Wyverns', cr: 6, creatures: '1d2 Wyverns' }
      ],
      desert: [
        { name: 'Giant scorpions', cr: 1, creatures: '1d4 Giant Scorpions' },
        { name: 'Mummies', cr: 5, creatures: '1d3 Mummies' },
        { name: 'Sand worms', cr: 8, creatures: '1 Purple Worm' },
        { name: 'Desert nomads', cr: 1, creatures: '2d4 Nomads' }
      ],
      swamp: [
        { name: 'Lizardfolk', cr: 2, creatures: '2d4 Lizardfolk' },
        { name: 'Trolls', cr: 5, creatures: '1d2 Trolls' },
        { name: 'Will-o-wisps', cr: 4, creatures: '1d3 Will-o-wisps' },
        { name: 'Giant crocodiles', cr: 3, creatures: '1d2 Giant Crocodiles' }
      ],
      water: [
        { name: 'Pirates', cr: 2, creatures: '2d4 Pirates' },
        { name: 'Merfolk', cr: 1, creatures: '1d6 Merfolk' },
        { name: 'Sea serpents', cr: 7, creatures: '1 Sea Serpent' },
        { name: 'Sahuagin', cr: 3, creatures: '2d4 Sahuagin' }
      ],
      tundra: [
        { name: 'Frost giants', cr: 8, creatures: '1d2 Frost Giants' },
        { name: 'Yetis', cr: 5, creatures: '1d3 Yetis' },
        { name: 'Winter wolves', cr: 3, creatures: '1d6 Winter Wolves' },
        { name: 'Ice mephits', cr: 2, creatures: '2d4 Ice Mephits' }
      ]
    };

    // Town name pools
    this.townNames = [
      'Riverdale', 'Oakwood', 'Millbrook', 'Thornhaven', 'Crossroads',
      'Westmarch', 'Eastvale', 'Northwind', 'Southport', 'Redstone',
      'Silverpine', 'Goldleaf', 'Ironforge', 'Copperhill', 'Stonegate'
    ];

    // Dungeon name pools
    this.dungeonNames = [
      'Ancient Crypt', 'Abandoned Mine', 'Cursed Fortress', 'Dark Tomb',
      'Forgotten Temple', 'Underground Prison', 'Haunted Keep', 'Bone Citadel'
    ];

    // Camp descriptions
    this.campTypes = [
      { name: 'Merchant camp', friendly: true },
      { name: 'Refugee camp', friendly: true },
      { name: 'Bandit camp', friendly: false },
      { name: 'Mercenary camp', friendly: 'neutral' },
      { name: 'Nomad camp', friendly: true }
    ];
  }

  /**
   * Calculate POI Challenge Rating based on distance from starting hex
   * @param {number} col - Hex column
   * @param {number} row - Hex row
   * @param {number} startCol - Starting hex column (default 10)
   * @param {number} startRow - Starting hex row (default 7)
   * @param {number} terrainDifficulty - Terrain difficulty modifier (0-4)
   * @param {function} random - Seeded random function
   * @returns {number} Challenge Rating (0-12)
   */
  calculateCR(col, row, startCol = 10, startRow = 7, terrainDifficulty = 1, random = Math.random) {
    const distance = getHexDistance(startCol, startRow, col, row);

    let baseCR;
    if (distance <= 2) {
      // Safe starting area
      baseCR = 0;
    } else if (distance <= 5) {
      // Early game
      baseCR = Math.floor(random() * 2); // CR 0-1
    } else if (distance <= 10) {
      // Mid-early game
      baseCR = Math.floor(random() * 3) + 1; // CR 1-3
    } else if (distance <= 15) {
      // Mid game
      baseCR = Math.floor(random() * 3) + 3; // CR 3-5
    } else if (distance <= 20) {
      // Late-mid game
      baseCR = Math.floor(random() * 4) + 5; // CR 5-8
    } else {
      // Late game
      baseCR = Math.floor(random() * 5) + 8; // CR 8-12
    }

    // Add terrain difficulty modifier
    const terrainMod = Math.floor(terrainDifficulty / 2);

    return Math.max(0, baseCR + terrainMod);
  }

  /**
   * Get appropriate POI types for a terrain
   * @param {object} terrain - Terrain type object
   * @returns {array} Array of POI types suitable for this terrain
   */
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
      river: [POI_TYPES.CAMP, POI_TYPES.ENCOUNTER]
    };

    return preferences[terrainName] || [POI_TYPES.CAMP, POI_TYPES.ENCOUNTER];
  }

  /**
   * Generate a random encounter for a terrain and CR
   * @param {object} terrain - Terrain type
   * @param {number} cr - Challenge rating
   * @param {function} random - Seeded random function
   * @returns {object} Encounter data
   */
  getEncounterForTerrain(terrain, cr, random = Math.random) {
    const terrainKey = terrain.name.toLowerCase();
    const encounters = this.encounterTables[terrainKey] || this.encounterTables.grassland;

    // Filter encounters by CR (within 2 levels)
    const suitableEncounters = encounters.filter(e => Math.abs(e.cr - cr) <= 2);

    if (suitableEncounters.length === 0) {
      // Fallback to any encounter
      const index = Math.floor(random() * encounters.length);
      return encounters[index];
    }

    const index = Math.floor(random() * suitableEncounters.length);
    return suitableEncounters[index];
  }

  /**
   * Generate a complete POI object
   * @param {string} type - POI type
   * @param {number} col - Hex column
   * @param {number} row - Hex row
   * @param {object} terrain - Terrain type
   * @param {number} startCol - Starting hex column
   * @param {number} startRow - Starting hex row
   * @param {function} random - Seeded random function
   * @returns {object} Complete POI object
   */
  generatePOI(type, col, row, terrain, startCol = 10, startRow = 7, random = Math.random) {
    const cr = this.calculateCR(col, row, startCol, startRow, terrain.difficulty, random);

    switch (type) {
      case POI_TYPES.TOWN:
        return this.generateTown(random);

      case POI_TYPES.DUNGEON:
        return this.generateDungeon(cr, terrain, random);

      case POI_TYPES.SHRINE:
        return this.generateShrine(random);

      case POI_TYPES.ENCOUNTER:
        return this.generateEncounter(cr, terrain, random);

      case POI_TYPES.CAMP:
        return this.generateCamp(cr, random);

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
    return {
      type: POI_TYPES.TOWN,
      name: name,
      description: `A small settlement offering rest and supplies.`,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      icon: 'Settlement',
      color: '#8B4513'
    };
  }

  generateDungeon(cr, terrain, random) {
    const name = this.dungeonNames[Math.floor(random() * this.dungeonNames.length)];
    const encounter = this.getEncounterForTerrain(terrain, cr, random);

    return {
      type: POI_TYPES.DUNGEON,
      name: name,
      description: `A dangerous dungeon filled with ${encounter.creatures}.`,
      visibleWithoutDiscovery: false,
      eventType: 'active',
      cr: cr,
      creatures: encounter.creatures,
      icon: 'Dungeon',
      color: '#2c3e50'
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
      color: '#e74c3c'
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
      icon: null, // No icon for random encounters
      color: null
    };
  }

  generateCamp(cr, random) {
    const campType = this.campTypes[Math.floor(random() * this.campTypes.length)];

    return {
      type: POI_TYPES.CAMP,
      name: campType.name,
      description: `A ${campType.name} with travelers.`,
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      friendly: campType.friendly,
      icon: 'Camp',
      color: '#8B7355'
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
      cr: cr,
      icon: 'Ruins',
      color: '#95a5a6'
    };
  }

  generateCave(cr, random) {
    return {
      type: POI_TYPES.CAVE,
      name: 'Dark Cave',
      description: 'A dark cave entrance beckons explorers.',
      visibleWithoutDiscovery: true,
      eventType: 'passive',
      cr: cr,
      icon: 'Cave',
      color: '#2c3e50'
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
      cr: cr,
      icon: 'Tower',
      color: '#34495e'
    };
  }
}
