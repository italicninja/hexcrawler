/**
 * Spell - D&D 5e Spell System
 * Represents a spell with its properties and effects
 */

export class Spell {
  /**
   * Create a new spell
   * @param {object} config - Spell configuration
   * @param {string} config.name - Spell name
   * @param {number} config.level - Spell level (0=cantrip, 1-9=spell level)
   * @param {string} config.school - School of magic (evocation, abjuration, etc.)
   * @param {string} config.castingTime - Casting time (action, bonus action, reaction, etc.)
   * @param {string} config.range - Range (self, touch, 30 feet, etc.)
   * @param {object} config.components - Components {verbal, somatic, material}
   * @param {string} config.duration - Duration (instantaneous, concentration, etc.)
   * @param {boolean} config.concentration - Whether spell requires concentration
   * @param {string} config.targetType - Target type (enemy, ally, self, area)
   * @param {string|null} config.savingThrow - Saving throw ability (STR, DEX, CON, INT, WIS, CHA, null)
   * @param {boolean} config.attackRoll - Whether spell requires attack roll
   * @param {function} config.effect - Effect function (caster, target, diceRoller) => result
   * @param {string} config.description - Spell description
   */
  constructor(config) {
    this.name = config.name;
    this.level = config.level;
    this.school = config.school;
    this.castingTime = config.castingTime || '1 action';
    this.range = config.range || 'Self';
    this.components = config.components || { verbal: true, somatic: true, material: false };
    this.duration = config.duration || 'Instantaneous';
    this.concentration = config.concentration || false;
    this.targetType = config.targetType || 'enemy';
    this.savingThrow = config.savingThrow || null;
    this.attackRoll = config.attackRoll || false;
    this.effect = config.effect;
    this.description = config.description || '';
  }

  /**
   * Cast the spell
   * @param {object} caster - Character casting the spell
   * @param {object} target - Target of the spell (can be null for self/area spells)
   * @param {object} diceRoller - DiceRoller instance for randomness
   * @returns {object} Result {success, message, damage?, healing?, effect?}
   */
  cast(caster, target, diceRoller) {
    if (!this.effect) {
      return {
        success: false,
        message: `${this.name} has no effect defined`
      };
    }

    // Execute the spell's effect function
    try {
      const result = this.effect(caster, target, diceRoller);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error(`Error casting ${this.name}:`, error);
      return {
        success: false,
        message: `Failed to cast ${this.name}: ${error.message}`
      };
    }
  }

  /**
   * Get spell's save DC for the caster
   * @param {object} caster - Character casting the spell
   * @returns {number} Spell save DC
   */
  getSpellSaveDC(caster) {
    const spellcastingAbility = this._getSpellcastingAbility(caster.class);
    const abilityMod = this._getAbilityModifier(caster.abilities[spellcastingAbility]);
    return 8 + (caster.proficiencyBonus || 2) + abilityMod;
  }

  /**
   * Get spell attack bonus for the caster
   * @param {object} caster - Character casting the spell
   * @returns {number} Spell attack bonus
   */
  getSpellAttackBonus(caster) {
    const spellcastingAbility = this._getSpellcastingAbility(caster.class);
    const abilityMod = this._getAbilityModifier(caster.abilities[spellcastingAbility]);
    return (caster.proficiencyBonus || 2) + abilityMod;
  }

  /**
   * Get spellcasting ability for a class
   * @private
   */
  _getSpellcastingAbility(className) {
    const classKey = className.toLowerCase();
    const spellcastingAbilities = {
      wizard: 'intelligence',
      sorcerer: 'charisma',
      warlock: 'charisma',
      cleric: 'wisdom',
      druid: 'wisdom',
      bard: 'charisma',
      paladin: 'charisma',
      ranger: 'wisdom'
    };
    return spellcastingAbilities[classKey] || 'intelligence';
  }

  /**
   * Calculate ability modifier
   * @private
   */
  _getAbilityModifier(abilityScore) {
    return Math.floor((abilityScore - 10) / 2);
  }

  /**
   * Serialize spell to JSON
   */
  toJSON() {
    return {
      name: this.name,
      level: this.level,
      school: this.school,
      castingTime: this.castingTime,
      range: this.range,
      components: { ...this.components },
      duration: this.duration,
      concentration: this.concentration,
      targetType: this.targetType,
      savingThrow: this.savingThrow,
      attackRoll: this.attackRoll,
      description: this.description
      // Note: effect function cannot be serialized
    };
  }
}

export default Spell;
