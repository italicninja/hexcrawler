import { GAME_DEFAULTS, DND, XP_TABLE } from '../constants/gameConstants.js';

/**
 * Character class representing player and NPC characters in D&D 5e
 */
export class Character {
    constructor(name, charClass) {
        this.name = name;
        this.class = charClass;
        this.level = 1;

        // D&D 5e Ability Scores
        this.abilities = {
            strength: GAME_DEFAULTS.ABILITY_SCORE,
            dexterity: GAME_DEFAULTS.ABILITY_SCORE,
            constitution: GAME_DEFAULTS.ABILITY_SCORE,
            intelligence: GAME_DEFAULTS.ABILITY_SCORE,
            wisdom: GAME_DEFAULTS.ABILITY_SCORE,
            charisma: GAME_DEFAULTS.ABILITY_SCORE
        };

        // Combat stats
        this.maxHP = GAME_DEFAULTS.BASE_HP;
        this.currentHP = GAME_DEFAULTS.BASE_HP;
        this.armorClass = GAME_DEFAULTS.BASE_AC;
        this.proficiencyBonus = GAME_DEFAULTS.PROFICIENCY_BONUS;

        // Movement and vision
        this.moveDistance = GAME_DEFAULTS.MOVE_DISTANCE;
        this.viewDistance = GAME_DEFAULTS.VIEW_RADIUS;

        // Class-specific
        this.hitDie = 'd8';
        this.proficiencies = [];
        this.spells = [];
        this.abilities_list = [];

        // Equipment slots
        this.equipment = {
            head: null,
            neck: null,
            chest: null,
            hands: null,
            legs: null,
            feet: null,
            ring1: null,
            ring2: null,
            mainHand: null,
            offHand: null
        };

        // Inventory
        this.inventory = [];
        this.gold = 0; // Gold pieces

        // NPC-specific properties
        this.personality = null;
        this.background = null;
        this.gender = null;

        // Rest mechanics
        this.hitDiceRemaining = this.level; // Start with full hit dice
        this.lastLongRest = 0; // Timestamp of last long rest (in game hours)
        this.spellSlotsUsed = {}; // Tracks used slots by level: {1: 0, 2: 0, 3: 0}
        this.knownSpells = []; // For Bard, Sorcerer, Warlock (know specific spells)
        this.preparedSpells = []; // For Cleric, Druid, Wizard (prepare from list)

        // Survival mechanics
        this.rations = 7; // Days of food (default 7)
        this.daysWithoutFood = 0; // Counter for starvation
        this.exhaustionLevel = 0; // Exhaustion level (0-6)
        this.foragedHexes = {}; // Track hex forage cooldowns: { "col,row": lastForagedDay }

        // XP and leveling
        this.xp = 0; // Current experience points
        this.xpToNextLevel = Character.getXPForLevel(2); // XP needed for next level

        // Hidden stats (for shrine interactions, etc.)
        this.hiddenStats = {
            piety: 0,      // Increases from praying at shrines
            generosity: 0  // Increases from making offerings
        };

        // Apply class modifiers
        if (charClass) {
            this.applyClassModifiers(charClass);
        }

        // Initialize spell slots for casters
        this.initializeSpellSlots();
    }

    /**
     * D&D 5e XP Progression Table
     * Maps level to XP required to reach that level
     */
    static XP_TABLE = {
        1: 0,
        2: 300,
        3: 900,
        4: 2700,
        5: 6500,
        6: 14000,
        7: 23000,
        8: 34000,
        9: 48000,
        10: 64000,
        11: 85000,
        12: 100000,
        13: 120000,
        14: 140000,
        15: 165000,
        16: 195000,
        17: 225000,
        18: 265000,
        19: 305000,
        20: 355000
    };

    /**
     * Get XP required to reach a specific level
     * @param {number} level - Target level (1-20)
     * @returns {number} XP required
     */
    static getXPForLevel(level) {
        if (level < 1) return 0;
        if (level > 20) return Character.XP_TABLE[20];
        return Character.XP_TABLE[level] || 0;
    }

    /**
     * Award XP to character
     * @param {number} amount - XP amount to award
     * @returns {boolean} True if character leveled up
     */
    awardXP(amount) {
        if (typeof amount !== 'number' || amount < 0) return false;
        this.xp += amount;
        return this.shouldLevelUp();
    }

    /**
     * Check if character has enough XP to level up
     * @returns {boolean} True if ready to level up
     */
    shouldLevelUp() {
        if (this.level >= XP_TABLE.length) return false; // Max level
        return this.xp >= this.xpToNextLevel;
    }

    /**
     * Add gold to character's purse
     * @param {number} amount - Gold amount to add
     * @returns {boolean} True if added successfully
     */
    addGold(amount) {
        if (typeof amount !== 'number' || amount < 0) return false;
        this.gold += amount;
        return true;
    }

    /**
     * Remove gold from character's purse
     * @param {number} amount - Gold amount to remove
     * @returns {boolean} True if removed successfully (false if insufficient gold)
     */
    removeGold(amount) {
        if (typeof amount !== 'number' || amount < 0) return false;
        if (this.gold < amount) return false;
        this.gold -= amount;
        return true;
    }

    /**
     * Add item to inventory
     * @param {Item} item - Item to add
     * @returns {boolean} True if added successfully
     */
    addItem(item) {
        if (!item) return false;
        this.inventory.push(item);
        return true;
    }

    /**
     * Remove item from inventory by ID
     * @param {string} itemId - Item ID to remove
     * @returns {Item|null} Removed item or null if not found
     */
    removeItem(itemId) {
        const index = this.inventory.findIndex(item => item.id === itemId);
        if (index === -1) return null;
        const removed = this.inventory.splice(index, 1)[0];
        return removed;
    }

    /**
     * Equip item to a slot
     * @param {string} itemId - Item ID to equip
     * @param {string} slot - Slot to equip to (optional, uses item's slot if not provided)
     * @returns {boolean} True if equipped successfully
     */
    equipItem(itemId, slot = null) {
        // Find item in inventory
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) {
            console.warn(`Item ${itemId} not found in inventory`);
            return false;
        }

        // Check if item is equippable
        if (!item.isEquippable()) {
            console.warn(`Item ${item.name} is not equippable`);
            return false;
        }

        // Determine target slot
        const targetSlot = slot || item.slot;
        if (!targetSlot) {
            console.warn(`No slot specified for ${item.name}`);
            return false;
        }

        // Validate slot compatibility
        if (!item.canEquipToSlot(targetSlot)) {
            console.warn(`Item ${item.name} cannot be equipped to slot ${targetSlot}`);
            return false;
        }

        // Handle two-handed weapons
        if (item.twoHanded && targetSlot === 'mainHand') {
            // Unequip offhand if equipped
            if (this.equipment.offHand) {
                this.unequipItem('offHand');
            }
        }

        // If slot is mainHand and offHand has a two-handed weapon, can't equip
        if (targetSlot === 'offHand' && this.equipment.mainHand?.twoHanded) {
            console.warn('Cannot equip to offhand while wielding a two-handed weapon');
            return false;
        }

        // Unequip current item in slot
        if (this.equipment[targetSlot]) {
            this.unequipItem(targetSlot);
        }

        // Remove from inventory and equip
        this.removeItem(itemId);
        this.equipment[targetSlot] = item;

        // Recalculate stats with new equipment
        this.calculateEffectiveStats();

        return true;
    }

    /**
     * Unequip item from a slot
     * @param {string} slot - Slot to unequip from
     * @returns {boolean} True if unequipped successfully
     */
    unequipItem(slot) {
        if (!this.equipment[slot]) {
            console.warn(`No item equipped in slot ${slot}`);
            return false;
        }

        const item = this.equipment[slot];
        this.equipment[slot] = null;

        // Add back to inventory
        this.addItem(item);

        // Recalculate stats without this item
        this.calculateEffectiveStats();

        return true;
    }

    /**
     * Get all equipped items
     * @returns {object} Map of slot -> item
     */
    getEquippedItems() {
        const equipped = {};
        Object.keys(this.equipment).forEach(slot => {
            if (this.equipment[slot]) {
                equipped[slot] = this.equipment[slot];
            }
        });
        return equipped;
    }

    /**
     * Get all inventory items (not equipped)
     * @returns {Array<Item>}
     */
    getInventoryItems() {
        return [...this.inventory];
    }

    /**
     * Calculate effective stats including equipment bonuses
     * This updates armorClass and ability scores based on equipped items
     */
    calculateEffectiveStats() {
        // Reset to base stats (stored during class creation)
        if (!this.baseStats) {
            // First time - store base stats
            this.baseStats = {
                armorClass: this.armorClass,
                abilities: { ...this.abilities },
                maxHP: this.maxHP
            };
        }

        // Start with base stats
        this.armorClass = this.baseStats.armorClass;
        this.maxHP = this.baseStats.maxHP;
        Object.keys(this.abilities).forEach(ability => {
            this.abilities[ability] = this.baseStats.abilities[ability];
        });

        // Apply equipment effects
        Object.values(this.equipment).forEach(item => {
            if (item && item.effects) {
                // Apply AC bonus
                if (item.effects.ac) {
                    this.armorClass += item.effects.ac;
                }

                // Apply ability score bonuses
                ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
                    const abilityMap = {
                        str: 'strength',
                        dex: 'dexterity',
                        con: 'constitution',
                        int: 'intelligence',
                        wis: 'wisdom',
                        cha: 'charisma'
                    };
                    const fullAbilityName = abilityMap[ability];
                    if (item.effects[ability]) {
                        this.abilities[fullAbilityName] += item.effects[ability];
                    }
                });

                // Apply HP bonus (affects maxHP)
                if (item.effects.hp) {
                    this.maxHP += item.effects.hp;
                    // Ensure current HP doesn't exceed new max
                    this.currentHP = Math.min(this.currentHP, this.maxHP);
                }
            }
        });
    }

    /**
     * Get total weight of inventory and equipment
     * @returns {number} Total weight in pounds
     */
    getTotalWeight() {
        let weight = 0;

        // Count inventory items
        this.inventory.forEach(item => {
            weight += item.weight || 0;
        });

        // Count equipped items
        Object.values(this.equipment).forEach(item => {
            if (item) {
                weight += item.weight || 0;
            }
        });

        return weight;
    }

    /**
     * Apply class-specific modifiers
     */
    applyClassModifiers(charClass) {
        const classKey = charClass.toLowerCase();
        
        // Class definitions matching CharacterCreationScene
        const classConfigs = {
            barbarian: {
                hitDie: 'd12',
                abilities: { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 },
                armorClass: 13, // Unarmored defense (10 + DEX + CON)
                proficiencies: ['Light Armor', 'Medium Armor', 'Shields', 'Simple Weapons', 'Martial Weapons', 'Strength Saves', 'Constitution Saves'],
                abilities_list: [{ name: 'Rage', uses: 2, maxUses: 2 }]
            },
            bard: {
                hitDie: 'd8',
                abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 13, charisma: 15 },
                armorClass: 14, // Light armor
                proficiencies: ['Light Armor', 'Simple Weapons', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords', 'Dexterity Saves', 'Charisma Saves'],
                abilities_list: [{ name: 'Bardic Inspiration', uses: 2, maxUses: 2 }]
            },
            cleric: {
                hitDie: 'd8',
                abilities: { strength: 14, dexterity: 10, constitution: 13, intelligence: 8, wisdom: 15, charisma: 12 },
                armorClass: 18, // Chain mail + shield
                proficiencies: ['Light Armor', 'Medium Armor', 'Shields', 'Simple Weapons', 'Wisdom Saves', 'Charisma Saves'],
                abilities_list: [{ name: 'Channel Divinity', uses: 1, maxUses: 1 }]
            },
            druid: {
                hitDie: 'd8',
                abilities: { strength: 10, dexterity: 12, constitution: 14, intelligence: 13, wisdom: 15, charisma: 8 },
                armorClass: 13, // Hide armor
                proficiencies: ['Light Armor (non-metal)', 'Medium Armor (non-metal)', 'Shields (non-metal)', 'Clubs', 'Daggers', 'Darts', 'Javelins', 'Maces', 'Quarterstaffs', 'Scimitars', 'Sickles', 'Slings', 'Spears', 'Intelligence Saves', 'Wisdom Saves'],
                abilities_list: [{ name: 'Wild Shape', uses: 2, maxUses: 2 }]
            },
            fighter: {
                hitDie: 'd10',
                abilities: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 10, charisma: 12 },
                armorClass: 18, // Chain mail + shield
                proficiencies: ['All Armor', 'All Shields', 'Simple Weapons', 'Martial Weapons', 'Strength Saves', 'Constitution Saves'],
                abilities_list: [{ name: 'Second Wind', uses: 1, maxUses: 1 }]
            },
            monk: {
                hitDie: 'd8',
                abilities: { strength: 10, dexterity: 15, constitution: 13, intelligence: 8, wisdom: 14, charisma: 12 },
                armorClass: 14, // Unarmored defense (10 + DEX + WIS)
                proficiencies: ['Simple Weapons', 'Shortswords', 'Strength Saves', 'Dexterity Saves'],
                abilities_list: [{ name: 'Ki Points', uses: 1, maxUses: 1 }, { name: 'Martial Arts', uses: -1, maxUses: -1 }]
            },
            paladin: {
                hitDie: 'd10',
                abilities: { strength: 15, dexterity: 10, constitution: 13, intelligence: 8, wisdom: 12, charisma: 14 },
                armorClass: 18, // Chain mail + shield
                proficiencies: ['All Armor', 'All Shields', 'Simple Weapons', 'Martial Weapons', 'Wisdom Saves', 'Charisma Saves'],
                abilities_list: [{ name: 'Divine Sense', uses: 4, maxUses: 4 }, { name: 'Lay on Hands', uses: 5, maxUses: 5 }]
            },
            ranger: {
                hitDie: 'd10',
                abilities: { strength: 12, dexterity: 15, constitution: 13, intelligence: 8, wisdom: 14, charisma: 10 },
                armorClass: 15, // Studded leather
                proficiencies: ['Light Armor', 'Medium Armor', 'Shields', 'Simple Weapons', 'Martial Weapons', 'Strength Saves', 'Dexterity Saves'],
                abilities_list: [{ name: 'Favored Enemy', uses: -1, maxUses: -1 }]
            },
            rogue: {
                hitDie: 'd8',
                abilities: { strength: 8, dexterity: 15, constitution: 12, intelligence: 14, wisdom: 13, charisma: 10 },
                armorClass: 14, // Leather armor
                proficiencies: ['Light Armor', 'Simple Weapons', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords', 'Dexterity Saves', 'Intelligence Saves'],
                abilities_list: [{ name: 'Sneak Attack', uses: -1, maxUses: -1 }]
            },
            sorcerer: {
                hitDie: 'd6',
                abilities: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 15 },
                armorClass: 11, // No armor (10 + DEX)
                proficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows', 'Constitution Saves', 'Charisma Saves'],
                abilities_list: [{ name: 'Sorcery Points', uses: 1, maxUses: 1 }]
            },
            warlock: {
                hitDie: 'd8',
                abilities: { strength: 8, dexterity: 13, constitution: 14, intelligence: 12, wisdom: 10, charisma: 15 },
                armorClass: 12, // Leather armor
                proficiencies: ['Light Armor', 'Simple Weapons', 'Wisdom Saves', 'Charisma Saves'],
                abilities_list: [{ name: 'Eldritch Invocations', uses: -1, maxUses: -1 }]
            },
            wizard: {
                hitDie: 'd6',
                abilities: { strength: 8, dexterity: 13, constitution: 14, intelligence: 15, wisdom: 12, charisma: 10 },
                armorClass: 11, // No armor (10 + DEX)
                proficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows', 'Intelligence Saves', 'Wisdom Saves'],
                abilities_list: [{ name: 'Arcane Recovery', uses: 1, maxUses: 1 }]
            }
        };

        const config = classConfigs[classKey];
        if (!config) {
            console.warn(`Unknown class: ${charClass}. Defaulting to Fighter.`);
            this.applyClassModifiers('fighter');
            return;
        }

        // Apply class configuration
        this.hitDie = config.hitDie;
        this.abilities = { ...config.abilities };
        
        // Calculate HP (max hit die value at level 1 + CON modifier)
        const hitDieValue = parseInt(config.hitDie.substring(1));
        this.maxHP = hitDieValue + this.getModifier('constitution');
        this.currentHP = this.maxHP;

        // Set AC
        this.armorClass = config.armorClass;

        // Set proficiencies
        this.proficiencies = [...config.proficiencies];

        // Set class abilities
        this.abilities_list = config.abilities_list.map(ability => ({ ...ability }));
    }

    /**
     * Get ability modifier
     */
    getModifier(ability) {
        const score = this.abilities[ability];
        // D&D 5e ability modifier formula
        return Math.floor((score - GAME_DEFAULTS.ABILITY_SCORE) / 2);
    }

    /**
     * Take damage
     */
    takeDamage(amount) {
        this.currentHP = Math.max(0, this.currentHP - amount);
        return this.currentHP === 0; // Return true if character dies
    }

    /**
     * Alias for takeDamage() for consistency with exploration system
     */
    damage(amount) {
        return this.takeDamage(amount);
    }

    /**
     * Heal
     */
    heal(amount) {
        this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
    }

    /**
     * Level up
     * @returns {object} Stats gained from level up
     */
    levelUp() {
        if (this.level >= 20) {
            console.warn('Character is already max level (20)');
            return null;
        }

        const oldLevel = this.level;
        this.level++;
        // Update proficiency bonus based on level (from table)
        this.proficiencyBonus = DND.PROFICIENCY_BONUS[this.level - 1] || GAME_DEFAULTS.PROFICIENCY_BONUS;

        // Roll for HP (using average for now)
        const hitDieValue = parseInt(this.hitDie.substring(1));
        const hpGain = Math.floor(hitDieValue / 2) + 1 + this.getModifier('constitution');
        this.maxHP += hpGain;
        this.currentHP += hpGain;

        // Gain 1 additional hit die on level up
        this.hitDiceRemaining++;

        // Update XP threshold for next level
        this.xpToNextLevel = Character.getXPForLevel(this.level + 1);

        // Return stats gained
        return {
            oldLevel,
            newLevel: this.level,
            hpGain,
            proficiencyBonus: this.proficiencyBonus,
            newMaxHP: this.maxHP
        };
    }

    /**
     * Use hit dice for healing (during short rest)
     */
    useHitDice(count) {
        const diceToUse = Math.min(count, this.hitDiceRemaining);
        this.hitDiceRemaining -= diceToUse;
        return diceToUse;
    }

    /**
     * Recover hit dice (during long rest)
     */
    recoverHitDice(count) {
        const maxHitDice = this.level;
        const diceToRecover = Math.min(count, maxHitDice - this.hitDiceRemaining);
        this.hitDiceRemaining += diceToRecover;
        return diceToRecover;
    }

    /**
     * Check if character has a raft (allows river crossing)
     * @returns {boolean}
     */
    hasRaft() {
        return this.inventory.some(item => 
            item.effects && item.effects.allowsRiverCrossing === true
        );
    }

    /**
     * Check if character has a boat (allows water crossing)
     * @returns {boolean}
     */
    hasBoat() {
        return this.inventory.some(item => 
            item.effects && item.effects.allowsWaterCrossing === true
        );
    }

    /**
     * Check if character can cross a specific terrain type
     * @param {string} terrainKey - Terrain type key (e.g., 'river', 'water')
     * @returns {boolean}
     */
    canCrossTerrain(terrainKey) {
        if (terrainKey === 'river') {
            return this.hasRaft() || this.hasBoat();
        }
        if (terrainKey === 'water') {
            return this.hasBoat();
        }
        // All other terrain types are passable
        return true;
    }

    /**
     * Increase piety (from praying at shrines)
     */
    increasePiety(amount = 1) {
        this.hiddenStats.piety += amount;
        console.log(`${this.name} - Piety increased by ${amount}. Total Piety: ${this.hiddenStats.piety}`);
        return this.hiddenStats.piety;
    }

    /**
     * Increase generosity (from making offerings at shrines)
     * Requires gold to be spent
     */
    increaseGenerosity(goldOffered) {
        if (goldOffered <= 0) {
            return { success: false, message: 'Offering must be greater than 0 gold' };
        }

        if (this.gold < goldOffered) {
            return { success: false, message: `Not enough gold. You have ${this.gold} gold.` };
        }

        // Remove gold
        this.removeGold(goldOffered);

        // Generosity increases based on offering amount (1 point per 10 gold, minimum 1)
        const generosityGain = Math.max(1, Math.floor(goldOffered / 10));
        this.hiddenStats.generosity += generosityGain;

        console.log(`${this.name} - Generosity increased by ${generosityGain}. Total Generosity: ${this.hiddenStats.generosity}`);
        console.log(`${this.name} - Offered ${goldOffered} gold. Remaining gold: ${this.gold}`);

        return { 
            success: true, 
            goldOffered, 
            generosityGain, 
            totalGenerosity: this.hiddenStats.generosity,
            remainingGold: this.gold
        };
    }

    /**
     * Initialize spell slots for spellcasting classes
     */
    initializeSpellSlots() {
        const casterClasses = ['Wizard', 'Cleric', 'Druid', 'Sorcerer', 'Bard', 'Warlock', 'Paladin', 'Ranger'];
        if (casterClasses.includes(this.class)) {
            this.spellSlotsUsed = { 1: 0, 2: 0, 3: 0 };
        }
    }

    /**
     * Serialize to JSON for saving
     */
    toJSON() {
        // Serialize equipment (convert Item objects to JSON)
        const serializedEquipment = {};
        Object.keys(this.equipment).forEach(slot => {
            if (this.equipment[slot]) {
                serializedEquipment[slot] = this.equipment[slot].toJSON();
            } else {
                serializedEquipment[slot] = null;
            }
        });

        // Serialize inventory (convert Item objects to JSON)
        const serializedInventory = this.inventory.map(item => item.toJSON ? item.toJSON() : item);

        return {
            name: this.name,
            class: this.class,
            level: this.level,
            abilities: { ...this.abilities },
            maxHP: this.maxHP,
            currentHP: this.currentHP,
            armorClass: this.armorClass,
            proficiencyBonus: this.proficiencyBonus,
            moveDistance: this.moveDistance,
            viewDistance: this.viewDistance,
            hitDie: this.hitDie,
            proficiencies: [...this.proficiencies],
            spells: [...this.spells],
            abilities_list: [...this.abilities_list],
            equipment: serializedEquipment,
            inventory: serializedInventory,
            gold: this.gold,
            personality: this.personality,
            background: this.background,
            gender: this.gender,
            hitDiceRemaining: this.hitDiceRemaining,
            lastLongRest: this.lastLongRest,
            spellSlotsUsed: { ...this.spellSlotsUsed },
            baseStats: this.baseStats ? { ...this.baseStats } : undefined,
            // Survival mechanics
            rations: this.rations,
            daysWithoutFood: this.daysWithoutFood,
            exhaustionLevel: this.exhaustionLevel,
            foragedHexes: this.foragedHexes,
            // XP and leveling
            xp: this.xp,
            xpToNextLevel: this.xpToNextLevel,
            // Hidden stats
            hiddenStats: { ...this.hiddenStats }
        };
    }

    /**
     * Load from JSON
     */
    static fromJSON(data) {
        const char = new Character(data.name, null);
        char.class = data.class;
        char.level = data.level;
        char.abilities = { ...data.abilities };
        char.maxHP = data.maxHP;
        char.currentHP = data.currentHP;
        char.armorClass = data.armorClass;
        char.proficiencyBonus = data.proficiencyBonus;
        char.moveDistance = data.moveDistance || 1;
        char.viewDistance = data.viewDistance || 2;
        char.hitDie = data.hitDie;
        char.proficiencies = [...data.proficiencies];
        char.spells = [...data.spells];
        char.abilities_list = [...data.abilities_list];

        // Deserialize equipment (convert JSON to Item objects)
        char.equipment = {};
        if (data.equipment) {
            Object.keys(data.equipment).forEach(slot => {
                if (data.equipment[slot]) {
                    char.equipment[slot] = Item.fromJSON(data.equipment[slot]);
                } else {
                    char.equipment[slot] = null;
                }
            });
        }

        // Deserialize inventory (convert JSON to Item objects)
        char.inventory = [];
        if (data.inventory) {
            char.inventory = data.inventory.map(itemData => Item.fromJSON(itemData));
        }

        char.gold = data.gold || 0;
        char.personality = data.personality || null;
        char.background = data.background || null;
        char.gender = data.gender || null;
        char.hitDiceRemaining = data.hitDiceRemaining !== undefined ? data.hitDiceRemaining : char.level;
        char.lastLongRest = data.lastLongRest || 0;
        char.spellSlotsUsed = data.spellSlotsUsed ? { ...data.spellSlotsUsed } : {};
        char.baseStats = data.baseStats ? { ...data.baseStats } : undefined;

        // Survival mechanics
        char.rations = data.rations !== undefined ? data.rations : 7;
        char.daysWithoutFood = data.daysWithoutFood || 0;
        char.exhaustionLevel = data.exhaustionLevel || 0;
        // Handle both old Set format and new object format for backwards compatibility
        if (Array.isArray(data.foragedHexes)) {
            // Old format - convert to empty object (reset cooldowns)
            char.foragedHexes = {};
        } else {
            char.foragedHexes = data.foragedHexes || {};
        }

        // XP and leveling
        char.xp = data.xp !== undefined ? data.xp : 0;
        char.xpToNextLevel = data.xpToNextLevel !== undefined ? data.xpToNextLevel : Character.getXPForLevel(char.level + 1);

        // Hidden stats
        char.hiddenStats = data.hiddenStats || { piety: 0, generosity: 0 };

        return char;
    }
}
