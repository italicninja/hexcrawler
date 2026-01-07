/**
 * Item class - Represents items, equipment, consumables, and quest items
 * D&D 5e inspired item system with effects and rarity
 */

export class Item {
  /**
   * Create a new item
   * @param {object} config - Item configuration
   * @param {string} config.name - Item name
   * @param {string} config.description - Item description
   * @param {string} config.type - Item type: weapon, armor, consumable, quest, misc
   * @param {string} config.rarity - Rarity: common, uncommon, rare, very rare, legendary
   * @param {string} config.slot - Equipment slot (if equippable): head, neck, chest, hands, legs, feet, ring1, ring2, mainHand, offHand
   * @param {object} config.effects - Stat effects: { ac: +2, str: +1, hp: +5, damage: '1d8', etc. }
   * @param {number} config.weight - Weight in pounds
   * @param {number} config.value - Base value in gold pieces
   * @param {string} config.id - Unique item ID (auto-generated if not provided)
   */
  constructor(config = {}) {
    this.id = config.id || this.generateId();
    this.name = config.name || 'Unknown Item';
    this.description = config.description || '';
    this.type = config.type || 'misc'; // weapon, armor, consumable, quest, misc
    this.rarity = config.rarity || 'common'; // common, uncommon, rare, very rare, legendary
    this.slot = config.slot || null; // Equipment slot if equippable
    this.effects = config.effects || {}; // Stat modifiers/effects
    this.weight = config.weight || 0;
    this.value = config.value || 0;

    // Additional properties for specific item types
    this.damage = config.damage || null; // For weapons: '1d8', '2d6', etc.
    this.damageType = config.damageType || null; // piercing, slashing, bludgeoning, etc.
    this.armorType = config.armorType || null; // light, medium, heavy, shield
    this.consumable = config.consumable || false; // True if item is consumed on use
    this.charges = config.charges || null; // For items with limited uses
    this.maxCharges = config.maxCharges || null;
    this.twoHanded = config.twoHanded || false; // For two-handed weapons

    // Validate configuration
    this.validate();
  }

  /**
   * Generate a unique ID for this item
   * @returns {string} Unique ID
   */
  generateId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate item configuration
   */
  validate() {
    const validTypes = ['weapon', 'armor', 'consumable', 'quest', 'misc'];
    if (!validTypes.includes(this.type)) {
      console.warn(`Invalid item type: ${this.type}. Defaulting to 'misc'.`);
      this.type = 'misc';
    }

    const validRarities = ['common', 'uncommon', 'rare', 'very rare', 'legendary'];
    if (!validRarities.includes(this.rarity)) {
      console.warn(`Invalid rarity: ${this.rarity}. Defaulting to 'common'.`);
      this.rarity = 'common';
    }

    const validSlots = [
      'head', 'neck', 'chest', 'hands', 'legs', 'feet',
      'ring1', 'ring2', 'mainHand', 'offHand', null
    ];
    if (!validSlots.includes(this.slot)) {
      console.warn(`Invalid slot: ${this.slot}. Setting to null.`);
      this.slot = null;
    }
  }

  /**
   * Check if item is equippable
   * @returns {boolean}
   */
  isEquippable() {
    return this.slot !== null;
  }

  /**
   * Check if item can be equipped to a specific slot
   * @param {string} slot - Slot name
   * @returns {boolean}
   */
  canEquipToSlot(slot) {
    if (!this.isEquippable()) return false;

    // Ring slots are interchangeable
    if ((this.slot === 'ring1' || this.slot === 'ring2') &&
        (slot === 'ring1' || slot === 'ring2')) {
      return true;
    }

    return this.slot === slot;
  }

  /**
   * Get rarity color for UI display
   * @returns {string} Hex color code
   */
  getRarityColor() {
    const colors = {
      'common': '#9d9d9d',
      'uncommon': '#1eff00',
      'rare': '#0070dd',
      'very rare': '#a335ee',
      'legendary': '#ff8000'
    };
    return colors[this.rarity] || colors.common;
  }

  /**
   * Get formatted effects string for display
   * @returns {string}
   */
  getEffectsText() {
    if (Object.keys(this.effects).length === 0) {
      return 'No special effects';
    }

    const effectStrings = [];

    // Stat bonuses
    const statMap = {
      str: 'Strength',
      dex: 'Dexterity',
      con: 'Constitution',
      int: 'Intelligence',
      wis: 'Wisdom',
      cha: 'Charisma',
      ac: 'Armor Class',
      hp: 'Hit Points',
      speed: 'Speed',
      initiative: 'Initiative',
      attackBonus: 'Attack Bonus',
      damageBonus: 'Damage Bonus'
    };

    Object.keys(this.effects).forEach(key => {
      const value = this.effects[key];
      const statName = statMap[key] || key;
      const sign = value > 0 ? '+' : '';
      effectStrings.push(`${sign}${value} ${statName}`);
    });

    return effectStrings.join(', ');
  }

  /**
   * Get full item tooltip text
   * @returns {string}
   */
  getTooltip() {
    let tooltip = `${this.name}\n`;
    tooltip += `${this.rarity.charAt(0).toUpperCase() + this.rarity.slice(1)} ${this.type}\n`;

    if (this.slot) {
      tooltip += `Slot: ${this.slot}\n`;
    }

    if (this.damage) {
      tooltip += `Damage: ${this.damage}`;
      if (this.damageType) {
        tooltip += ` ${this.damageType}`;
      }
      tooltip += '\n';
    }

    if (this.armorType) {
      tooltip += `Armor Type: ${this.armorType}\n`;
    }

    const effectsText = this.getEffectsText();
    if (effectsText !== 'No special effects') {
      tooltip += `Effects: ${effectsText}\n`;
    }

    if (this.charges !== null && this.maxCharges !== null) {
      tooltip += `Charges: ${this.charges}/${this.maxCharges}\n`;
    }

    tooltip += `\n${this.description}\n`;
    tooltip += `\nWeight: ${this.weight} lbs | Value: ${this.value} gp`;

    return tooltip;
  }

  /**
   * Use the item (for consumables or charged items)
   * @returns {boolean} True if item was used successfully
   */
  use() {
    if (this.consumable) {
      // Consumable items are destroyed on use
      return true;
    }

    if (this.charges !== null) {
      if (this.charges > 0) {
        this.charges--;
        return true;
      }
      return false; // Out of charges
    }

    return false; // Not usable
  }

  /**
   * Recharge item to max charges
   */
  recharge() {
    if (this.maxCharges !== null) {
      this.charges = this.maxCharges;
    }
  }

  /**
   * Clone this item (useful for creating multiple instances)
   * @returns {Item} New item instance
   */
  clone() {
    return Item.fromJSON(this.toJSON());
  }

  /**
   * Serialize to JSON for saving
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      rarity: this.rarity,
      slot: this.slot,
      effects: { ...this.effects },
      weight: this.weight,
      value: this.value,
      damage: this.damage,
      damageType: this.damageType,
      armorType: this.armorType,
      consumable: this.consumable,
      charges: this.charges,
      maxCharges: this.maxCharges,
      twoHanded: this.twoHanded
    };
  }

  /**
   * Load from JSON
   * @param {object} data - JSON data
   * @returns {Item} Item instance
   */
  static fromJSON(data) {
    return new Item(data);
  }

  /**
   * Create a basic weapon
   * @param {string} name - Weapon name
   * @param {string} damage - Damage dice (e.g., '1d8')
   * @param {string} damageType - Damage type
   * @param {object} options - Additional options
   * @returns {Item}
   */
  static createWeapon(name, damage, damageType, options = {}) {
    return new Item({
      name,
      description: options.description || `A ${name.toLowerCase()}.`,
      type: 'weapon',
      rarity: options.rarity || 'common',
      slot: 'mainHand',
      damage,
      damageType,
      effects: options.effects || {},
      weight: options.weight || 3,
      value: options.value || 10,
      twoHanded: options.twoHanded || false
    });
  }

  /**
   * Create basic armor
   * @param {string} name - Armor name
   * @param {number} acBonus - AC bonus
   * @param {string} armorType - Armor type
   * @param {object} options - Additional options
   * @returns {Item}
   */
  static createArmor(name, acBonus, armorType, options = {}) {
    return new Item({
      name,
      description: options.description || `${name}.`,
      type: 'armor',
      rarity: options.rarity || 'common',
      slot: options.slot || 'chest',
      armorType,
      effects: { ac: acBonus, ...options.effects },
      weight: options.weight || 10,
      value: options.value || 50
    });
  }

  /**
   * Create a consumable item
   * @param {string} name - Item name
   * @param {object} effects - Effects when consumed
   * @param {object} options - Additional options
   * @returns {Item}
   */
  static createConsumable(name, effects, options = {}) {
    return new Item({
      name,
      description: options.description || `A consumable ${name.toLowerCase()}.`,
      type: 'consumable',
      rarity: options.rarity || 'common',
      effects,
      weight: options.weight || 0.5,
      value: options.value || 5,
      consumable: true
    });
  }
}

export default Item;
