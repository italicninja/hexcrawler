/**
 * Character class - D&D 5e based character
 */
import { Item } from './Item.js';

export class Character {
    constructor(name, charClass) {
        this.name = name;
        this.class = charClass;
        this.level = 1;

        // D&D 5e Ability Scores
        this.abilities = {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10
        };

        // Combat stats
        this.maxHP = 10;
        this.currentHP = 10;
        this.armorClass = 10;
        this.proficiencyBonus = 2;

        // Movement and vision
        this.moveDistance = 1;  // Can move 1 hex per turn
        this.viewDistance = 2;  // Can see 2 hexes away

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
        this.spellSlotsUsed = {}; // For future spell system

        // Survival mechanics
        this.rations = 7; // Days of food (default 7)
        this.water = 7; // Days of water (default 7)
        this.daysWithoutFood = 0; // Counter for starvation
        this.daysWithoutWater = 0; // Counter for dehydration
        this.exhaustionLevel = 0; // Exhaustion level (0-6)

        // XP and leveling
        this.xp = 0; // Current experience points
        this.xpToNextLevel = Character.getXPForLevel(2); // XP needed for next level

        // Apply class modifiers
        if (charClass) {
            this.applyClassModifiers(charClass);
        }
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
        if (this.level >= 20) return false; // Max level
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
        if (charClass === 'paladin') {
            this.hitDie = 'd10';
            this.abilities.strength = 16; // Primary stat
            this.abilities.charisma = 14; // Secondary stat
            this.abilities.constitution = 14;
            this.abilities.wisdom = 12;
            this.abilities.dexterity = 10;
            this.abilities.intelligence = 8;

            // Calculate HP
            this.maxHP = 10 + this.getModifier('constitution');
            this.currentHP = this.maxHP;

            // AC (assume chain mail + shield)
            this.armorClass = 18;

            // Proficiencies (stub)
            this.proficiencies = [
                'All Armor',
                'All Shields',
                'Simple Weapons',
                'Martial Weapons',
                'Wisdom Saves',
                'Charisma Saves'
            ];

            // Placeholder for abilities
            this.abilities_list = [
                { name: 'Divine Sense', uses: 4, maxUses: 4 },
                { name: 'Lay on Hands', uses: 5, maxUses: 5 }
            ];
        }
        // Note: Other classes (fighter, rogue, cleric, wizard, ranger) are applied via NPCGenerator
    }

    /**
     * Get ability modifier
     */
    getModifier(ability) {
        const score = this.abilities[ability];
        return Math.floor((score - 10) / 2);
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
        this.proficiencyBonus = Math.floor((this.level - 1) / 4) + 2;

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
            water: this.water,
            daysWithoutFood: this.daysWithoutFood,
            daysWithoutWater: this.daysWithoutWater,
            exhaustionLevel: this.exhaustionLevel,
            // XP and leveling
            xp: this.xp,
            xpToNextLevel: this.xpToNextLevel
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
        char.water = data.water !== undefined ? data.water : 7;
        char.daysWithoutFood = data.daysWithoutFood || 0;
        char.daysWithoutWater = data.daysWithoutWater || 0;
        char.exhaustionLevel = data.exhaustionLevel || 0;

        // XP and leveling
        char.xp = data.xp !== undefined ? data.xp : 0;
        char.xpToNextLevel = data.xpToNextLevel !== undefined ? data.xpToNextLevel : Character.getXPForLevel(char.level + 1);

        return char;
    }
}
