/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AbilityEffects - D&D 5e Class Ability System
 * Executes class abilities with D&D 5e rules
 */

import { DiceRoller } from './DiceRoller';

/** A status effect entry on a combatant. Shape is intentionally permissive. */
interface StatusEffect {
  name: string;
  duration?: number;
  maxDuration?: number;
  roundsActive?: number;
  extendedThisTurn?: boolean;
  effects?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * A combatant — the turn-order entry, which wraps a Character or Enemy and
 * carries combat-time state. Methods (heal/takeDamage/getModifier/...) and
 * extra fields resolve through the index signature while the migration of
 * Combat.ts is pending.
 */
interface Combatant {
  name: string;
  level: number;
  currentHP: number;
  maxHP: number;
  armorClass: number;
  proficiencyBonus: number;
  type?: string;
  statusEffects?: StatusEffect[];
  layOnHandsPool?: number;
  spellSlots?: Record<number, number>;
  [key: string]: any;
}

interface CombatLike {
  diceRoller?: DiceRoller;
  enemies?: Combatant[];
  [key: string]: any;
}

interface AbilityResult {
  success: boolean;
  message: string;
  effect?: Record<string, unknown>;
}

/**
 * Ability execution system
 * Each ability handler receives (combatant, target, combat) and returns result
 */
export class AbilityEffects {
  /**
   * Execute a class ability
   * @param {string} abilityName - Name of the ability to execute
   * @param {Object} combatant - Character using the ability
   * @param {Object} target - Target of the ability (can be self or ally)
   * @param {Object} combat - Combat instance
   * @returns {Object} {success, message, effect?}
   */
  static execute(
    abilityName: string,
    combatant: Combatant,
    target: Combatant,
    combat: CombatLike
  ): AbilityResult {
    const diceRoller = combat.diceRoller || new DiceRoller();

    // Dispatch to specific ability handler
    switch (abilityName) {
      case 'Rage':
        return this.rage(combatant, diceRoller);

      case 'Reckless Attack':
        return this.recklessAttack(combatant);

      case 'Extend Rage':
        return this.extendRage(combatant);

      case 'Second Wind':
        return this.secondWind(combatant, diceRoller);

      case 'Sneak Attack':
        return this.sneakAttack(combatant, target, combat, diceRoller);

      case 'Lay on Hands':
        return this.layOnHands(combatant, target, diceRoller);

      case 'Ki Points':
        return this.kiPoints(combatant, target, diceRoller);

      case 'Bardic Inspiration':
        return this.bardicInspiration(combatant, target, diceRoller);

      case 'Channel Divinity':
        return this.channelDivinity(combatant, combat, diceRoller);

      case 'Wild Shape':
        return this.wildShape(combatant, diceRoller);

      case 'Sorcery Points':
        return this.sorceryPoints(combatant, diceRoller);

      case 'Eldritch Invocations':
        return this.eldritchInvocations(combatant, diceRoller);

      case 'Arcane Recovery':
        return this.arcaneRecovery(combatant, diceRoller);

      default:
        return {
          success: false,
          message: `Unknown ability: ${abilityName}`,
        };
    }
  }

  /**
   * Barbarian - Rage (PHB'24 p51)
   * Entry: Bonus action; cannot be wearing Heavy armor.
   * Effects while active:
   *   - Resistance to Bludgeoning, Piercing, and Slashing damage
   *   - Bonus damage on STR attacks (melee weapon or unarmed strike): +2 / +3 / +4 by level
   *   - Advantage on Strength checks and Strength saving throws
   *   - Cannot maintain Concentration or cast spells
   * Duration: Until end of next turn; extends each turn by:
   *   - Making an attack roll against an enemy
   *   - Forcing an enemy to make a saving throw
   *   - Taking a Bonus Action to extend
   * Maximum 10 minutes (10 rounds in combat).
   * Uses: recover 1 on Short Rest, all on Long Rest.
   */
  static rage(combatant: Combatant, diceRoller: DiceRoller): AbilityResult {
    // combatant here is the turnOrder entry: { id, character, enemy, statusEffects, hp, ... }
    const character = combatant.character;

    // PHB'24: Cannot enter Rage while wearing Heavy armor
    const chestArmor = character?.equipment?.chest;
    if (chestArmor && chestArmor.armorType === 'heavy') {
      return {
        success: false,
        message: `${combatant.name} cannot enter Rage while wearing heavy armor.`,
      };
    }

    // Rage damage bonus scales with Barbarian level (PHB'24 Barbarian table)
    const level = character?.level || 1;
    const rageDamageBonus = level >= 16 ? 4 : level >= 9 ? 3 : 2;

    // Initialize statusEffects array if needed
    if (!combatant.statusEffects) {
      combatant.statusEffects = [];
    }

    // Remove any existing Rage (re-entering refreshes it)
    combatant.statusEffects = combatant.statusEffects.filter(e => e.name !== 'Rage');

    combatant.statusEffects.push({
      name: 'Rage',
      // Duration tracks whether extension criteria were met this turn.
      // tickRage() in Combat.ts processes the real turn-by-turn expiry.
      duration: 1, // 1 = active; tickRage decrements / removes on turn start
      maxDuration: 10, // Hard cap: 10 rounds (10-minute maximum)
      roundsActive: 0, // How many turns have elapsed while raging
      extendedThisTurn: false, // Set to true when an attack or qualifying action occurs
      effects: {
        physicalResistance: true, // Resistance to BPS damage (halve incoming)
        rageDamageBonus, // +2/+3/+4 added to STR-based melee/unarmed damage
        strengthAdvantage: true, // Advantage on STR checks and STR saving throws
      },
    });

    return {
      success: true,
      message: `${combatant.name} enters a Rage! Resistance to physical damage, +${rageDamageBonus} damage on STR attacks, Advantage on Strength.`,
      effect: {
        type: 'buff',
        name: 'Rage',
        duration: 1,
      },
    };
  }

  /**
   * Barbarian - Reckless Attack (PHB'24 p52)
   * Declared before the first attack roll on the barbarian's turn.
   * Effect: Advantage on STR attack rolls until start of next turn.
   * Cost:   Attackers also have Advantage against the barbarian during that time.
   * This applies a status effect that Combat.processAttack reads for both sides.
   */
  static recklessAttack(combatant: Combatant): AbilityResult {
    if (!combatant.statusEffects) {
      combatant.statusEffects = [];
    }

    // Idempotent — declaring again on the same turn is a no-op
    const already = combatant.statusEffects.find(e => e.name === 'Reckless Attack');
    if (already) {
      return {
        success: false,
        message: `${combatant.name} is already attacking recklessly this turn.`,
      };
    }

    combatant.statusEffects.push({
      name: 'Reckless Attack',
      duration: 1, // expires at start of next turn via tickStatusEffects
      effects: {
        advantageOnStrAttacks: true, // attacker gains advantage on STR melee rolls
        vulnerableToAdvantage: true, // attackers against this combatant gain advantage
      },
    });

    return {
      success: true,
      message: `${combatant.name} attacks recklessly! Advantage on STR attacks, but enemies also have Advantage against you.`,
      effect: { type: 'buff', name: 'Reckless Attack', duration: 1 },
    };
  }

  /**
   * Barbarian - Extend Rage (PHB'24 p51)
   * Bonus action used on the rager's turn to extend Rage for another round
   * when no attack or forced save was made.
   */
  static extendRage(combatant: Combatant): AbilityResult {
    if (!combatant.statusEffects) {
      return { success: false, message: `${combatant.name} is not currently raging.` };
    }

    const rageEffect = combatant.statusEffects.find(e => e.name === 'Rage');
    if (!rageEffect) {
      return { success: false, message: `${combatant.name} is not currently raging.` };
    }

    if ((rageEffect.roundsActive ?? 0) >= (rageEffect.maxDuration ?? Infinity)) {
      return {
        success: false,
        message: `${combatant.name}'s Rage has reached the 10-round limit.`,
      };
    }

    rageEffect.extendedThisTurn = true;

    return {
      success: true,
      message: `${combatant.name} channels their fury, extending the Rage.`,
      effect: {
        type: 'buff',
        name: 'ExtendRage',
      },
    };
  }

  /**
   * Fighter - Second Wind
   * Heal: 1d10 + fighter level
   */
  static secondWind(combatant: Combatant, diceRoller: DiceRoller): AbilityResult {
    const healRoll = diceRoller.rollDice(10, 1);
    const totalHeal = healRoll + combatant.level;

    const oldHP = combatant.currentHP;
    combatant.heal(totalHeal);
    const actualHeal = combatant.currentHP - oldHP;

    return {
      success: true,
      message: `${combatant.name} uses Second Wind! Heals ${actualHeal} HP (rolled ${healRoll} + ${combatant.level} level).`,
      effect: {
        type: 'heal',
        amount: actualHeal,
      },
    };
  }

  /**
   * Rogue - Sneak Attack
   * Auto-trigger when has advantage OR ally adjacent to target
   * Damage: +1d6 per 2 rogue levels (min 1d6)
   */
  static sneakAttack(
    combatant: Combatant,
    target: Combatant,
    combat: CombatLike,
    diceRoller: DiceRoller
  ): AbilityResult {
    // Calculate sneak attack dice
    const sneakDice = Math.max(1, Math.floor(combatant.level / 2));
    const sneakDamage = diceRoller.rollDice(6, sneakDice);

    // Apply damage to target
    if (target && target.takeDamage) {
      target.takeDamage(sneakDamage);
    }

    return {
      success: true,
      message: `${combatant.name} delivers a Sneak Attack! +${sneakDamage} damage (${sneakDice}d6).`,
      effect: {
        type: 'damage',
        amount: sneakDamage,
        damageType: 'piercing',
      },
    };
  }

  /**
   * Paladin - Lay on Hands
   * Heal target ally: Uses from pool (5 × paladin level)
   */
  static layOnHands(
    combatant: Combatant,
    target: Combatant,
    diceRoller: DiceRoller
  ): AbilityResult {
    // Initialize lay on hands pool if needed
    if (combatant.layOnHandsPool === undefined) {
      combatant.layOnHandsPool = 5 * combatant.level;
    }

    // Check if pool has charges
    if (combatant.layOnHandsPool <= 0) {
      return {
        success: false,
        message: `${combatant.name} has no Lay on Hands charges remaining.`,
      };
    }

    // Determine heal amount (use up to 5 HP or remaining pool)
    const healAmount = Math.min(5, combatant.layOnHandsPool);

    const oldHP = target.currentHP;
    target.heal(healAmount);
    const actualHeal = target.currentHP - oldHP;

    combatant.layOnHandsPool -= actualHeal;

    return {
      success: true,
      message: `${combatant.name} uses Lay on Hands on ${target.name}! Heals ${actualHeal} HP. (${combatant.layOnHandsPool} pool remaining)`,
      effect: {
        type: 'heal',
        amount: actualHeal,
      },
    };
  }

  /**
   * Monk - Ki Points
   * Flurry of Blows: Extra unarmed attack
   * Patient Defense: Dodge as bonus action
   * Step of the Wind: Disengage or Dash as bonus action
   */
  static kiPoints(combatant: Combatant, target: Combatant, diceRoller: DiceRoller): AbilityResult {
    // For now, implement Flurry of Blows (most common use)
    const damage = diceRoller.rollDice(4, 1) + combatant.getModifier('dexterity');

    if (target && target.takeDamage) {
      target.takeDamage(damage);
    }

    return {
      success: true,
      message: `${combatant.name} uses Flurry of Blows! Extra unarmed strike deals ${damage} damage.`,
      effect: {
        type: 'damage',
        amount: damage,
        damageType: 'bludgeoning',
      },
    };
  }

  /**
   * Bard - Bardic Inspiration
   * Give ally inspiration die (1d6)
   */
  static bardicInspiration(
    combatant: Combatant,
    target: Combatant,
    diceRoller: DiceRoller
  ): AbilityResult {
    // Initialize statusEffects on target
    if (!target.statusEffects) {
      target.statusEffects = [];
    }

    // Add inspiration die
    target.statusEffects.push({
      name: 'Bardic Inspiration',
      duration: 10, // 10 minutes (or until used)
      effects: {
        inspirationDie: 6, // d6
      },
    });

    return {
      success: true,
      message: `${combatant.name} gives ${target.name} Bardic Inspiration (d6)! Can add to next attack, save, or ability check.`,
      effect: {
        type: 'buff',
        name: 'Bardic Inspiration',
        target: target.name,
      },
    };
  }

  /**
   * Cleric - Channel Divinity (Turn Undead)
   * Target all undead within 30 ft
   * WIS save vs DC 13
   */
  static channelDivinity(
    combatant: Combatant,
    combat: CombatLike,
    diceRoller: DiceRoller
  ): AbilityResult {
    const saveDC = 8 + combatant.proficiencyBonus + combatant.getModifier('wisdom');
    const turnedEnemies: string[] = [];

    // Find all undead enemies within range (30 ft = 6 hexes).
    // TODO: gate on actual position data; for now all undead are affected.
    if (combat.enemies) {
      combat.enemies.forEach(enemy => {
        if (enemy.type === 'undead' && !enemy.checkIsDead()) {
          // Check if in range (would need position data in real combat)
          // For now, affect all undead

          // Roll WIS save for enemy
          const saveRoll = diceRoller.rollD20();
          const saveTotal = saveRoll + enemy.getModifier('wisdom');

          if (saveTotal < saveDC) {
            // Failed save - mark as turned
            if (!enemy.statusEffects) {
              enemy.statusEffects = [];
            }
            enemy.statusEffects.push({
              name: 'Turned',
              duration: 10, // 1 minute
              effects: {
                feared: true,
              },
            });
            turnedEnemies.push(enemy.name);
          }
        }
      });
    }

    if (turnedEnemies.length > 0) {
      return {
        success: true,
        message: `${combatant.name} uses Channel Divinity! ${turnedEnemies.join(', ')} are turned (DC ${saveDC}).`,
        effect: {
          type: 'debuff',
          targets: turnedEnemies,
        },
      };
    } else {
      return {
        success: false,
        message: `${combatant.name} uses Channel Divinity, but no undead are affected.`,
      };
    }
  }

  /**
   * Druid - Wild Shape
   * Transform into beast (CR ≤ level/3)
   * Separate HP pool
   */
  static wildShape(combatant: Combatant, diceRoller: DiceRoller): AbilityResult {
    // TODO: choose beast by CR (CR ≤ level/3); currently hardcoded to a Brown Bear.

    // Store original form
    combatant.wildShapeOriginalForm = {
      currentHP: combatant.currentHP,
      maxHP: combatant.maxHP,
      armorClass: combatant.armorClass,
      abilities: { ...combatant.abilities },
    };

    // Transform into beast (example: Brown Bear for CR 1)
    const beastHP = 34; // Brown Bear HP
    combatant.currentHP = beastHP;
    combatant.maxHP = beastHP;
    combatant.armorClass = 11; // Brown Bear AC

    // Mark as wild shaped
    combatant.inWildShape = true;

    return {
      success: true,
      message: `${combatant.name} transforms into a beast! Gains ${beastHP} temporary HP.`,
      effect: {
        type: 'transform',
        name: 'Wild Shape',
        temporaryHP: beastHP,
      },
    };
  }

  /**
   * Sorcerer - Sorcery Points
   * Metamagic: Quicken Spell (cast as bonus action)
   */
  static sorceryPoints(combatant: Combatant, diceRoller: DiceRoller): AbilityResult {
    // Initialize statusEffects
    if (!combatant.statusEffects) {
      combatant.statusEffects = [];
    }

    // Add quickened spell effect
    combatant.statusEffects.push({
      name: 'Quickened Spell',
      duration: 1, // This turn only
      effects: {
        bonusActionSpell: true,
      },
    });

    return {
      success: true,
      message: `${combatant.name} uses Sorcery Points! Can cast a spell as a bonus action this turn.`,
      effect: {
        type: 'buff',
        name: 'Quickened Spell',
      },
    };
  }

  /**
   * Warlock - Eldritch Invocations
   * Agonizing Blast: +CHA to Eldritch Blast damage
   */
  static eldritchInvocations(combatant: Combatant, diceRoller: DiceRoller): AbilityResult {
    // Passive ability - add CHA modifier to Eldritch Blast
    const chaBonus = combatant.getModifier('charisma');

    return {
      success: true,
      message: `${combatant.name} has Agonizing Blast! Eldritch Blast deals +${chaBonus} damage.`,
      effect: {
        type: 'passive',
        name: 'Agonizing Blast',
        damageBonus: chaBonus,
      },
    };
  }

  /**
   * Wizard - Arcane Recovery
   * Recover spell slots = wizard level / 2 (rounded up)
   */
  static arcaneRecovery(combatant: Combatant, diceRoller: DiceRoller): AbilityResult {
    const slotsRecovered = Math.ceil(combatant.level / 2);

    // Initialize spell slots if needed
    if (!combatant.spellSlots) {
      combatant.spellSlots = {
        1: 2,
        2: 0,
        3: 0,
      };
    }

    // Recover level 1 slots (simplified)
    combatant.spellSlots[1] = Math.min(combatant.spellSlots[1] + slotsRecovered, 4);

    return {
      success: true,
      message: `${combatant.name} uses Arcane Recovery! Recovers ${slotsRecovered} spell slot levels.`,
      effect: {
        type: 'resource',
        name: 'Arcane Recovery',
        slotsRecovered,
      },
    };
  }
}

export default AbilityEffects;
