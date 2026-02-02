/**
 * LootGenerator - Generates loot based on Challenge Rating
 * Creates treasure hoards with gold, items, and rarity scaling
 */

import { BaseGenerator } from './BaseGenerator.js';
import { Item } from './Item.js';

export class LootGenerator extends BaseGenerator {
  constructor() {
    super();

    // CR-to-loot mapping tables
    this.lootTables = {
      // CR 0-1: Common loot, low gold
      0: {
        goldMin: 10,
        goldMax: 50,
        rarity: 'common',
        itemCountMin: 0,
        itemCountMax: 1,
      },
      1: {
        goldMin: 20,
        goldMax: 100,
        rarity: 'common',
        itemCountMin: 0,
        itemCountMax: 1,
      },
      // CR 2-4: Uncommon loot, moderate gold
      2: {
        goldMin: 50,
        goldMax: 200,
        rarity: 'uncommon',
        itemCountMin: 1,
        itemCountMax: 2,
      },
      3: {
        goldMin: 100,
        goldMax: 300,
        rarity: 'uncommon',
        itemCountMin: 1,
        itemCountMax: 2,
      },
      4: {
        goldMin: 150,
        goldMax: 400,
        rarity: 'uncommon',
        itemCountMin: 1,
        itemCountMax: 2,
      },
      // CR 5-7: Rare loot, high gold
      5: {
        goldMin: 200,
        goldMax: 1000,
        rarity: 'rare',
        itemCountMin: 1,
        itemCountMax: 3,
      },
      6: {
        goldMin: 500,
        goldMax: 1500,
        rarity: 'rare',
        itemCountMin: 1,
        itemCountMax: 3,
      },
      7: {
        goldMin: 750,
        goldMax: 2000,
        rarity: 'rare',
        itemCountMin: 2,
        itemCountMax: 3,
      },
      // CR 8-10: Very rare loot, very high gold
      8: {
        goldMin: 1000,
        goldMax: 5000,
        rarity: 'very rare',
        itemCountMin: 2,
        itemCountMax: 4,
      },
      9: {
        goldMin: 2000,
        goldMax: 7500,
        rarity: 'very rare',
        itemCountMin: 2,
        itemCountMax: 4,
      },
      10: {
        goldMin: 3000,
        goldMax: 10000,
        rarity: 'very rare',
        itemCountMin: 2,
        itemCountMax: 4,
      },
      // CR 11+: Legendary loot, massive gold
      11: {
        goldMin: 5000,
        goldMax: 20000,
        rarity: 'legendary',
        itemCountMin: 2,
        itemCountMax: 5,
      },
    };

    // Item data tables by rarity - these define actual Item configurations
    this.itemData = {
      common: [
        {
          name: 'Rusty Sword',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d6',
          damageType: 'slashing',
          effects: {},
          weight: 3,
          value: 5,
          description: 'A worn but serviceable blade.',
        },
        {
          name: 'Worn Leather Armor',
          type: 'armor',
          slot: 'chest',
          armorType: 'light',
          effects: { ac: 1 },
          weight: 10,
          value: 10,
          description: 'Leather armor that has seen better days.',
        },
        {
          name: 'Simple Bow',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d6',
          damageType: 'piercing',
          effects: {},
          weight: 2,
          value: 10,
          description: 'A basic hunting bow.',
          twoHanded: true,
        },
        {
          name: 'Iron Dagger',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d4',
          damageType: 'piercing',
          effects: {},
          weight: 1,
          value: 2,
          description: 'A simple iron dagger.',
        },
        {
          name: 'Wooden Shield',
          type: 'armor',
          slot: 'offHand',
          armorType: 'shield',
          effects: { ac: 1 },
          weight: 6,
          value: 5,
          description: 'A basic wooden shield.',
        },
        {
          name: 'Potion of Minor Healing',
          type: 'consumable',
          effects: { hp: 5 },
          weight: 0.5,
          value: 10,
          consumable: true,
          description: 'Restores 5 hit points when consumed.',
        },
        {
          name: 'Rations (5 days)',
          type: 'misc',
          effects: {},
          weight: 5,
          value: 5,
          description: 'Dried food that lasts for 5 days.',
        },
        {
          name: 'Rope (50ft)',
          type: 'misc',
          effects: {},
          weight: 10,
          value: 1,
          description: 'Sturdy hemp rope.',
        },
        {
          name: 'Torch',
          type: 'misc',
          effects: {},
          weight: 1,
          value: 1,
          description: 'Provides light for 1 hour.',
        },
        {
          name: 'Waterskin',
          type: 'misc',
          effects: {},
          weight: 5,
          value: 2,
          description: 'Holds 1 day worth of water.',
        },
      ],
      uncommon: [
        {
          name: 'Silver Longsword',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d8',
          damageType: 'slashing',
          effects: { attackBonus: 1 },
          weight: 3,
          value: 50,
          description: 'A well-crafted silver sword.',
        },
        {
          name: 'Studded Leather Armor',
          type: 'armor',
          slot: 'chest',
          armorType: 'light',
          effects: { ac: 2 },
          weight: 13,
          value: 45,
          description: 'Leather armor reinforced with metal studs.',
        },
        {
          name: 'Longbow',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d8',
          damageType: 'piercing',
          effects: { attackBonus: 1 },
          weight: 2,
          value: 50,
          description: 'A finely crafted longbow.',
          twoHanded: true,
        },
        {
          name: 'Steel Dagger +1',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d4',
          damageType: 'piercing',
          effects: { attackBonus: 1, damageBonus: 1 },
          weight: 1,
          value: 40,
          description: 'A magically enhanced steel dagger.',
        },
        {
          name: 'Iron Shield +1',
          type: 'armor',
          slot: 'offHand',
          armorType: 'shield',
          effects: { ac: 3 },
          weight: 6,
          value: 50,
          description: 'A reinforced iron shield.',
        },
        {
          name: 'Potion of Healing',
          type: 'consumable',
          effects: { hp: 10 },
          weight: 0.5,
          value: 50,
          consumable: true,
          description: 'Restores 10 hit points when consumed.',
        },
        {
          name: 'Ring of Protection',
          type: 'armor',
          slot: 'ring1',
          effects: { ac: 1 },
          weight: 0.1,
          value: 100,
          description: 'A magical ring that provides protection.',
        },
        {
          name: 'Cloak of Resistance',
          type: 'armor',
          slot: 'chest',
          effects: { ac: 1 },
          weight: 1,
          value: 80,
          description: 'A cloak that grants resistance to harm.',
        },
        {
          name: 'Boots of Elvenkind',
          type: 'armor',
          slot: 'feet',
          effects: { dex: 1 },
          weight: 1,
          value: 75,
          description: 'Boots that enhance agility and stealth.',
        },
        {
          name: 'Gloves of Strength',
          type: 'armor',
          slot: 'hands',
          effects: { str: 1 },
          weight: 0.5,
          value: 75,
          description: 'Gloves that enhance physical strength.',
        },
      ],
      rare: [
        {
          name: 'Flaming Longsword +1',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d8',
          damageType: 'slashing',
          effects: { attackBonus: 1, damageBonus: 1 },
          weight: 3,
          value: 500,
          description: 'A sword wreathed in magical flames, dealing extra fire damage.',
        },
        {
          name: 'Mithril Chain Mail',
          type: 'armor',
          slot: 'chest',
          armorType: 'medium',
          effects: { ac: 4, dex: 1 },
          weight: 20,
          value: 750,
          description: 'Lightweight yet strong armor made of mithril.',
        },
        {
          name: 'Bow of Accuracy +2',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d8',
          damageType: 'piercing',
          effects: { attackBonus: 2, damageBonus: 2 },
          weight: 2,
          value: 600,
          description: 'A bow that never misses its mark.',
          twoHanded: true,
        },
        {
          name: 'Dagger of Venom',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d4',
          damageType: 'piercing',
          effects: { attackBonus: 1, damageBonus: 2 },
          weight: 1,
          value: 500,
          description: 'A poisoned dagger that inflicts toxic wounds.',
        },
        {
          name: 'Tower Shield +2',
          type: 'armor',
          slot: 'offHand',
          armorType: 'shield',
          effects: { ac: 5 },
          weight: 10,
          value: 600,
          description: 'A massive shield providing exceptional protection.',
        },
        {
          name: 'Potion of Greater Healing',
          type: 'consumable',
          effects: { hp: 20 },
          weight: 0.5,
          value: 150,
          consumable: true,
          description: 'Restores 20 hit points when consumed.',
        },
        {
          name: 'Ring of Spell Storing',
          type: 'armor',
          slot: 'ring1',
          effects: { int: 2 },
          weight: 0.1,
          value: 800,
          description: 'A ring that can store magical energy.',
          charges: 3,
          maxCharges: 3,
        },
        {
          name: 'Boots of Speed',
          type: 'armor',
          slot: 'feet',
          effects: { dex: 2, speed: 10 },
          weight: 1,
          value: 700,
          description: 'Boots that greatly enhance movement speed.',
        },
        {
          name: 'Amulet of Health',
          type: 'armor',
          slot: 'neck',
          effects: { con: 2, hp: 10 },
          weight: 0.5,
          value: 850,
          description: 'An amulet that bolsters vitality and health.',
        },
        {
          name: 'Helm of Brilliance',
          type: 'armor',
          slot: 'head',
          effects: { int: 2, wis: 1 },
          weight: 3,
          value: 750,
          description: 'A helm that enhances mental acuity.',
        },
      ],
      'very rare': [
        {
          name: 'Vorpal Sword',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d8',
          damageType: 'slashing',
          effects: { attackBonus: 3, damageBonus: 3 },
          weight: 3,
          value: 5000,
          description: 'A legendary blade that can sever heads with a critical hit.',
        },
        {
          name: 'Plate Armor +2',
          type: 'armor',
          slot: 'chest',
          armorType: 'heavy',
          effects: { ac: 8 },
          weight: 50,
          value: 6000,
          description: 'Masterwork full plate armor with magical enhancements.',
        },
        {
          name: 'Oathbow',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d8',
          damageType: 'piercing',
          effects: { attackBonus: 3, damageBonus: 3 },
          weight: 2,
          value: 5500,
          description: 'A bow bound by sacred oath to slay evil.',
          twoHanded: true,
        },
        {
          name: 'Frost Brand Dagger',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d4',
          damageType: 'piercing',
          effects: { attackBonus: 2, damageBonus: 3 },
          weight: 1,
          value: 4500,
          description: 'A dagger of eternal ice that freezes foes.',
        },
        {
          name: 'Animated Shield',
          type: 'armor',
          slot: 'offHand',
          armorType: 'shield',
          effects: { ac: 6 },
          weight: 6,
          value: 5500,
          description: 'A shield that defends autonomously.',
        },
        {
          name: 'Potion of Supreme Healing',
          type: 'consumable',
          effects: { hp: 50 },
          weight: 0.5,
          value: 500,
          consumable: true,
          description: 'Restores 50 hit points when consumed.',
        },
        {
          name: 'Ring of Invisibility',
          type: 'armor',
          slot: 'ring1',
          effects: { dex: 3 },
          weight: 0.1,
          value: 7000,
          description: 'A ring that grants the power of invisibility.',
          charges: 3,
          maxCharges: 3,
        },
        {
          name: 'Winged Boots',
          type: 'armor',
          slot: 'feet',
          effects: { dex: 3, speed: 20 },
          weight: 1,
          value: 6500,
          description: 'Boots that grant the power of flight.',
        },
        {
          name: 'Amulet of the Planes',
          type: 'armor',
          slot: 'neck',
          effects: { wis: 3, int: 2 },
          weight: 0.5,
          value: 7500,
          description: 'An amulet that allows planar travel.',
        },
        {
          name: 'Crown of Kings',
          type: 'armor',
          slot: 'head',
          effects: { cha: 4, wis: 2 },
          weight: 2,
          value: 8000,
          description: 'A crown worn by ancient rulers.',
        },
      ],
      legendary: [
        {
          name: 'Holy Avenger',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d8',
          damageType: 'slashing',
          effects: { attackBonus: 5, damageBonus: 5, ac: 2 },
          weight: 3,
          value: 50000,
          description: 'The ultimate weapon against evil, blessed by the gods.',
        },
        {
          name: 'Armor of Invulnerability',
          type: 'armor',
          slot: 'chest',
          armorType: 'heavy',
          effects: { ac: 12, hp: 20 },
          weight: 50,
          value: 75000,
          description: 'Armor that makes the wearer nearly invincible.',
        },
        {
          name: 'Bow of Apollyon',
          type: 'weapon',
          slot: 'mainHand',
          damage: '2d6',
          damageType: 'piercing',
          effects: { attackBonus: 5, damageBonus: 5 },
          weight: 2,
          value: 60000,
          description: 'A bow of divine destruction.',
          twoHanded: true,
        },
        {
          name: 'Luck Blade',
          type: 'weapon',
          slot: 'mainHand',
          damage: '1d6',
          damageType: 'piercing',
          effects: { attackBonus: 5, damageBonus: 5 },
          weight: 1,
          value: 55000,
          description: 'A blade that bends fate itself.',
          charges: 3,
          maxCharges: 3,
        },
        {
          name: 'Defender Shield',
          type: 'armor',
          slot: 'offHand',
          armorType: 'shield',
          effects: { ac: 10 },
          weight: 6,
          value: 65000,
          description: 'An indestructible shield of legend.',
        },
        {
          name: 'Potion of Invulnerability',
          type: 'consumable',
          effects: { hp: 100, ac: 5 },
          weight: 0.5,
          value: 5000,
          consumable: true,
          description: 'Grants temporary invulnerability and full healing.',
        },
        {
          name: 'Ring of Three Wishes',
          type: 'armor',
          slot: 'ring1',
          effects: {},
          weight: 0.1,
          value: 100000,
          description: 'A ring that grants three wishes.',
          charges: 3,
          maxCharges: 3,
        },
        {
          name: 'Boots of Teleportation',
          type: 'armor',
          slot: 'feet',
          effects: { dex: 5 },
          weight: 1,
          value: 70000,
          description: 'Boots that allow instant teleportation.',
          charges: 3,
          maxCharges: 3,
        },
        {
          name: 'Amulet of Resurrection',
          type: 'armor',
          slot: 'neck',
          effects: { con: 5, hp: 50 },
          weight: 0.5,
          value: 80000,
          description: 'An amulet that can bring the dead back to life.',
          charges: 1,
          maxCharges: 1,
        },
        {
          name: 'God-Crown',
          type: 'armor',
          slot: 'head',
          effects: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5 },
          weight: 5,
          value: 150000,
          description: 'A crown forged by the gods themselves.',
        },
      ],
    };

    // Set lookup tables for base class
    this.lookupTables = this.lootTables;
  }

  /**
   * Generate loot for a given CR
   * @param {number} cr - Challenge Rating
   * @param {Function} random - Random function (0-1)
   * @returns {object} { gold, items: Item[], rarity }
   */
  generateLoot(cr, random = Math.random) {
    // Get loot table for this CR (uses base class method with fallback)
    const lootTable = this.getCRTable(cr, 11);

    if (!lootTable) {
      // Fallback to minimal loot
      return { gold: 0, items: [], rarity: 'common' };
    }

    // Generate gold amount using base class utility
    const gold = this.randomInt(lootTable.goldMin, lootTable.goldMax, random);

    // Generate item count using base class utility
    const itemCount = this.randomInt(lootTable.itemCountMin, lootTable.itemCountMax, random);

    // Generate items - create actual Item instances
    const items = [];
    const itemPool = this.itemData[lootTable.rarity];

    for (let i = 0; i < itemCount; i++) {
      const itemData = this.randomChoice(itemPool, random);
      if (itemData) {
        // Create a new Item instance with the rarity set
        const item = new Item({
          ...itemData,
          rarity: lootTable.rarity,
        });
        items.push(item);
      }
    }

    return {
      gold,
      items,
      rarity: lootTable.rarity,
    };
  }

  /**
   * Get rarity color for display
   * @param {string} rarity
   * @returns {string} Hex color
   */
  getRarityColor(rarity) {
    const colors = {
      common: '#9d9d9d',
      uncommon: '#1eff00',
      rare: '#0070dd',
      'very rare': '#a335ee',
      legendary: '#ff8000',
    };
    return colors[rarity] || colors.common;
  }

  /**
   * Format loot for display
   * @param {object} loot - Loot object with Item instances
   * @returns {string} Formatted string
   */
  formatLoot(loot) {
    let text = `${loot.gold} gold`;

    if (loot.items.length > 0) {
      text += '\n\nItems found:';
      loot.items.forEach(item => {
        // Handle both Item instances and plain strings (backward compatibility)
        const itemName = item.name || item;
        const itemRarity = item.rarity ? ` (${item.rarity})` : '';
        text += `\n• ${itemName}${itemRarity}`;
      });
    }

    return text;
  }
}

export default LootGenerator;
