// @ts-nocheck
// TODO: Add proper types - large D&D 5e Character class (~1093 lines)
import { GAME_DEFAULTS, DND, XP_TABLE } from '../constants/gameConstants';
import logger from '../utils/logger';
import { Item } from './Item';

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
      charisma: GAME_DEFAULTS.ABILITY_SCORE,
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
      offHand: null,
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
      piety: 0, // Increases from praying at shrines
      generosity: 0, // Increases from making offerings
    };

    // Apply class modifiers
    if (charClass) {
      this.applyClassModifiers(charClass);
    }

    // Initialize spell slots for casters
    this.initializeSpellSlots();

    // Assign starting equipment and gold based on class (2024 Basic Rules)
    if (charClass) {
      this.applyStartingLoadout(charClass);
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
    20: 355000,
  };

  /**
   * Get XP required to reach a specific level
   */
  static getXPForLevel(level) {
    if (level < 1) return 0;
    if (level > 20) return Character.XP_TABLE[20];
    return Character.XP_TABLE[level] || 0;
  }

  awardXP(amount) {
    if (typeof amount !== 'number' || amount < 0) return false;
    this.xp += amount;
    return this.shouldLevelUp();
  }

  shouldLevelUp() {
    if (this.level >= XP_TABLE.length) return false; // Max level
    return this.xp >= this.xpToNextLevel;
  }

  addGold(amount) {
    if (typeof amount !== 'number' || amount < 0) return false;
    this.gold += amount;
    return true;
  }

  removeGold(amount) {
    if (typeof amount !== 'number' || amount < 0) return false;
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  addItem(item) {
    if (!item) return false;
    this.inventory.push(item);
    return true;
  }

  removeItem(itemId) {
    const index = this.inventory.findIndex(item => item.id === itemId);
    if (index === -1) return null;
    const removed = this.inventory.splice(index, 1)[0];
    return removed;
  }

  equipItem(itemId, slot = null) {
    const item = this.inventory.find(i => i.id === itemId);
    if (!item) {
      logger.items.warn('Item not found in inventory', { itemId, character: this.name });
      return false;
    }

    if (!item.isEquippable()) {
      logger.items.warn('Item is not equippable', { item: item.name, character: this.name });
      return false;
    }

    const targetSlot = slot || item.slot;
    if (!targetSlot) {
      logger.items.warn('No slot specified for item', { item: item.name, character: this.name });
      return false;
    }

    if (!item.canEquipToSlot(targetSlot)) {
      logger.items.warn('Item cannot be equipped to slot', {
        item: item.name,
        slot: targetSlot,
        character: this.name,
      });
      return false;
    }

    if (item.twoHanded && targetSlot === 'mainHand') {
      if (this.equipment.offHand) {
        this.unequipItem('offHand');
      }
    }

    if (targetSlot === 'offHand' && this.equipment.mainHand?.twoHanded) {
      logger.items.warn('Cannot equip to offhand while wielding two-handed weapon', {
        character: this.name,
      });
      return false;
    }

    if (this.equipment[targetSlot]) {
      this.unequipItem(targetSlot);
    }

    this.removeItem(itemId);
    this.equipment[targetSlot] = item;
    this.calculateEffectiveStats();
    return true;
  }

  unequipItem(slot) {
    if (!this.equipment[slot]) {
      logger.items.warn('No item equipped in slot', { slot, character: this.name });
      return false;
    }

    const item = this.equipment[slot];
    this.equipment[slot] = null;
    this.addItem(item);
    this.calculateEffectiveStats();
    return true;
  }

  getEquippedItems() {
    const equipped = {};
    Object.keys(this.equipment).forEach(slot => {
      if (this.equipment[slot]) {
        equipped[slot] = this.equipment[slot];
      }
    });
    return equipped;
  }

  getInventoryItems() {
    return [...this.inventory];
  }

  calculateEffectiveStats() {
    if (!this.baseStats) {
      this.baseStats = {
        armorClass: this.armorClass,
        abilities: { ...this.abilities },
        maxHP: this.maxHP,
      };
    }

    this.armorClass = this.baseStats.armorClass;
    this.maxHP = this.baseStats.maxHP;
    Object.keys(this.abilities).forEach(ability => {
      this.abilities[ability] = this.baseStats.abilities[ability];
    });

    Object.values(this.equipment).forEach(item => {
      if (item && item.effects) {
        if (item.effects.ac) {
          this.armorClass += item.effects.ac;
        }

        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
          const abilityMap = {
            str: 'strength',
            dex: 'dexterity',
            con: 'constitution',
            int: 'intelligence',
            wis: 'wisdom',
            cha: 'charisma',
          };
          const fullAbilityName = abilityMap[ability];
          if (item.effects[ability]) {
            this.abilities[fullAbilityName] += item.effects[ability];
          }
        });

        if (item.effects.hp) {
          this.maxHP += item.effects.hp;
          this.currentHP = Math.min(this.currentHP, this.maxHP);
        }
      }
    });
  }

  getTotalWeight() {
    let weight = 0;
    this.inventory.forEach(item => {
      weight += item.weight || 0;
    });
    Object.values(this.equipment).forEach(item => {
      if (item) {
        weight += item.weight || 0;
      }
    });
    return weight;
  }

  applyClassModifiers(charClass) {
    const classKey = charClass.toLowerCase();

    const classConfigs = {
      barbarian: {
        hitDie: 'd12',
        abilities: {
          strength: 15,
          dexterity: 13,
          constitution: 14,
          intelligence: 8,
          wisdom: 12,
          charisma: 10,
        },
        armorClass: 13,
        proficiencies: [
          'Light Armor',
          'Medium Armor',
          'Shields',
          'Simple Weapons',
          'Martial Weapons',
          'Strength Saves',
          'Constitution Saves',
        ],
        abilities_list: [{ name: 'Rage', uses: 2, maxUses: 2, actionType: 'bonusAction' }],
      },
      bard: {
        hitDie: 'd8',
        abilities: {
          strength: 8,
          dexterity: 14,
          constitution: 12,
          intelligence: 10,
          wisdom: 13,
          charisma: 15,
        },
        armorClass: 14,
        proficiencies: [
          'Light Armor',
          'Simple Weapons',
          'Hand Crossbows',
          'Longswords',
          'Rapiers',
          'Shortswords',
          'Dexterity Saves',
          'Charisma Saves',
        ],
        abilities_list: [
          { name: 'Bardic Inspiration', uses: 2, maxUses: 2, actionType: 'bonusAction' },
        ],
      },
      cleric: {
        hitDie: 'd8',
        abilities: {
          strength: 14,
          dexterity: 10,
          constitution: 13,
          intelligence: 8,
          wisdom: 15,
          charisma: 12,
        },
        armorClass: 18,
        proficiencies: [
          'Light Armor',
          'Medium Armor',
          'Shields',
          'Simple Weapons',
          'Wisdom Saves',
          'Charisma Saves',
        ],
        abilities_list: [{ name: 'Channel Divinity', uses: 1, maxUses: 1 }],
      },
      druid: {
        hitDie: 'd8',
        abilities: {
          strength: 10,
          dexterity: 12,
          constitution: 14,
          intelligence: 13,
          wisdom: 15,
          charisma: 8,
        },
        armorClass: 13,
        proficiencies: [
          'Light Armor (non-metal)',
          'Medium Armor (non-metal)',
          'Shields (non-metal)',
          'Clubs',
          'Daggers',
          'Darts',
          'Javelins',
          'Maces',
          'Quarterstaffs',
          'Scimitars',
          'Sickles',
          'Slings',
          'Spears',
          'Intelligence Saves',
          'Wisdom Saves',
        ],
        abilities_list: [{ name: 'Wild Shape', uses: 2, maxUses: 2 }],
      },
      fighter: {
        hitDie: 'd10',
        abilities: {
          strength: 15,
          dexterity: 14,
          constitution: 13,
          intelligence: 8,
          wisdom: 10,
          charisma: 12,
        },
        armorClass: 18,
        proficiencies: [
          'All Armor',
          'All Shields',
          'Simple Weapons',
          'Martial Weapons',
          'Strength Saves',
          'Constitution Saves',
        ],
        abilities_list: [{ name: 'Second Wind', uses: 1, maxUses: 1, actionType: 'bonusAction' }],
      },
      monk: {
        hitDie: 'd8',
        abilities: {
          strength: 10,
          dexterity: 15,
          constitution: 13,
          intelligence: 8,
          wisdom: 14,
          charisma: 12,
        },
        armorClass: 14,
        proficiencies: ['Simple Weapons', 'Shortswords', 'Strength Saves', 'Dexterity Saves'],
        abilities_list: [
          { name: 'Ki Points', uses: 1, maxUses: 1, actionType: 'action' },
          { name: 'Martial Arts', uses: -1, maxUses: -1, actionType: 'bonusAction' },
        ],
      },
      paladin: {
        hitDie: 'd10',
        abilities: {
          strength: 15,
          dexterity: 10,
          constitution: 13,
          intelligence: 8,
          wisdom: 12,
          charisma: 14,
        },
        armorClass: 18,
        proficiencies: [
          'All Armor',
          'All Shields',
          'Simple Weapons',
          'Martial Weapons',
          'Wisdom Saves',
          'Charisma Saves',
        ],
        abilities_list: [
          { name: 'Divine Sense', uses: 4, maxUses: 4 },
          { name: 'Lay on Hands', uses: 5, maxUses: 5 },
        ],
      },
      ranger: {
        hitDie: 'd10',
        abilities: {
          strength: 12,
          dexterity: 15,
          constitution: 13,
          intelligence: 8,
          wisdom: 14,
          charisma: 10,
        },
        armorClass: 15,
        proficiencies: [
          'Light Armor',
          'Medium Armor',
          'Shields',
          'Simple Weapons',
          'Martial Weapons',
          'Strength Saves',
          'Dexterity Saves',
        ],
        abilities_list: [{ name: 'Favored Enemy', uses: -1, maxUses: -1 }],
      },
      rogue: {
        hitDie: 'd8',
        abilities: {
          strength: 8,
          dexterity: 15,
          constitution: 12,
          intelligence: 14,
          wisdom: 13,
          charisma: 10,
        },
        armorClass: 14,
        proficiencies: [
          'Light Armor',
          'Simple Weapons',
          'Hand Crossbows',
          'Longswords',
          'Rapiers',
          'Shortswords',
          'Dexterity Saves',
          'Intelligence Saves',
        ],
        abilities_list: [{ name: 'Sneak Attack', uses: -1, maxUses: -1 }],
      },
      sorcerer: {
        hitDie: 'd6',
        abilities: {
          strength: 8,
          dexterity: 12,
          constitution: 14,
          intelligence: 10,
          wisdom: 13,
          charisma: 15,
        },
        armorClass: 11,
        proficiencies: [
          'Daggers',
          'Darts',
          'Slings',
          'Quarterstaffs',
          'Light Crossbows',
          'Constitution Saves',
          'Charisma Saves',
        ],
        abilities_list: [{ name: 'Sorcery Points', uses: 1, maxUses: 1 }],
      },
      warlock: {
        hitDie: 'd8',
        abilities: {
          strength: 8,
          dexterity: 13,
          constitution: 14,
          intelligence: 12,
          wisdom: 10,
          charisma: 15,
        },
        armorClass: 12,
        proficiencies: ['Light Armor', 'Simple Weapons', 'Wisdom Saves', 'Charisma Saves'],
        abilities_list: [{ name: 'Eldritch Invocations', uses: -1, maxUses: -1 }],
      },
      wizard: {
        hitDie: 'd6',
        abilities: {
          strength: 8,
          dexterity: 13,
          constitution: 14,
          intelligence: 15,
          wisdom: 12,
          charisma: 10,
        },
        armorClass: 11,
        proficiencies: [
          'Daggers',
          'Darts',
          'Slings',
          'Quarterstaffs',
          'Light Crossbows',
          'Intelligence Saves',
          'Wisdom Saves',
        ],
        abilities_list: [{ name: 'Arcane Recovery', uses: 1, maxUses: 1 }],
      },
    };

    const config = classConfigs[classKey];
    if (!config) {
      logger.general.warn('Unknown class, defaulting to Fighter', {
        class: charClass,
        character: this.name,
      });
      this.applyClassModifiers('fighter');
      return;
    }

    this.hitDie = config.hitDie;
    this.abilities = { ...config.abilities };

    const hitDieValue = parseInt(config.hitDie.substring(1));
    this.maxHP = hitDieValue + this.getModifier('constitution');
    this.currentHP = this.maxHP;

    this.armorClass = config.armorClass;
    this.proficiencies = [...config.proficiencies];
    this.abilities_list = config.abilities_list.map(ability => ({ ...ability }));
  }

  /**
   * Assign starting equipment directly to slots based on class.
   * Source: D&D Beyond Basic Rules 2024 (https://www.dndbeyond.com/sources/dnd/br-2024)
   * Called from constructor after applyClassModifiers so class stats are already set.
   *
   * Weapons are assigned directly to equipment slots (not through inventory) since
   * they are granted, not purchased. calculateEffectiveStats() is called once at the
   * end so any item effects (e.g. AC from armor) are applied correctly.
   */
  applyStartingLoadout(charClass) {
    const cls = (charClass || '').toLowerCase();

    // Use Item factory methods so equipment slots hold proper Item instances
    // with all class methods (getRarityColor, isEquippable, etc.) intact.
    const W = (name, damage, damageType, opts = {}) =>
      Item.createWeapon(name, damage, damageType, {
        description: `Starting ${name}.`,
        value: 0,
        weight: 2,
        ...opts,
      });

    const A = (name, acType, slot = 'chest') =>
      Item.createArmor(name, 0, acType, {
        // AC is already baked into armorClass via applyClassModifiers — effects.ac = 0
        // avoids double-counting when calculateEffectiveStats runs.
        description: `Starting ${name}.`,
        value: 0,
        weight: acType === 'heavy' ? 55 : acType === 'medium' ? 30 : 10,
        slot,
      });

    const shield = () =>
      Item.createArmor('Shield', 0, 'shield', {
        description: 'A sturdy wooden shield.',
        value: 0,
        weight: 6,
        slot: 'offHand',
      });

    switch (cls) {
      case 'barbarian':
        this.equipment.mainHand = W('Handaxe', '1d6', 'slashing', { weight: 2 });
        this.equipment.offHand = W('Handaxe', '1d6', 'slashing', { weight: 2, slot: 'offHand' });
        this.gold = 10;
        break;

      case 'fighter':
        this.equipment.mainHand = W('Longsword', '1d8', 'slashing', { weight: 3 });
        this.equipment.offHand = shield();
        this.equipment.chest = A('Chain Mail', 'heavy');
        this.gold = 15;
        break;

      case 'paladin':
        this.equipment.mainHand = W('Longsword', '1d8', 'slashing', { weight: 3 });
        this.equipment.offHand = shield();
        this.equipment.chest = A('Chain Mail', 'heavy');
        this.gold = 15;
        break;

      case 'ranger':
        this.equipment.mainHand = W('Shortsword', '1d6', 'piercing', { weight: 2 });
        this.equipment.chest = A('Leather Armor', 'light');
        // Longbow in inventory — player can swap to it for ranged combat
        this.inventory.push(
          W('Longbow', '1d8', 'piercing', {
            weight: 2,
            twoHanded: true,
            description: 'A sturdy longbow. Range 150/600 ft.',
          })
        );
        this.gold = 10;
        break;

      case 'rogue':
        this.equipment.mainHand = W('Shortsword', '1d6', 'piercing', { weight: 2 });
        this.equipment.offHand = W('Dagger', '1d4', 'piercing', { weight: 1, slot: 'offHand' });
        this.equipment.chest = A('Leather Armor', 'light');
        this.inventory.push(
          W('Dagger', '1d4', 'piercing', { weight: 1, description: 'A throwing dagger.' })
        );
        this.gold = 15;
        break;

      case 'cleric':
        this.equipment.mainHand = W('Mace', '1d6', 'bludgeoning', { weight: 4 });
        this.equipment.offHand = shield();
        this.equipment.chest = A('Scale Mail', 'medium');
        this.gold = 10;
        break;

      case 'druid':
        this.equipment.mainHand = W('Quarterstaff', '1d6', 'bludgeoning', {
          weight: 4,
          twoHanded: false,
          description: 'A wooden quarterstaff. Versatile (1d8).',
        });
        this.equipment.chest = A('Leather Armor', 'light');
        this.gold = 10;
        break;

      case 'bard':
        this.equipment.mainHand = W('Rapier', '1d8', 'piercing', {
          weight: 2,
          description: 'A slender rapier. Finesse.',
        });
        this.equipment.chest = A('Leather Armor', 'light');
        this.gold = 15;
        break;

      case 'monk':
        this.equipment.mainHand = W('Shortsword', '1d6', 'piercing', { weight: 2 });
        // No armor — AC set to 14 (10 + DEX + WIS) in class config
        this.gold = 10;
        break;

      case 'sorcerer':
        this.equipment.mainHand = W('Dagger', '1d4', 'piercing', { weight: 1 });
        this.inventory.push(
          W('Light Crossbow', '1d8', 'piercing', {
            weight: 5,
            twoHanded: true,
            description: 'A light crossbow. Range 80/320 ft.',
          })
        );
        this.gold = 10;
        break;

      case 'warlock':
        this.equipment.mainHand = W('Light Crossbow', '1d8', 'piercing', {
          weight: 5,
          twoHanded: true,
          description: 'A light crossbow. Range 80/320 ft.',
        });
        this.equipment.chest = A('Leather Armor', 'light');
        this.inventory.push(
          W('Dagger', '1d4', 'piercing', { weight: 1, description: 'A backup dagger.' })
        );
        this.gold = 10;
        break;

      case 'wizard':
        this.equipment.mainHand = W('Dagger', '1d4', 'piercing', { weight: 1 });
        this.gold = 10;
        break;

      default:
        // Unknown class — always ensure mainHand is set
        this.equipment.mainHand = W('Dagger', '1d4', 'piercing', { weight: 1 });
        this.gold = 10;
        break;
    }

    // Snapshot base stats so calculateEffectiveStats can diff correctly
    this.baseStats = {
      armorClass: this.armorClass,
      abilities: { ...this.abilities },
      maxHP: this.maxHP,
    };
  }

  getModifier(ability) {
    const score = this.abilities[ability];
    return Math.floor((score - GAME_DEFAULTS.ABILITY_SCORE) / 2);
  }

  takeDamage(amount) {
    this.currentHP = Math.max(0, this.currentHP - amount);
    return this.currentHP === 0;
  }

  damage(amount) {
    return this.takeDamage(amount);
  }

  heal(amount) {
    this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
  }

  levelUp() {
    if (this.level >= 20) {
      logger.general.warn('Character is already max level', { character: this.name, level: 20 });
      return null;
    }

    const oldLevel = this.level;
    this.level++;
    this.proficiencyBonus =
      DND.PROFICIENCY_BONUS[this.level - 1] || GAME_DEFAULTS.PROFICIENCY_BONUS;

    const hitDieValue = parseInt(this.hitDie.substring(1));
    const hpGain = Math.floor(hitDieValue / 2) + 1 + this.getModifier('constitution');
    this.maxHP += hpGain;
    this.currentHP += hpGain;

    this.hitDiceRemaining++;
    this.xpToNextLevel = Character.getXPForLevel(this.level + 1);

    return {
      oldLevel,
      newLevel: this.level,
      hpGain,
      proficiencyBonus: this.proficiencyBonus,
      newMaxHP: this.maxHP,
    };
  }

  useHitDice(count) {
    const diceToUse = Math.min(count, this.hitDiceRemaining);
    this.hitDiceRemaining -= diceToUse;
    return diceToUse;
  }

  getAttacksPerAction() {
    const classKey = this.class.toLowerCase();

    if (classKey === 'fighter') {
      if (this.level >= 20) return 4;
      if (this.level >= 11) return 3;
      if (this.level >= 5) return 2;
      return 1;
    }

    if (['barbarian', 'paladin', 'ranger', 'monk'].includes(classKey)) {
      return this.level >= 5 ? 2 : 1;
    }

    return 1;
  }

  hasAbility(abilityName) {
    return this.abilities_list.some(
      ability => ability.name.toLowerCase() === abilityName.toLowerCase()
    );
  }

  getAvailableBonusActions() {
    const bonusActions = [];

    if (this.class.toLowerCase() === 'rogue' && this.level >= 2) {
      bonusActions.push({
        name: 'Cunning Action',
        actionType: 'bonusAction',
        description: 'Dash, Disengage, or Hide as bonus action',
        uses: -1,
        maxUses: -1,
      });
    }

    if (this.class.toLowerCase() === 'monk') {
      bonusActions.push({
        name: 'Martial Arts',
        actionType: 'bonusAction',
        description: 'Make unarmed strike as bonus action after Attack action',
        uses: -1,
        maxUses: -1,
      });
    }

    if (this.class.toLowerCase() === 'barbarian') {
      const rageAbility = this.abilities_list.find(a => a.name === 'Rage');
      if (rageAbility && rageAbility.uses > 0) {
        bonusActions.push({
          ...rageAbility,
          actionType: 'bonusAction',
        });
      }
    }

    const customBonusActions = this.abilities_list.filter(
      ability =>
        ability.actionType === 'bonusAction' &&
        (!ability.maxUses || ability.maxUses === -1 || ability.uses > 0)
    );
    bonusActions.push(...customBonusActions);

    return bonusActions;
  }

  recoverHitDice(count) {
    const maxHitDice = this.level;
    const diceToRecover = Math.min(count, maxHitDice - this.hitDiceRemaining);
    this.hitDiceRemaining += diceToRecover;
    return diceToRecover;
  }

  hasRaft() {
    return this.inventory.some(item => item.effects && item.effects.allowsRiverCrossing === true);
  }

  hasBoat() {
    return this.inventory.some(item => item.effects && item.effects.allowsWaterCrossing === true);
  }

  canCrossTerrain(terrainKey) {
    if (terrainKey === 'river') {
      return this.hasRaft() || this.hasBoat();
    }
    if (terrainKey === 'water') {
      return this.hasBoat();
    }
    return true;
  }

  increasePiety(amount = 1) {
    this.hiddenStats.piety += amount;
    logger.items.info('Piety increased', {
      character: this.name,
      amount,
      totalPiety: this.hiddenStats.piety,
    });
    return this.hiddenStats.piety;
  }

  increaseGenerosity(goldOffered) {
    if (goldOffered <= 0) {
      return { success: false, message: 'Offering must be greater than 0 gold' };
    }

    if (this.gold < goldOffered) {
      return { success: false, message: `Not enough gold. You have ${this.gold} gold.` };
    }

    this.removeGold(goldOffered);

    const generosityGain = Math.max(1, Math.floor(goldOffered / 10));
    this.hiddenStats.generosity += generosityGain;

    logger.items.info('Generosity increased', {
      character: this.name,
      goldOffered,
      generosityGain,
      totalGenerosity: this.hiddenStats.generosity,
      remainingGold: this.gold,
    });

    return {
      success: true,
      goldOffered,
      generosityGain,
      totalGenerosity: this.hiddenStats.generosity,
      remainingGold: this.gold,
    };
  }

  initializeSpellSlots() {
    const casterClasses = [
      'Wizard',
      'Cleric',
      'Druid',
      'Sorcerer',
      'Bard',
      'Warlock',
      'Paladin',
      'Ranger',
    ];
    if (casterClasses.includes(this.class)) {
      this.spellSlotsUsed = { 1: 0, 2: 0, 3: 0 };
    }
  }

  toJSON() {
    const serializedEquipment = {};
    Object.keys(this.equipment).forEach(slot => {
      if (this.equipment[slot]) {
        serializedEquipment[slot] = this.equipment[slot].toJSON();
      } else {
        serializedEquipment[slot] = null;
      }
    });

    const serializedInventory = this.inventory.map(item => (item.toJSON ? item.toJSON() : item));

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
      rations: this.rations,
      daysWithoutFood: this.daysWithoutFood,
      exhaustionLevel: this.exhaustionLevel,
      foragedHexes: this.foragedHexes,
      xp: this.xp,
      xpToNextLevel: this.xpToNextLevel,
      hiddenStats: { ...this.hiddenStats },
    };
  }

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

    char.inventory = [];
    if (data.inventory) {
      char.inventory = data.inventory.map(itemData => Item.fromJSON(itemData));
    }

    char.gold = data.gold || 0;
    char.personality = data.personality || null;
    char.background = data.background || null;
    char.gender = data.gender || null;
    char.hitDiceRemaining =
      data.hitDiceRemaining !== undefined ? data.hitDiceRemaining : char.level;
    char.lastLongRest = data.lastLongRest || 0;
    char.spellSlotsUsed = data.spellSlotsUsed ? { ...data.spellSlotsUsed } : {};
    char.baseStats = data.baseStats ? { ...data.baseStats } : undefined;

    char.rations = data.rations !== undefined ? data.rations : 7;
    char.daysWithoutFood = data.daysWithoutFood || 0;
    char.exhaustionLevel = data.exhaustionLevel || 0;
    if (Array.isArray(data.foragedHexes)) {
      char.foragedHexes = {};
    } else {
      char.foragedHexes = data.foragedHexes || {};
    }

    char.xp = data.xp !== undefined ? data.xp : 0;
    char.xpToNextLevel =
      data.xpToNextLevel !== undefined
        ? data.xpToNextLevel
        : Character.getXPForLevel(char.level + 1);

    char.hiddenStats = data.hiddenStats || { piety: 0, generosity: 0 };

    return char;
  }
}
