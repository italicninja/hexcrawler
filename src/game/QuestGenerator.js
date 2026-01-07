/**
 * QuestGenerator.js - Procedural Quest Generation System
 * Part of D&D 5e Hexcrawler - Task 4.4 (Quest Givers)
 *
 * Generates quests based on character level and nearby terrain
 */

import { Quest, ObjectiveType, QuestStatus } from './Quest.js';
import { DiceRoller } from './DiceRoller.js';

export class QuestGenerator {
  constructor(seed = null) {
    this.roller = new DiceRoller(seed);
  }

  /**
   * Generate a random quest
   * @param {number} level - Character level
   * @param {Object} location - Quest giver location {col, row}
   * @param {string} questGiverName - Name of the quest giver
   * @param {Array} nearbyTerrain - Array of nearby terrain types
   * @returns {Quest}
   */
  generateQuest(level, location, questGiverName = 'Town Elder', nearbyTerrain = []) {
    const questTypes = ['kill', 'collect', 'explore', 'deliver'];
    const questType = questTypes[Math.floor(this.roller.random() * questTypes.length)];

    let quest;
    switch (questType) {
      case 'kill':
        quest = this.generateKillQuest(level, location, questGiverName, nearbyTerrain);
        break;
      case 'collect':
        quest = this.generateCollectQuest(level, location, questGiverName, nearbyTerrain);
        break;
      case 'explore':
        quest = this.generateExploreQuest(level, location, questGiverName, nearbyTerrain);
        break;
      case 'deliver':
        quest = this.generateDeliverQuest(level, location, questGiverName, nearbyTerrain);
        break;
      default:
        quest = this.generateKillQuest(level, location, questGiverName, nearbyTerrain);
    }

    return quest;
  }

  /**
   * Generate a kill quest
   */
  generateKillQuest(level, location, questGiverName, nearbyTerrain) {
    const difficulty = level + Math.floor(this.roller.random() * 3) - 1; // ±1 level variance
    const enemy = this.selectEnemyForLevel(difficulty, nearbyTerrain);
    const count = 5 + Math.floor(difficulty * 1.5) + Math.floor(this.roller.random() * 5);

    const title = this.getKillQuestTitle(enemy.name);
    const description = this.getKillQuestDescription(enemy.name, count);

    const objectives = [
      Quest.createKillObjective(enemy.name, count)
    ];

    const rewards = this.calculateRewards(difficulty, 'kill');

    return new Quest({
      title,
      description,
      objectives,
      rewards,
      status: QuestStatus.AVAILABLE,
      questGiver: questGiverName,
      location: `${location.col},${location.row}`,
      level: difficulty
    });
  }

  /**
   * Generate a collect quest
   */
  generateCollectQuest(level, location, questGiverName, nearbyTerrain) {
    const difficulty = level + Math.floor(this.roller.random() * 3) - 1;
    const item = this.selectCollectibleItem(difficulty, nearbyTerrain);
    const count = 3 + Math.floor(this.roller.random() * 6); // 3-8 items

    const title = this.getCollectQuestTitle(item.name);
    const description = this.getCollectQuestDescription(item.name, count);

    const objectives = [
      Quest.createCollectObjective(item.name, count)
    ];

    const rewards = this.calculateRewards(difficulty, 'collect');

    return new Quest({
      title,
      description,
      objectives,
      rewards,
      status: QuestStatus.AVAILABLE,
      questGiver: questGiverName,
      location: `${location.col},${location.row}`,
      level: difficulty
    });
  }

  /**
   * Generate an explore quest
   */
  generateExploreQuest(level, location, questGiverName, nearbyTerrain) {
    const difficulty = level + Math.floor(this.roller.random() * 3) - 1;
    const poiType = this.selectPOIType(nearbyTerrain);

    const title = this.getExploreQuestTitle(poiType);
    const description = this.getExploreQuestDescription(poiType);

    const objectives = [
      Quest.createVisitObjective(poiType, 1)
    ];

    const rewards = this.calculateRewards(difficulty, 'explore');

    return new Quest({
      title,
      description,
      objectives,
      rewards,
      status: QuestStatus.AVAILABLE,
      questGiver: questGiverName,
      location: `${location.col},${location.row}`,
      level: difficulty
    });
  }

  /**
   * Generate a delivery quest
   */
  generateDeliverQuest(level, location, questGiverName, nearbyTerrain) {
    const difficulty = level + Math.floor(this.roller.random() * 3) - 1;
    const item = this.selectDeliveryItem(difficulty);
    const recipient = this.generateRecipientName();

    const title = `Deliver ${item.name}`;
    const description = `${questGiverName} needs you to deliver ${item.name} to ${recipient} in a nearby town. The journey may be dangerous, so stay alert.`;

    const objectives = [
      Quest.createDeliverObjective(item.name, recipient, 1)
    ];

    const rewards = this.calculateRewards(difficulty, 'deliver');

    return new Quest({
      title,
      description,
      objectives,
      rewards,
      status: QuestStatus.AVAILABLE,
      questGiver: questGiverName,
      location: `${location.col},${location.row}`,
      level: difficulty
    });
  }

  /**
   * Select enemy appropriate for level
   */
  selectEnemyForLevel(level, nearbyTerrain = []) {
    const enemies = {
      low: [
        { name: 'Goblin', cr: 0, terrains: ['forest', 'hills'] },
        { name: 'Wolf', cr: 0, terrains: ['forest', 'grassland'] },
        { name: 'Bandit', cr: 1, terrains: ['grassland', 'forest'] },
        { name: 'Skeleton', cr: 0, terrains: ['desert', 'swamp'] },
        { name: 'Giant Rat', cr: 0, terrains: ['swamp', 'forest'] }
      ],
      medium: [
        { name: 'Orc', cr: 2, terrains: ['hills', 'mountain'] },
        { name: 'Hobgoblin', cr: 2, terrains: ['forest', 'hills'] },
        { name: 'Ogre', cr: 3, terrains: ['mountain', 'hills'] },
        { name: 'Ghoul', cr: 2, terrains: ['swamp', 'desert'] },
        { name: 'Worg', cr: 2, terrains: ['forest', 'grassland'] }
      ],
      high: [
        { name: 'Troll', cr: 5, terrains: ['swamp', 'mountain'] },
        { name: 'Hill Giant', cr: 6, terrains: ['mountain', 'hills'] },
        { name: 'Wyvern', cr: 6, terrains: ['mountain'] },
        { name: 'Vampire Spawn', cr: 5, terrains: ['forest', 'swamp'] },
        { name: 'Chimera', cr: 6, terrains: ['mountain', 'desert'] }
      ]
    };

    let category;
    if (level <= 3) {
      category = 'low';
    } else if (level <= 7) {
      category = 'medium';
    } else {
      category = 'high';
    }

    const candidates = enemies[category];

    // Try to match terrain if available
    if (nearbyTerrain && nearbyTerrain.length > 0) {
      const terrainMatches = candidates.filter(enemy =>
        enemy.terrains.some(t => nearbyTerrain.includes(t))
      );
      if (terrainMatches.length > 0) {
        return terrainMatches[Math.floor(this.roller.random() * terrainMatches.length)];
      }
    }

    // Otherwise, random selection
    return candidates[Math.floor(this.roller.random() * candidates.length)];
  }

  /**
   * Select collectible item
   */
  selectCollectibleItem(level, nearbyTerrain = []) {
    const items = [
      { name: 'Wolf Pelt', level: 1, terrains: ['forest', 'grassland'] },
      { name: 'Goblin Ear', level: 1, terrains: ['forest', 'hills'] },
      { name: 'Rare Herb', level: 2, terrains: ['forest', 'swamp'] },
      { name: 'Ancient Coin', level: 3, terrains: ['desert', 'mountain'] },
      { name: 'Crystal Shard', level: 4, terrains: ['mountain'] },
      { name: 'Mushroom Spore', level: 2, terrains: ['swamp', 'forest'] },
      { name: 'Dragon Scale', level: 7, terrains: ['mountain'] },
      { name: 'Phoenix Feather', level: 8, terrains: ['desert', 'mountain'] }
    ];

    const levelAppropriate = items.filter(item => item.level <= level + 1);

    // Try terrain matching
    if (nearbyTerrain && nearbyTerrain.length > 0) {
      const terrainMatches = levelAppropriate.filter(item =>
        item.terrains.some(t => nearbyTerrain.includes(t))
      );
      if (terrainMatches.length > 0) {
        return terrainMatches[Math.floor(this.roller.random() * terrainMatches.length)];
      }
    }

    return levelAppropriate[Math.floor(this.roller.random() * levelAppropriate.length)] || items[0];
  }

  /**
   * Select POI type for exploration
   */
  selectPOIType(nearbyTerrain = []) {
    const poiTypes = ['cave', 'ruins', 'tower', 'dungeon'];
    return poiTypes[Math.floor(this.roller.random() * poiTypes.length)];
  }

  /**
   * Select delivery item
   */
  selectDeliveryItem(level) {
    const items = [
      { name: 'Sealed Letter', level: 1 },
      { name: 'Package of Supplies', level: 1 },
      { name: 'Valuable Artifact', level: 3 },
      { name: 'Magical Scroll', level: 4 },
      { name: 'Family Heirloom', level: 2 }
    ];

    const appropriate = items.filter(item => item.level <= level + 1);
    return appropriate[Math.floor(this.roller.random() * appropriate.length)] || items[0];
  }

  /**
   * Generate recipient name for delivery quests
   */
  generateRecipientName() {
    const firstNames = ['Eldrin', 'Mara', 'Theron', 'Lyra', 'Gareth', 'Selene', 'Bran', 'Aria'];
    const titles = ['the Wise', 'the Brave', 'the Merchant', 'the Smith', 'the Healer'];

    const firstName = firstNames[Math.floor(this.roller.random() * firstNames.length)];
    const title = titles[Math.floor(this.roller.random() * titles.length)];

    return `${firstName} ${title}`;
  }

  /**
   * Calculate quest rewards based on difficulty
   */
  calculateRewards(difficulty, questType) {
    let xpBase, goldBase;

    // Base rewards by level
    if (difficulty <= 2) {
      xpBase = 100;
      goldBase = 50;
    } else if (difficulty <= 5) {
      xpBase = 300;
      goldBase = 100;
    } else if (difficulty <= 8) {
      xpBase = 800;
      goldBase = 250;
    } else {
      xpBase = 2000;
      goldBase = 500;
    }

    // Modify by quest type
    const typeMultipliers = {
      kill: 1.2,
      collect: 1.0,
      explore: 1.1,
      deliver: 0.9
    };

    const multiplier = typeMultipliers[questType] || 1.0;

    const xp = Math.floor(xpBase * multiplier * (0.8 + this.roller.random() * 0.4)); // ±20% variance
    const gold = Math.floor(goldBase * multiplier * (0.8 + this.roller.random() * 0.4));

    const rewards = { xp, gold, items: [] };

    // 20% chance of item reward
    if (this.roller.random() < 0.2) {
      rewards.items.push(this.generateRewardItem(difficulty));
    }

    return rewards;
  }

  /**
   * Generate a reward item
   */
  generateRewardItem(level) {
    const items = [
      'Healing Potion',
      'Magic Dagger +1',
      'Ring of Protection',
      'Cloak of Resistance',
      'Scroll of Fireball'
    ];

    return items[Math.floor(this.roller.random() * items.length)];
  }

  /**
   * Get kill quest title
   */
  getKillQuestTitle(enemyName) {
    const templates = [
      `${enemyName} Menace`,
      `Clear the ${enemyName}s`,
      `Hunt the ${enemyName}s`,
      `${enemyName} Extermination`,
      `Eliminate the ${enemyName} Threat`
    ];
    return templates[Math.floor(this.roller.random() * templates.length)];
  }

  /**
   * Get kill quest description
   */
  getKillQuestDescription(enemyName, count) {
    const templates = [
      `A pack of ${enemyName}s has been terrorizing the area. Defeat ${count} of them to restore peace.`,
      `The local militia is overwhelmed by ${enemyName} attacks. Help them by eliminating ${count} ${enemyName}s.`,
      `${count} ${enemyName}s have been spotted near trade routes. Clear them out to make travel safe again.`,
      `Villagers are living in fear of ${enemyName} raids. Slay ${count} of these creatures to protect the innocent.`
    ];
    return templates[Math.floor(this.roller.random() * templates.length)];
  }

  /**
   * Get collect quest title
   */
  getCollectQuestTitle(itemName) {
    const templates = [
      `Gather ${itemName}s`,
      `${itemName} Collection`,
      `In Search of ${itemName}s`,
      `The ${itemName} Bounty`
    ];
    return templates[Math.floor(this.roller.random() * templates.length)];
  }

  /**
   * Get collect quest description
   */
  getCollectQuestDescription(itemName, count) {
    const templates = [
      `I need ${count} ${itemName}s for my research. Bring them to me and you'll be well compensated.`,
      `The town needs ${count} ${itemName}s. Search the wilderness and return with what you find.`,
      `A rare opportunity! I'll pay handsomely for ${count} ${itemName}s. Can you help?`,
      `Gather ${count} ${itemName}s from the surrounding area. They're valuable and I need them urgently.`
    ];
    return templates[Math.floor(this.roller.random() * templates.length)];
  }

  /**
   * Get explore quest title
   */
  getExploreQuestTitle(poiType) {
    const templates = {
      cave: ['Explore the Dark Cave', 'Mystery of the Cave', 'Cave Expedition'],
      ruins: ['Ancient Ruins Discovery', 'Explore the Ruins', 'Lost Ruins Investigation'],
      tower: ['Tower of Secrets', 'Explore the Tower', 'The Abandoned Tower'],
      dungeon: ['Dungeon Delve', 'Explore the Dungeon', 'The Forgotten Dungeon']
    };

    const options = templates[poiType] || templates['cave'];
    return options[Math.floor(this.roller.random() * options.length)];
  }

  /**
   * Get explore quest description
   */
  getExploreQuestDescription(poiType) {
    const templates = {
      cave: 'A mysterious cave has been discovered nearby. Explore it and report what you find.',
      ruins: 'Ancient ruins hold secrets of the past. Venture inside and uncover their mysteries.',
      tower: 'An old tower stands abandoned. Investigate it and return with your findings.',
      dungeon: 'A dungeon entrance has been found. Brave its depths and discover what lies within.'
    };

    return templates[poiType] || templates['cave'];
  }

  /**
   * Generate multiple quests for a town
   */
  generateTownQuests(level, location, count = 3, nearbyTerrain = []) {
    const questGivers = [
      'Village Elder',
      'Town Guard Captain',
      'Local Merchant',
      'Traveling Sage'
    ];

    const quests = [];
    for (let i = 0; i < count; i++) {
      const questGiver = questGivers[i % questGivers.length];
      const quest = this.generateQuest(level, location, questGiver, nearbyTerrain);
      quests.push(quest);
    }

    return quests;
  }
}

export default QuestGenerator;
