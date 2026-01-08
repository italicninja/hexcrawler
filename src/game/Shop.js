/**
 * Shop class - Represents merchant shops with inventory and pricing
 * D&D 5e inspired shop system for buying and selling items
 */

import { Item } from './Item.js';

export class Shop {
  /**
   * Create a new shop
   * @param {object} config - Shop configuration
   * @param {string} config.name - Shop name (e.g., "Blacksmith", "General Store")
   * @param {string} config.type - Shop type: weapon, armor, general, magic
   * @param {number} config.level - Character level for stock scaling (default: 1)
   * @param {number} config.buyPriceMultiplier - Price multiplier for buying (default: 1.0)
   * @param {number} config.sellPriceMultiplier - Price multiplier for selling (default: 0.5)
   * @param {Item[]} config.inventory - Pre-generated inventory (optional)
   */
  constructor(config = {}) {
    this.name = config.name || 'General Store';
    this.type = config.type || 'general'; // weapon, armor, general, magic
    this.level = config.level || 1;
    this.buyPriceMultiplier = config.buyPriceMultiplier ?? 1.0;
    this.sellPriceMultiplier = config.sellPriceMultiplier ?? 0.5;
    this.inventory = config.inventory || [];

    // Generate inventory if not provided
    if (this.inventory.length === 0) {
      this.generateInventory();
    }
  }

  /**
   * Generate shop inventory based on type and level
   */
  generateInventory() {
    this.inventory = [];
    const itemCount = this.randomInt(8, 12);

    // Determine rarity distribution based on level
    let rarityWeights;
    if (this.level <= 2) {
      rarityWeights = { common: 0.7, uncommon: 0.25, rare: 0.05 };
    } else if (this.level <= 5) {
      rarityWeights = { common: 0.5, uncommon: 0.35, rare: 0.15 };
    } else if (this.level <= 10) {
      rarityWeights = { common: 0.3, uncommon: 0.4, rare: 0.25, 'very rare': 0.05 };
    } else {
      rarityWeights = { common: 0.15, uncommon: 0.3, rare: 0.35, 'very rare': 0.15, legendary: 0.05 };
    }

    // Generate items based on shop type
    for (let i = 0; i < itemCount; i++) {
      const rarity = this.selectRarity(rarityWeights);
      const item = this.generateItemByType(this.type, rarity);
      if (item) {
        this.inventory.push(item);
      }
    }
  }

  /**
   * Select a rarity based on weighted probabilities
   * @param {object} weights - Rarity weights
   * @returns {string} Selected rarity
   */
  selectRarity(weights) {
    const roll = Math.random();
    let cumulative = 0;

    for (const [rarity, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (roll <= cumulative) {
        return rarity;
      }
    }

    return 'common'; // Fallback
  }

  /**
   * Generate an item based on shop type and rarity
   * @param {string} shopType - Shop type
   * @param {string} rarity - Item rarity
   * @returns {Item|null} Generated item
   */
  generateItemByType(shopType, rarity) {
    const itemTables = {
      weapon: this.getWeaponsByRarity(rarity),
      armor: this.getArmorByRarity(rarity),
      general: this.getGeneralItemsByRarity(rarity),
      magic: this.getMagicItemsByRarity(rarity)
    };

    const itemPool = itemTables[shopType] || itemTables.general;
    if (itemPool.length === 0) return null;

    const itemData = itemPool[Math.floor(Math.random() * itemPool.length)];
    return new Item({ ...itemData, rarity });
  }

  /**
   * Get weapons by rarity
   * @param {string} rarity
   * @returns {Array} Weapon configurations
   */
  getWeaponsByRarity(rarity) {
    const tables = {
      common: [
        { name: 'Iron Sword', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'slashing', effects: {}, weight: 3, value: 10, description: 'A basic iron sword.' },
        { name: 'Wooden Club', type: 'weapon', slot: 'mainHand', damage: '1d6', damageType: 'bludgeoning', effects: {}, weight: 2, value: 5, description: 'A simple wooden club.' },
        { name: 'Spear', type: 'weapon', slot: 'mainHand', damage: '1d6', damageType: 'piercing', effects: {}, weight: 3, value: 10, description: 'A basic spear.' },
        { name: 'Shortbow', type: 'weapon', slot: 'mainHand', damage: '1d6', damageType: 'piercing', effects: {}, weight: 2, value: 15, description: 'A simple hunting bow.', twoHanded: true },
        { name: 'Dagger', type: 'weapon', slot: 'mainHand', damage: '1d4', damageType: 'piercing', effects: {}, weight: 1, value: 5, description: 'A basic dagger.' }
      ],
      uncommon: [
        { name: 'Steel Longsword', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'slashing', effects: { attackBonus: 1 }, weight: 3, value: 100, description: 'A well-crafted steel sword.' },
        { name: 'Battle Axe', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'slashing', effects: { attackBonus: 1 }, weight: 4, value: 120, description: 'A heavy battle axe.' },
        { name: 'Warhammer', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'bludgeoning', effects: { attackBonus: 1 }, weight: 5, value: 110, description: 'A sturdy warhammer.' },
        { name: 'Longbow +1', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'piercing', effects: { attackBonus: 1 }, weight: 2, value: 150, description: 'A finely crafted longbow.', twoHanded: true },
        { name: 'Rapier', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'piercing', effects: { attackBonus: 1 }, weight: 2, value: 100, description: 'A elegant rapier.' }
      ],
      rare: [
        { name: 'Flaming Sword +1', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'slashing', effects: { attackBonus: 1, damageBonus: 2 }, weight: 3, value: 1000, description: 'A sword wreathed in flames.' },
        { name: 'Greataxe +2', type: 'weapon', slot: 'mainHand', damage: '1d12', damageType: 'slashing', effects: { attackBonus: 2, damageBonus: 2 }, weight: 7, value: 1200, description: 'A massive magical greataxe.', twoHanded: true },
        { name: 'Frost Warhammer', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'bludgeoning', effects: { attackBonus: 1, damageBonus: 2 }, weight: 5, value: 1100, description: 'A hammer imbued with frost.' },
        { name: 'Bow of Accuracy +2', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'piercing', effects: { attackBonus: 2, damageBonus: 2 }, weight: 2, value: 1500, description: 'A bow that never misses.', twoHanded: true }
      ],
      'very rare': [
        { name: 'Vorpal Blade +3', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'slashing', effects: { attackBonus: 3, damageBonus: 3 }, weight: 3, value: 10000, description: 'A legendary blade that severs heads.' }
      ],
      legendary: [
        { name: 'Holy Avenger +5', type: 'weapon', slot: 'mainHand', damage: '1d8', damageType: 'slashing', effects: { attackBonus: 5, damageBonus: 5, ac: 2 }, weight: 3, value: 50000, description: 'The ultimate weapon against evil.' }
      ]
    };

    return tables[rarity] || [];
  }

  /**
   * Get armor by rarity
   * @param {string} rarity
   * @returns {Array} Armor configurations
   */
  getArmorByRarity(rarity) {
    const tables = {
      common: [
        { name: 'Leather Armor', type: 'armor', slot: 'chest', armorType: 'light', effects: { ac: 1 }, weight: 10, value: 20, description: 'Basic leather armor.' },
        { name: 'Padded Armor', type: 'armor', slot: 'chest', armorType: 'light', effects: { ac: 1 }, weight: 8, value: 15, description: 'Simple padded armor.' },
        { name: 'Leather Boots', type: 'armor', slot: 'feet', effects: {}, weight: 2, value: 10, description: 'Sturdy leather boots.' },
        { name: 'Leather Gloves', type: 'armor', slot: 'hands', effects: {}, weight: 1, value: 8, description: 'Basic leather gloves.' },
        { name: 'Wooden Shield', type: 'armor', slot: 'offHand', armorType: 'shield', effects: { ac: 1 }, weight: 6, value: 10, description: 'A basic wooden shield.' }
      ],
      uncommon: [
        { name: 'Studded Leather', type: 'armor', slot: 'chest', armorType: 'light', effects: { ac: 2 }, weight: 13, value: 100, description: 'Leather armor with metal studs.' },
        { name: 'Chain Shirt', type: 'armor', slot: 'chest', armorType: 'medium', effects: { ac: 3 }, weight: 20, value: 150, description: 'A shirt of chain mail.' },
        { name: 'Boots of Striding', type: 'armor', slot: 'feet', effects: { speed: 5 }, weight: 2, value: 120, description: 'Boots that enhance movement.' },
        { name: 'Gauntlets of Ogre Power', type: 'armor', slot: 'hands', effects: { str: 1 }, weight: 2, value: 150, description: 'Gloves that enhance strength.' },
        { name: 'Steel Shield +1', type: 'armor', slot: 'offHand', armorType: 'shield', effects: { ac: 3 }, weight: 6, value: 120, description: 'A reinforced steel shield.' }
      ],
      rare: [
        { name: 'Mithril Chain Mail', type: 'armor', slot: 'chest', armorType: 'medium', effects: { ac: 4, dex: 1 }, weight: 20, value: 1500, description: 'Lightweight mithril armor.' },
        { name: 'Plate Armor +1', type: 'armor', slot: 'chest', armorType: 'heavy', effects: { ac: 6 }, weight: 50, value: 2000, description: 'Enhanced plate armor.' },
        { name: 'Winged Boots', type: 'armor', slot: 'feet', effects: { dex: 2, speed: 15 }, weight: 1, value: 1800, description: 'Boots that grant flight.' },
        { name: 'Helm of Brilliance', type: 'armor', slot: 'head', effects: { int: 2, wis: 1 }, weight: 3, value: 1600, description: 'A helm that enhances mind.' },
        { name: 'Tower Shield +2', type: 'armor', slot: 'offHand', armorType: 'shield', effects: { ac: 5 }, weight: 10, value: 1700, description: 'A massive protective shield.' }
      ],
      'very rare': [
        { name: 'Plate Armor +3', type: 'armor', slot: 'chest', armorType: 'heavy', effects: { ac: 10 }, weight: 50, value: 12000, description: 'Masterwork plate armor.' }
      ],
      legendary: [
        { name: 'Armor of Invulnerability', type: 'armor', slot: 'chest', armorType: 'heavy', effects: { ac: 12, hp: 20 }, weight: 50, value: 75000, description: 'Nearly indestructible armor.' }
      ]
    };

    return tables[rarity] || [];
  }

  /**
   * Get general store items by rarity
   * @param {string} rarity
   * @returns {Array} General item configurations
   */
  getGeneralItemsByRarity(rarity) {
    const tables = {
      common: [
        { name: 'Potion of Minor Healing', type: 'consumable', effects: { hp: 5 }, weight: 0.5, value: 25, consumable: true, description: 'Restores 5 HP.' },
        { name: 'Rations (5 days)', type: 'misc', effects: {}, weight: 5, value: 10, description: 'Dried food for 5 days.' },
        { name: 'Waterskin (5 days)', type: 'misc', effects: {}, weight: 5, value: 5, description: 'Water for 5 days.' },
        { name: 'Rope (50ft)', type: 'misc', effects: {}, weight: 10, value: 2, description: 'Sturdy hemp rope.' },
        { name: 'Torch (10)', type: 'misc', effects: {}, weight: 5, value: 5, description: 'Pack of 10 torches.' },
        { name: 'Bedroll', type: 'misc', effects: {}, weight: 7, value: 3, description: 'A bedroll for camping.' },
        { name: 'Backpack', type: 'misc', effects: {}, weight: 5, value: 5, description: 'A sturdy backpack.' },
        { name: 'Tinderbox', type: 'misc', effects: {}, weight: 1, value: 2, description: 'For starting fires.' },
        { name: 'Raft', type: 'misc', effects: { allowsRiverCrossing: true }, weight: 50, value: 25, description: 'A simple wooden raft that allows crossing rivers. Not sturdy enough for deep water.' }
      ],
      uncommon: [
        { name: 'Potion of Healing', type: 'consumable', effects: { hp: 10 }, weight: 0.5, value: 50, consumable: true, description: 'Restores 10 HP.' },
        { name: 'Potion of Climbing', type: 'consumable', effects: { speed: 10 }, weight: 0.5, value: 75, consumable: true, description: 'Grants climbing ability for 1 hour.' },
        { name: 'Oil of Slipperiness', type: 'consumable', effects: {}, weight: 0.5, value: 80, consumable: true, description: 'Makes surfaces slippery.' },
        { name: 'Antitoxin', type: 'consumable', effects: {}, weight: 0.5, value: 50, consumable: true, description: 'Cures poison.' },
        { name: 'Boat', type: 'misc', effects: { allowsWaterCrossing: true, allowsRiverCrossing: true }, weight: 100, value: 50, description: 'A sturdy rowboat that allows crossing deep water and rivers.' }
      ],
      rare: [
        { name: 'Potion of Greater Healing', type: 'consumable', effects: { hp: 20 }, weight: 0.5, value: 150, consumable: true, description: 'Restores 20 HP.' },
        { name: 'Potion of Strength', type: 'consumable', effects: { str: 2 }, weight: 0.5, value: 200, consumable: true, description: 'Grants +2 STR for 1 hour.' },
        { name: 'Potion of Resistance', type: 'consumable', effects: { ac: 2 }, weight: 0.5, value: 250, consumable: true, description: 'Grants damage resistance.' }
      ],
      'very rare': [
        { name: 'Potion of Supreme Healing', type: 'consumable', effects: { hp: 50 }, weight: 0.5, value: 500, consumable: true, description: 'Restores 50 HP.' }
      ],
      legendary: [
        { name: 'Potion of Invulnerability', type: 'consumable', effects: { hp: 100, ac: 5 }, weight: 0.5, value: 5000, consumable: true, description: 'Grants temporary invulnerability.' }
      ]
    };

    return tables[rarity] || tables.common;
  }

  /**
   * Get magic items by rarity
   * @param {string} rarity
   * @returns {Array} Magic item configurations
   */
  getMagicItemsByRarity(rarity) {
    const tables = {
      common: [
        { name: 'Cantrip Scroll', type: 'misc', effects: {}, weight: 0.1, value: 25, description: 'A scroll with a basic cantrip.' },
        { name: 'Potion of Minor Healing', type: 'consumable', effects: { hp: 5 }, weight: 0.5, value: 25, consumable: true, description: 'Restores 5 HP.' }
      ],
      uncommon: [
        { name: 'Ring of Protection', type: 'armor', slot: 'ring1', effects: { ac: 1 }, weight: 0.1, value: 200, description: 'A protective ring.' },
        { name: 'Cloak of Protection', type: 'armor', slot: 'chest', effects: { ac: 1 }, weight: 1, value: 180, description: 'A protective cloak.' },
        { name: 'Wand of Magic Missiles', type: 'weapon', slot: 'mainHand', damage: '1d4', damageType: 'force', effects: {}, weight: 1, value: 300, description: 'Casts magic missile.', charges: 7, maxCharges: 7 },
        { name: 'Scroll of Fireball', type: 'misc', effects: {}, weight: 0.1, value: 150, consumable: true, description: 'Casts fireball spell once.' }
      ],
      rare: [
        { name: 'Ring of Spell Storing', type: 'armor', slot: 'ring1', effects: { int: 2 }, weight: 0.1, value: 1500, description: 'Stores magical energy.', charges: 5, maxCharges: 5 },
        { name: 'Staff of Power', type: 'weapon', slot: 'mainHand', damage: '1d6', damageType: 'bludgeoning', effects: { int: 2 }, weight: 4, value: 2000, description: 'A powerful magical staff.', charges: 20, maxCharges: 20 },
        { name: 'Amulet of Health', type: 'armor', slot: 'neck', effects: { con: 2, hp: 10 }, weight: 0.5, value: 1800, description: 'Bolsters vitality.' }
      ],
      'very rare': [
        { name: 'Ring of Invisibility', type: 'armor', slot: 'ring1', effects: { dex: 3 }, weight: 0.1, value: 10000, description: 'Grants invisibility.', charges: 3, maxCharges: 3 },
        { name: 'Amulet of the Planes', type: 'armor', slot: 'neck', effects: { wis: 3, int: 2 }, weight: 0.5, value: 12000, description: 'Allows planar travel.' }
      ],
      legendary: [
        { name: 'Ring of Three Wishes', type: 'armor', slot: 'ring1', effects: {}, weight: 0.1, value: 100000, description: 'Grants three wishes.', charges: 3, maxCharges: 3 },
        { name: 'Staff of the Magi', type: 'weapon', slot: 'mainHand', damage: '1d6', damageType: 'bludgeoning', effects: { int: 5, wis: 3 }, weight: 4, value: 150000, description: 'Ultimate magical staff.', charges: 50, maxCharges: 50 }
      ]
    };

    return tables[rarity] || tables.uncommon;
  }

  /**
   * Calculate buy price for an item (what player pays)
   * @param {Item} item - Item to buy
   * @returns {number} Buy price in gold
   */
  getBuyPrice(item) {
    return Math.ceil(item.value * this.buyPriceMultiplier);
  }

  /**
   * Calculate sell price for an item (what shop pays player)
   * @param {Item} item - Item to sell
   * @returns {number} Sell price in gold
   */
  getSellPrice(item) {
    return Math.floor(item.value * this.sellPriceMultiplier);
  }

  /**
   * Buy an item from the shop (remove from shop inventory)
   * @param {string} itemId - Item ID to buy
   * @returns {Item|null} Purchased item or null if not found
   */
  buyItem(itemId) {
    const index = this.inventory.findIndex(item => item.id === itemId);
    if (index === -1) return null;

    const item = this.inventory[index];
    this.inventory.splice(index, 1);
    return item;
  }

  /**
   * Sell an item to the shop (add to shop inventory)
   * @param {Item} item - Item to sell
   */
  sellItem(item) {
    this.inventory.push(item);
  }

  /**
   * Random integer helper
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Serialize to JSON
   * @returns {object}
   */
  toJSON() {
    return {
      name: this.name,
      type: this.type,
      level: this.level,
      buyPriceMultiplier: this.buyPriceMultiplier,
      sellPriceMultiplier: this.sellPriceMultiplier,
      inventory: this.inventory.map(item => item.toJSON())
    };
  }

  /**
   * Load from JSON
   * @param {object} data - JSON data
   * @returns {Shop} Shop instance
   */
  static fromJSON(data) {
    return new Shop({
      name: data.name,
      type: data.type,
      level: data.level,
      buyPriceMultiplier: data.buyPriceMultiplier,
      sellPriceMultiplier: data.sellPriceMultiplier,
      inventory: (data.inventory || []).map(itemData => Item.fromJSON(itemData))
    });
  }
}

export default Shop;
