// Spell — D&D 5e spell definition with an effect callback
import logger from '../utils/logger';
import type { DiceRoller } from './DiceRoller';

interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
}

/** Loose shape for a spellcaster (Character / Enemy) — also used for targets. */
interface SpellCaster {
  name?: string;
  class?: string;
  proficiencyBonus?: number;
  armorClass?: number;
  abilities?: Record<string, number | undefined>;
  [key: string]: unknown;
}

type SpellEffect = (
  caster: SpellCaster,
  target: SpellCaster,
  diceRoller: DiceRoller
) => Record<string, unknown>;

interface CastResult {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface SpellConfig {
  name: string;
  level?: number;
  school?: string;
  castingTime?: string;
  range?: string;
  components?: SpellComponents;
  duration?: string;
  concentration?: boolean;
  targetType?: string;
  savingThrow?: string | null;
  attackRoll?: boolean;
  effect?: SpellEffect;
  description?: string;
}

export class Spell {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: SpellComponents;
  duration: string;
  concentration: boolean;
  targetType: string;
  savingThrow: string | null;
  attackRoll: boolean;
  effect?: SpellEffect;
  description: string;

  constructor(config: SpellConfig) {
    this.name = config.name;
    this.level = config.level ?? 0;
    this.school = config.school ?? 'Unknown';
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

  cast(caster: SpellCaster, target: unknown, diceRoller: unknown): CastResult {
    if (!this.effect) {
      return { success: false, message: `${this.name} has no effect defined` };
    }

    try {
      const result = this.effect(caster, target as SpellCaster, diceRoller as DiceRoller);
      return { success: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.combat.error('Error casting spell', {
        spell: this.name,
        error: message,
        caster: caster.name,
      });
      return { success: false, message: `Failed to cast ${this.name}: ${message}` };
    }
  }

  getSpellSaveDC(caster: SpellCaster): number {
    const spellcastingAbility = this._getSpellcastingAbility(caster.class ?? '');
    const abilityMod = this._getAbilityModifier(caster.abilities?.[spellcastingAbility] ?? 10);
    return 8 + (caster.proficiencyBonus || 2) + abilityMod;
  }

  getSpellAttackBonus(caster: SpellCaster): number {
    const spellcastingAbility = this._getSpellcastingAbility(caster.class ?? '');
    const abilityMod = this._getAbilityModifier(caster.abilities?.[spellcastingAbility] ?? 10);
    return (caster.proficiencyBonus || 2) + abilityMod;
  }

  _getSpellcastingAbility(className: string): string {
    const classKey = className.toLowerCase();
    const spellcastingAbilities: Record<string, string> = {
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

  _getAbilityModifier(abilityScore: number): number {
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
