/* eslint-disable @typescript-eslint/no-explicit-any -- loose boundary, see TODO.md */
/**
 * RestManager - Handles D&D 5e rest mechanics
 */
export class RestManager {
  /**
   * Perform a short rest (1 hour)
   */
   
  static shortRest(
    character: any,
    hitDiceToSpend = 0
  ): {
    success: boolean;
    hpRecovered: number;
    hitDiceSpent: number;
    hitDiceRemaining?: number;
    message: string;
  } {
    if (!this.canShortRest(character)) {
      return {
        success: false,
        hpRecovered: 0,
        hitDiceSpent: 0,
        message: 'Cannot short rest - no hit dice remaining!',
      };
    }

    const diceToSpend = Math.min(hitDiceToSpend, character.hitDiceRemaining, character.level);

    if (diceToSpend === 0) {
      return {
        success: true,
        hpRecovered: 0,
        hitDiceSpent: 0,
        message: 'Short rest completed. No hit dice spent.',
      };
    }

    let hpRecovered = 0;
    const hitDieValue = parseInt(character.hitDie.substring(1));
    const conModifier = character.getModifier('constitution');

    for (let i = 0; i < diceToSpend; i++) {
      const roll = Math.floor(hitDieValue / 2) + 1;
      hpRecovered += Math.max(1, roll + conModifier);
    }

    const hpBefore = character.currentHP;
    character.heal(hpRecovered);
    const actualRecovery = character.currentHP - hpBefore;

    character.useHitDice(diceToSpend);
    this.recoverShortRestAbilities(character);

    return {
      success: true,
      hpRecovered: actualRecovery,
      hitDiceSpent: diceToSpend,
      hitDiceRemaining: character.hitDiceRemaining,
      message: `Short rest completed. Recovered ${actualRecovery} HP using ${diceToSpend} hit dice.`,
    };
  }

  /**
   * Perform a long rest (8 hours)
   */
   
  static longRest(
    character: any,
    currentGameTime = 0
  ): {
    success: boolean;
    hpRecovered: number;
    hitDiceRecovered: number;
    hitDiceRemaining?: number;
    message: string;
  } {
    const canRest = this.canLongRest(character, currentGameTime);

    if (!canRest.allowed) {
      return { success: false, hpRecovered: 0, hitDiceRecovered: 0, message: canRest.reason };
    }

    const hpBefore = character.currentHP;
    character.currentHP = character.maxHP;
    const hpRecovered = character.maxHP - hpBefore;

    const maxHitDice = character.level;
    const hitDiceMissing = maxHitDice - character.hitDiceRemaining;
    const hitDiceToRecover = Math.max(1, Math.floor(maxHitDice / 2));
    const actualHitDiceRecovered = Math.min(hitDiceToRecover, hitDiceMissing);

    character.recoverHitDice(actualHitDiceRecovered);
    this.recoverLongRestAbilities(character);
    character.lastLongRest = currentGameTime;

    return {
      success: true,
      hpRecovered,
      hitDiceRecovered: actualHitDiceRecovered,
      hitDiceRemaining: character.hitDiceRemaining,
      message: `Long rest completed. Fully recovered HP and ${actualHitDiceRecovered} hit dice.`,
    };
  }

   
  static canShortRest(character: any): boolean {
    return character.hitDiceRemaining > 0;
  }

   
  static canLongRest(character: any, currentGameTime = 0): { allowed: boolean; reason: string } {
    if (character.lastLongRest === 0) {
      return { allowed: true, reason: 'Can long rest.' };
    }

    const hoursSinceLastRest = currentGameTime - character.lastLongRest;
    const minHoursBetweenRests = 24;

    if (hoursSinceLastRest < minHoursBetweenRests) {
      const hoursRemaining = Math.ceil(minHoursBetweenRests - hoursSinceLastRest);
      return { allowed: false, reason: `Cannot long rest again for ${hoursRemaining} more hours.` };
    }

    return { allowed: true, reason: 'Can long rest.' };
  }

   
  static recoverShortRestAbilities(character: any): void {
    if (!character.abilities_list || !Array.isArray(character.abilities_list)) return;

    character.abilities_list = character.abilities_list.map((ability: any) => {
      if (!ability.maxUses || ability.maxUses === -1) return ability; // Unlimited — no change

      // PHB'24 Rage: recover 1 use on Short Rest, not all uses
      if (ability.name === 'Rage' && ability.uses < ability.maxUses) {
        return { ...ability, uses: ability.uses + 1 };
      }

      // Default short-rest abilities: recover all uses on a short rest
      // (e.g. Fighter Second Wind, Monk Ki, etc.)
      if (ability.restType === 'short' && ability.uses < ability.maxUses) {
        return { ...ability, uses: ability.maxUses };
      }

      // Long-rest-only abilities: do not recover on short rest
      // (uses maxUses being present but restType is 'long' or unset means long rest only)
      return ability;
    });
  }

   
  static recoverLongRestAbilities(character: any): void {
    if (character.abilities_list && Array.isArray(character.abilities_list)) {
      character.abilities_list = character.abilities_list.map((ability: any) => ({
        ...ability,
        uses: ability.maxUses || ability.uses,
      }));
    }

    if (character.spellSlotsUsed) {
      character.spellSlotsUsed = {};
    }
  }

  static calculateInterruptionChance(terrainType: string, terrainDifficulty = 1): number {
    let baseChance = 10;
    baseChance += (terrainDifficulty - 1) * 5;

    const terrainModifiers: Record<string, number> = {
      water: 0,
      grassland: 0,
      desert: 5,
      hills: 5,
      forest: 10,
      mountain: 15,
      swamp: 15,
    };

    const modifier = terrainModifiers[terrainType] || 5;
    baseChance += modifier;

    return Math.min(30, baseChance);
  }

  static isRestInterrupted(terrainType: string, terrainDifficulty: number): boolean {
    const chance = this.calculateInterruptionChance(terrainType, terrainDifficulty);
    const roll = Math.random() * 100;
    return roll < chance;
  }

  /**
   * Perform an inn rest (guaranteed safe long rest)
   */
   
  static innRest(
    character: any,
    party: any,
    costPerPerson = 10,
    currentGameTime = 0
  ): {
    success: boolean;
    hpRecovered: number;
    hitDiceRecovered: number;
    goldSpent: number;
    livingMembers?: number;
    message: string;
  } {
    const livingMembers = party ? party.getLivingMembers().length : 1;
    const totalCost = livingMembers * costPerPerson;

    if (character.gold < totalCost) {
      return {
        success: false,
        hpRecovered: 0,
        hitDiceRecovered: 0,
        goldSpent: 0,
        message: `Not enough gold! Inn rest costs ${totalCost} gold (${costPerPerson} per party member).`,
      };
    }

    if (character.currentHP >= character.maxHP) {
      return {
        success: false,
        hpRecovered: 0,
        hitDiceRecovered: 0,
        goldSpent: 0,
        message: 'Your party is already fully rested.',
      };
    }

    const hpBefore = character.currentHP;
    character.removeGold(totalCost);
    character.currentHP = character.maxHP;
    const hpRecovered = character.maxHP - hpBefore;

    const maxHitDice = character.level;
    const hitDiceMissing = maxHitDice - character.hitDiceRemaining;
    character.recoverHitDice(hitDiceMissing);

    this.recoverLongRestAbilities(character);
    character.lastLongRest = currentGameTime;

    return {
      success: true,
      hpRecovered,
      hitDiceRecovered: hitDiceMissing,
      goldSpent: totalCost,
      livingMembers,
      message: `Rested at the inn for ${totalCost} gold. Fully recovered! (Meal and water included)`,
    };
  }
}
