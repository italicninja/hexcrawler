// @ts-nocheck
// TODO: Add proper types - DiceRoller D&D 5e dice rolling system
import logger from '../utils/logger';

export class DiceRoller {
  constructor(seed = null, logger = null) {
    this.seed = seed;
    this.rng = seed !== null ? this.createSeededRNG(seed) : null;
    this.logger = logger; // Optional callback function (message, type) => void
  }

  createSeededRNG(seed) {
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

  random() {
    return this.rng ? this.rng() : Math.random();
  }

  log(message, type = 'info') {
    if (this.logger) {
      this.logger(message, type);
    }
  }

  rollD20() {
    return Math.floor(this.random() * 20) + 1;
  }

  rollDice(sides, count = 1) {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(this.random() * sides) + 1;
    }
    return total;
  }

  rollWithAdvantage() {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    return Math.max(roll1, roll2);
  }

  rollWithDisadvantage() {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    return Math.min(roll1, roll2);
  }

  getAbilityModifier(abilityScore) {
    return Math.floor((abilityScore - 10) / 2);
  }

  skillCheck(
    character,
    ability,
    proficient = false,
    dc = 10,
    rollType = 'normal',
    skillName = null
  ) {
    if (!character) {
      throw new Error('DiceRoller.skillCheck: character is required');
    }

    const abilityScore = character[ability] || 10;
    const modifier = this.getAbilityModifier(abilityScore);
    const proficiencyBonus = proficient ? character.proficiencyBonus || 2 : 0;

    let roll;
    let rollText = '';
    if (rollType === 'advantage') {
      roll = this.rollWithAdvantage();
      rollText = ' (advantage)';
    } else if (rollType === 'disadvantage') {
      roll = this.rollWithDisadvantage();
      rollText = ' (disadvantage)';
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

  perceptionCheck(character, dc = 10, rollType = 'normal') {
    return this.skillCheck(character, 'wisdom', true, dc, rollType, 'Perception');
  }

  investigationCheck(character, dc = 10, rollType = 'normal') {
    return this.skillCheck(character, 'intelligence', true, dc, rollType, 'Investigation');
  }

  savingThrow(character, ability, dc = 10, rollType = 'normal') {
    if (!character) {
      throw new Error('DiceRoller.savingThrow: character is required');
    }

    const saveProficiencies = character.saveProficiencies || [];
    const proficient = saveProficiencies.includes(ability);

    const saveName = ability.charAt(0).toUpperCase() + ability.slice(1) + ' Save';
    return this.skillCheck(character, ability, proficient, dc, rollType, saveName);
  }

  attackRoll(
    character,
    attackType = 'melee',
    targetAC = 10,
    attackName = null,
    rollType = 'normal'
  ) {
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
      roll = this.rollWithAdvantage();
      rollText = ' (advantage)';
    } else if (rollType === 'disadvantage') {
      roll = this.rollWithDisadvantage();
      rollText = ' (disadvantage)';
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

  damageRoll(diceString, damageType = null) {
    const match = diceString.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) {
      logger.general.error('Invalid dice string', { diceString });
      return 0;
    }

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const bonus = match[3] ? parseInt(match[3]) : 0;

    const damage = this.rollDice(sides, count) + bonus;

    if (this.logger && damageType) {
      this.log(`${damage} ${damageType} damage (${diceString})`, 'info');
    }

    return damage;
  }
}

export default DiceRoller;
