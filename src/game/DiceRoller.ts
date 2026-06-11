// DiceRoller — D&D 5e dice rolling system
import logger from '../utils/logger';
import type { LogMessageType } from '../types/game';

type RollType = 'normal' | 'advantage' | 'disadvantage';
type LogCallback = (message: string, type?: LogMessageType) => void;

/** Loose shape for the character objects passed into checks/attacks. */
interface RollableCharacter {
  proficiencyBonus?: number;
  saveProficiencies?: string[];
  abilities?: Record<string, number | undefined>;
  [key: string]: unknown;
}

interface AdvantageRoll {
  roll: number;
  kept: number;
  dropped: number;
}

interface CheckResult {
  roll: number;
  modifier: number;
  total: number;
  success: boolean;
  dc: number;
}

interface AttackResult {
  roll: number;
  modifier: number;
  total: number;
  hit: boolean;
  crit: boolean;
  targetAC: number;
  rollType: RollType;
}

export class DiceRoller {
  seed: string | null;
  rng: (() => number) | null;
  logger: LogCallback | null;

  constructor(seed: string | null = null, logCallback: LogCallback | null = null) {
    this.seed = seed;
    this.rng = seed !== null ? this.createSeededRNG(seed) : null;
    this.logger = logCallback; // Optional callback function (message, type) => void
  }

  createSeededRNG(seed: string): () => number {
    let seedValue = 0;
    for (let i = 0; i < seed.length; i++) {
      seedValue = (seedValue << 5) - seedValue + seed.charCodeAt(i);
      seedValue = seedValue & seedValue;
    }

    return () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
  }

  random(): number {
    return this.rng ? this.rng() : Math.random();
  }

  log(message: string, type: LogMessageType = 'info'): void {
    if (this.logger) {
      this.logger(message, type);
    }
  }

  rollD20(): number {
    return Math.floor(this.random() * 20) + 1;
  }

  rollDice(sides: number, count = 1): number {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(this.random() * sides) + 1;
    }
    return total;
  }

  rollWithAdvantage(): AdvantageRoll {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    const kept = Math.max(roll1, roll2);
    const dropped = Math.min(roll1, roll2);
    return { roll: kept, kept, dropped };
  }

  rollWithDisadvantage(): AdvantageRoll {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    const kept = Math.min(roll1, roll2);
    const dropped = Math.max(roll1, roll2);
    return { roll: kept, kept, dropped };
  }

  getAbilityModifier(abilityScore: number): number {
    return Math.floor((abilityScore - 10) / 2);
  }

  skillCheck(
    character: RollableCharacter,
    ability: string,
    proficient = false,
    dc = 10,
    rollType: RollType = 'normal',
    skillName: string | null = null
  ): CheckResult {
    if (!character) {
      throw new Error('DiceRoller.skillCheck: character is required');
    }

    const abilityScore = (character[ability] as number | undefined) || 10;
    const modifier = this.getAbilityModifier(abilityScore);
    const proficiencyBonus = proficient ? character.proficiencyBonus || 2 : 0;

    let roll;
    let rollText = '';
    if (rollType === 'advantage') {
      const result = this.rollWithAdvantage();
      roll = result.roll;
      rollText = ` (advantage: ${result.kept}, ${result.dropped})`;
    } else if (rollType === 'disadvantage') {
      const result = this.rollWithDisadvantage();
      roll = result.roll;
      rollText = ` (disadvantage: ${result.kept}, ${result.dropped})`;
    } else {
      roll = this.rollD20();
    }

    const total = roll + modifier + proficiencyBonus;
    const success = total >= dc;

    if (this.logger && skillName && dc > 0) {
      const displayName = skillName || ability.charAt(0).toUpperCase() + ability.slice(1);
      const result = success ? 'Success' : 'Failed';
      this.log(
        `${displayName}${rollText} ${roll}+${modifier + proficiencyBonus}=${total} vs DC ${dc}: ${result}`,
        success ? 'success' : 'warning'
      );
    }

    return {
      roll,
      modifier: modifier + proficiencyBonus,
      total,
      success,
      dc,
    };
  }

  perceptionCheck(character: RollableCharacter, dc = 10, rollType: RollType = 'normal'): CheckResult {
    return this.skillCheck(character, 'wisdom', true, dc, rollType, 'Perception');
  }

  investigationCheck(
    character: RollableCharacter,
    dc = 10,
    rollType: RollType = 'normal'
  ): CheckResult {
    return this.skillCheck(character, 'intelligence', true, dc, rollType, 'Investigation');
  }

  savingThrow(
    character: RollableCharacter,
    ability: string,
    dc = 10,
    rollType: RollType = 'normal'
  ): CheckResult {
    if (!character) {
      throw new Error('DiceRoller.savingThrow: character is required');
    }

    const saveProficiencies = character.saveProficiencies || [];
    const proficient = saveProficiencies.includes(ability);

    const saveName = ability.charAt(0).toUpperCase() + ability.slice(1) + ' Save';
    return this.skillCheck(character, ability, proficient, dc, rollType, saveName);
  }

  attackRoll(
    character: RollableCharacter,
    attackType: 'melee' | 'ranged' = 'melee',
    targetAC = 10,
    attackName: string | null = null,
    rollType: RollType = 'normal'
  ): AttackResult {
    if (!character) {
      throw new Error('DiceRoller.attackRoll: character is required');
    }

    const ability = attackType === 'melee' ? 'strength' : 'dexterity';
    // Abilities live at character.abilities.strength etc — not at the top level
    const abilityScore = character.abilities?.[ability] ?? 10;
    const modifier = this.getAbilityModifier(abilityScore);
    const proficiencyBonus = character.proficiencyBonus || 2;

    let roll;
    let rollText = '';
    if (rollType === 'advantage') {
      const result = this.rollWithAdvantage();
      roll = result.roll;
      rollText = ` (advantage: ${result.kept}, ${result.dropped})`;
    } else if (rollType === 'disadvantage') {
      const result = this.rollWithDisadvantage();
      roll = result.roll;
      rollText = ` (disadvantage: ${result.kept}, ${result.dropped})`;
    } else {
      roll = this.rollD20();
    }

    const total = roll + modifier + proficiencyBonus;

    const hit = roll === 20 || (roll !== 1 && total >= targetAC);
    const crit = roll === 20;

    if (this.logger && attackName) {
      const displayName = attackName || (attackType === 'melee' ? 'Melee Attack' : 'Ranged Attack');
      if (crit) {
        this.log(
          `${displayName}${rollText} CRITICAL HIT! ${roll}+${modifier + proficiencyBonus}=${total} vs AC ${targetAC}`,
          'success'
        );
      } else if (hit) {
        this.log(
          `${displayName}${rollText} ${roll}+${modifier + proficiencyBonus}=${total} vs AC ${targetAC}: Hit`,
          'success'
        );
      } else {
        this.log(
          `${displayName}${rollText} ${roll}+${modifier + proficiencyBonus}=${total} vs AC ${targetAC}: Miss`,
          'warning'
        );
      }
    }

    return {
      roll,
      modifier: modifier + proficiencyBonus,
      total,
      hit,
      crit,
      targetAC,
      rollType,
    };
  }

  damageRoll(diceString: string, damageType: string | null = null): number {
    const match = diceString.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) {
      logger.general.error('Invalid dice string', { diceString });
      return 0;
    }

    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const bonus = match[3] ? parseInt(match[3], 10) : 0;

    const damage = this.rollDice(sides, count) + bonus;

    if (this.logger && damageType) {
      this.log(`${damage} ${damageType} damage (${diceString})`, 'info');
    }

    return damage;
  }
}

export default DiceRoller;
