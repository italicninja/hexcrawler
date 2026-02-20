// @ts-nocheck
// TODO: Add proper types - Spell class with effect functions
import logger from '../utils/logger';

export class Spell {
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

  cast(caster, target, diceRoller) {
    if (!this.effect) {
      return { success: false, message: `${this.name} has no effect defined` };
    }

    try {
      const result = this.effect(caster, target, diceRoller);
      return { success: true, ...result };
    } catch (error) {
      logger.combat.error('Error casting spell', {
        spell: this.name,
        error: error.message,
        caster: caster.name,
      });
      return { success: false, message: `Failed to cast ${this.name}: ${error.message}` };
    }
  }

  getSpellSaveDC(caster) {
    const spellcastingAbility = this._getSpellcastingAbility(caster.class);
    const abilityMod = this._getAbilityModifier(caster.abilities[spellcastingAbility]);
    return 8 + (caster.proficiencyBonus || 2) + abilityMod;
  }

  getSpellAttackBonus(caster) {
    const spellcastingAbility = this._getSpellcastingAbility(caster.class);
    const abilityMod = this._getAbilityModifier(caster.abilities[spellcastingAbility]);
    return (caster.proficiencyBonus || 2) + abilityMod;
  }

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
      ranger: 'wisdom',
    };
    return spellcastingAbilities[classKey] || 'intelligence';
  }

  _getAbilityModifier(abilityScore) {
    return Math.floor((abilityScore - 10) / 2);
  }

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
      description: this.description,
    };
  }
}

export default Spell;
