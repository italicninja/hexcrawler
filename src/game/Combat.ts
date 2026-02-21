// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * Combat.js - D&D 5e combat system
 */
import { DiceRoller } from './DiceRoller';
import { Character } from './Character';
import { Enemy } from './Enemy';
import { getHexDistance } from '../utils/hexMath';
import { DND, COMBAT } from '../constants/gameConstants';
import { checkLineOfSight } from './LineOfSight';
import { AbilityEffects } from './AbilityEffects';
import { getSpell, hasSpellSlot, useSpellSlot } from './SpellManager';
import { AIEngine } from './ai/AIEngine';
import logger from '../utils/logger';

/**
 * D&D 5e CR to XP Conversion Table
 * Maps Challenge Rating to Experience Points awarded
 */
export const CR_TO_XP = {
  0: 10,
  0.125: 25, // CR 1/8
  0.25: 50, // CR 1/4
  0.5: 100, // CR 1/2
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

/**
 * Get XP value for a given CR
 * @param {number} cr - Challenge Rating
 * @returns {number} XP value
 */
export function getXPForCR(cr) {
  return CR_TO_XP[cr] || 0;
}

export class Combat {
  constructor(characters, enemies, battlefield = null, options = {}) {
    // Legacy support: if battlefield is an object with canFlee property, it's actually options
    if (
      battlefield &&
      typeof battlefield === 'object' &&
      'canFlee' in battlefield &&
      !Array.isArray(battlefield)
    ) {
      options = battlefield;
      battlefield = null;
    }

    // Legacy properties (for auto-combat)
    this.characters = characters; // Array of Character instances (party members)
    this.enemies = enemies; // Array of Enemy instances

    // Hex combat properties
    this.allies = characters.map((char, i) => ({
      id: `ally-${i}`,
      character: char,
      hp: char.currentHP,
      maxHp: char.maxHP,
      isEnemy: false,
      position: null, // Will be set by EncounterPositions
      statusEffects: [],
    }));

    this.enemyCombatants = enemies.map((enemy, i) => ({
      id: `enemy-${i}`,
      character: enemy,
      hp: enemy.currentHP,
      maxHp: enemy.maxHP,
      isEnemy: true,
      position: null,
      statusEffects: [],
    }));

    this.battlefield = battlefield;
    this.turnOrder = [];
    this.currentTurnIndex = 0;

    // Shared properties
    this.logger = options.logger || null; // Optional GameLog callback (message, type) => void
    this.diceRoller = new DiceRoller(null, this.logger);
    this.combatLog = [];
    this.round = 0;
    this.canFlee = options.canFlee !== false; // Default true
    this.fleeAttempted = false;
    this.fleeDC = 10 + Math.floor(this.getAverageCR() / 2); // Higher CR = harder to flee

    // AI initialization flag
    this.aiInitialized = false;
  }

  /**
   * Initialize AI for all enemy combatants
   * Must be called before combat starts (after construction)
   * @returns {Promise<void>}
   */
  async initializeAI() {
    if (this.aiInitialized) {
      logger.combat.warn('AI already initialized');
      return;
    }

    logger.combat.info('Initializing AI for combat', {
      enemyCount: this.enemyCombatants.length,
    });

    // Load AI for each enemy
    const aiLoadPromises = this.enemyCombatants.map(async combatant => {
      const enemy = combatant.character;

      if (!enemy || !enemy.family) {
        logger.combat.warn('Enemy missing family, skipping AI load', {
          combatant: combatant.id,
        });
        return;
      }

      try {
        combatant.aiConfig = await AIEngine.loadAI(enemy.family, enemy.variant);
        enemy.aiConfig = combatant.aiConfig; // Store on enemy too

        logger.combat.info('AI loaded for enemy', {
          name: enemy.name,
          family: enemy.family,
          variant: enemy.variant,
        });
      } catch (error) {
        logger.combat.error('Failed to load AI', {
          name: enemy.name,
          family: enemy.family,
          variant: enemy.variant,
          error: error.message,
        });

        // Use fallback AI
        combatant.aiConfig = AIEngine.getFallbackAI();
      }
    });

    await Promise.all(aiLoadPromises);

    this.aiInitialized = true;
    logger.combat.info('AI initialization complete');
  }

  /**
   * Get average CR of enemies
   */
  getAverageCR() {
    if (this.enemies.length === 0) return 0;
    const totalCR = this.enemies.reduce((sum, enemy) => sum + enemy.cr, 0);
    return totalCR / this.enemies.length;
  }

  /**
   * Roll initiative for all combatants
   * @returns {Array} Turn order (sorted by initiative)
   */
  rollInitiative() {
    const initiatives = [];

    // Roll for characters
    this.characters.forEach(char => {
      if (char && char.currentHP > 0) {
        const dexMod = Math.floor((char.abilities.dexterity - 10) / 2);
        const itemBonus = char.initiativeBonus || 0;
        const roll = this.diceRoller.rollD20();
        const total = roll + dexMod + itemBonus;

        initiatives.push({
          type: 'character',
          combatant: char,
          initiative: total,
          roll: roll,
        });
      }
    });

    // Roll for enemies
    this.enemies.forEach(enemy => {
      if (!enemy.checkIsDead()) {
        const dexMod = Math.floor((enemy.abilities.dexterity - 10) / 2);
        const roll = this.diceRoller.rollD20();
        const total = roll + dexMod;

        initiatives.push({
          type: 'enemy',
          combatant: enemy,
          initiative: total,
          roll: roll,
        });
      }
    });

    // Sort by initiative (highest first)
    initiatives.sort((a, b) => b.initiative - a.initiative);

    // Log initiative
    this.log('=== INITIATIVE ===');
    initiatives.forEach(init => {
      const name = init.combatant.name;
      const dexMod = Math.floor((init.combatant.abilities.dexterity - 10) / 2);
      const itemBonus = init.combatant.initiativeBonus || 0;
      const modStr =
        itemBonus !== 0
          ? `${dexMod >= 0 ? '+' : ''}${dexMod} item+${itemBonus}`
          : `${dexMod >= 0 ? '+' : ''}${dexMod}`;
      this.log(`${name}: ${init.initiative} (rolled ${init.roll}${modStr})`);
    });
    this.log('');

    return initiatives;
  }

  /**
   * Simulate one round of combat
   * @param {Array} turnOrder - Initiative order
   * @returns {boolean} True if combat should continue
   */
  simulateRound(turnOrder) {
    this.round++;
    this.log(`=== ROUND ${this.round} ===`);

    for (const turn of turnOrder) {
      const combatant = turn.combatant;

      // Skip dead combatants
      if (turn.type === 'character' && combatant.currentHP <= 0) {
        continue;
      }
      if (turn.type === 'enemy' && combatant.checkIsDead()) {
        continue;
      }

      // Execute turn
      if (turn.type === 'character') {
        this.executeCharacterTurn(combatant);
      } else {
        this.executeEnemyTurn(combatant);
      }

      // Check victory/defeat conditions after each turn
      if (this.checkVictory()) {
        return false; // Combat ends
      }
      if (this.checkDefeat()) {
        return false; // Combat ends
      }
    }

    this.log('');
    return true; // Combat continues
  }

  /**
   * Execute a character's turn
   */
  executeCharacterTurn(character) {
    this.log(`${character.name}'s turn:`);

    // Find living enemies
    const livingEnemies = this.enemies.filter(e => !e.checkIsDead());
    if (livingEnemies.length === 0) return;

    // Select random target
    const target = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];

    // Determine attack type based on character abilities
    const attackType =
      character.abilities.dexterity > character.abilities.strength ? 'ranged' : 'melee';

    // Get weapon damage (check equipped weapon or use default)
    let weaponDamage = '1d6'; // Default
    let damageType = 'slashing';
    let attackBonus = 0;
    let damageBonus = 0;

    if (character.equipment && character.equipment.mainHand) {
      const weapon = character.equipment.mainHand;
      weaponDamage = weapon.damage || '1d6';
      damageType = weapon.damageType || 'slashing';
      if (weapon.effects) {
        attackBonus = weapon.effects.attackBonus || 0;
        damageBonus = weapon.effects.damageBonus || 0;
      }
    }

    // Roll attack
    const abilityMod =
      attackType === 'melee'
        ? Math.floor((character.abilities.strength - 10) / 2)
        : Math.floor((character.abilities.dexterity - 10) / 2);

    const attackRoll = this.diceRoller.rollD20();
    const attackTotal = attackRoll + abilityMod + character.proficiencyBonus + attackBonus;

    const hit =
      attackRoll === DND.NATURAL_20 || (attackRoll !== DND.NATURAL_1 && attackTotal >= target.ac);
    const crit = attackRoll === DND.NATURAL_20;

    if (hit) {
      // Roll damage
      let damage = this.diceRoller.damageRoll(weaponDamage) + abilityMod + damageBonus;

      // Double damage on crit
      if (crit) {
        damage += this.diceRoller.damageRoll(weaponDamage);
        this.log(`  CRITICAL HIT! Rolled ${attackRoll}, hit AC ${target.ac}`);
      } else {
        this.log(
          `  Rolled ${attackRoll} + ${abilityMod + character.proficiencyBonus + attackBonus} = ${attackTotal}, hit AC ${target.ac}`
        );
      }

      this.log(`  Deals ${damage} ${damageType} damage to ${target.name}`);

      const killed = target.takeDamage(damage);

      if (killed) {
        this.log(`  ${target.name} is defeated!`);
      } else {
        this.log(`  ${target.name} has ${target.currentHP}/${target.maxHP} HP remaining`);
      }
    } else {
      this.log(
        `  Rolled ${attackRoll} + ${abilityMod + character.proficiencyBonus + attackBonus} = ${attackTotal}, missed AC ${target.ac}`
      );
    }
  }

  /**
   * Execute an enemy's turn
   */
  executeEnemyTurn(enemy) {
    this.log(`${enemy.name}'s turn:`);

    // Find living characters
    const livingChars = this.characters.filter(c => c && c.currentHP > 0);
    if (livingChars.length === 0) return;

    // Select target (lowest HP)
    const target = livingChars.reduce((lowest, char) => {
      return char.currentHP < lowest.currentHP ? char : lowest;
    });

    // Perform multiattack
    for (let i = 0; i < enemy.multiattack; i++) {
      if (target.currentHP <= 0) break; // Stop if target dies

      // Roll attack
      const attackResult = enemy.rollAttack(target, this.diceRoller);

      if (attackResult.hit) {
        // Roll damage
        const damageResult = enemy.rollDamage(
          attackResult.crit,
          this.diceRoller,
          i % enemy.attacks.length
        );

        if (attackResult.crit) {
          this.log(
            `  CRITICAL HIT! ${damageResult.attackName} - Rolled ${attackResult.roll}, hit AC ${target.armorClass}`
          );
        } else {
          this.log(
            `  ${damageResult.attackName} - Rolled ${attackResult.roll} + ${attackResult.modifier} = ${attackResult.total}, hit AC ${target.armorClass}`
          );
        }

        this.log(
          `  Deals ${damageResult.damage} ${damageResult.damageType} damage to ${target.name}`
        );

        const killed = target.takeDamage(damageResult.damage);

        if (killed) {
          this.log(`  ${target.name} is knocked unconscious!`);
        } else {
          this.log(`  ${target.name} has ${target.currentHP}/${target.maxHP} HP remaining`);
        }
      } else {
        this.log(
          `  ${enemy.attacks[i % enemy.attacks.length].name} - Rolled ${attackResult.roll} + ${attackResult.modifier} = ${attackResult.total}, missed AC ${target.armorClass}`
        );
      }
    }
  }

  /**
   * Attempt to flee from combat
   * @returns {boolean} True if flee succeeds
   */
  attemptFlee() {
    if (!this.canFlee) {
      this.log('Cannot flee from this combat!');
      return false;
    }

    this.fleeAttempted = true;
    this.log('=== FLEE ATTEMPT ===');

    // Each living character makes a DC check
    const livingChars = this.characters.filter(c => c && c.currentHP > 0);
    let successCount = 0;

    livingChars.forEach(char => {
      const dexMod = Math.floor((char.abilities.dexterity - 10) / 2);
      const roll = this.diceRoller.rollD20();
      const total = roll + dexMod;

      if (total >= this.fleeDC) {
        this.log(
          `${char.name} escapes! (Rolled ${roll} + ${dexMod} = ${total} vs DC ${this.fleeDC})`
        );
        successCount++;
      } else {
        this.log(
          `${char.name} fails to escape. (Rolled ${roll} + ${dexMod} = ${total} vs DC ${this.fleeDC})`
        );
      }
    });

    // Flee succeeds if at least half the party escapes
    const fleeSucceeds = successCount >= Math.ceil(livingChars.length / 2);

    if (fleeSucceeds) {
      this.log('The party manages to flee from combat!');
      this.log('');
      return true;
    } else {
      this.log('The party cannot escape! Combat continues...');
      this.log('');
      return false;
    }
  }

  /**
   * Check if characters have won
   */
  checkVictory() {
    const livingEnemies = this.enemies.filter(e => !e.checkIsDead());
    return livingEnemies.length === 0;
  }

  /**
   * Check if characters have lost
   */
  checkDefeat() {
    const livingChars = this.characters.filter(c => c && c.currentHP > 0);
    return livingChars.length === 0;
  }

  /**
   * Simulate full combat to completion
   * @param {boolean} autoFlee - Automatically flee if losing badly
   * @returns {object} Combat result { victory, fled, rounds, combatLog, characterStates, enemyStates }
   */
  simulateCombat(autoFlee = false) {
    this.log('=== COMBAT START ===');
    this.log(
      `Party: ${this.characters
        .filter(c => c && c.currentHP > 0)
        .map(c => c.name)
        .join(', ')}`
    );
    this.log(`Enemies: ${this.enemies.map(e => e.name).join(', ')}`);
    this.log('');

    // Roll initiative
    const turnOrder = this.rollInitiative();

    // Combat loop
    const maxRounds = 20; // Safety limit
    let victory = false;
    let fled = false;

    while (this.round < maxRounds) {
      const continuesCombat = this.simulateRound(turnOrder);

      if (!continuesCombat) {
        // Check why combat ended
        if (this.checkVictory()) {
          victory = true;
          this.log('=== VICTORY ===');
          this.log('All enemies defeated!');
        } else if (this.checkDefeat()) {
          victory = false;
          this.log('=== DEFEAT ===');
          this.log('Party wiped out!');
        }
        break;
      }

      // Auto-flee check if enabled
      if (autoFlee && this.canFlee && this.round >= 2) {
        const livingChars = this.characters.filter(c => c && c.currentHP > 0);
        const avgCharHP =
          livingChars.reduce((sum, c) => sum + c.currentHP / c.maxHP, 0) / livingChars.length;

        // Flee if party average HP below 30%
        if (avgCharHP < 0.3) {
          fled = this.attemptFlee();
          if (fled) {
            this.log('=== FLED ===');
            break;
          }
        }
      }
    }

    if (this.round >= maxRounds) {
      this.log('=== COMBAT TIMEOUT ===');
      this.log('Combat lasted too long, ending...');
    }

    this.log('');
    this.log('=== COMBAT END ===');

    // Calculate XP if victory
    let totalXP = 0;
    let xpPerCharacter = 0;

    if (victory) {
      // Sum XP from all defeated enemies
      totalXP = this.enemies.reduce((sum, enemy) => {
        return sum + getXPForCR(enemy.cr);
      }, 0);

      // Split XP among living party members
      const livingChars = this.characters.filter(c => c && c.currentHP > 0);
      if (livingChars.length > 0) {
        xpPerCharacter = Math.floor(totalXP / livingChars.length);
      }

      this.log(`Total XP Earned: ${totalXP}`);
      this.log(`XP per living party member: ${xpPerCharacter}`);
      this.log('');
    }

    // Return combat results
    return {
      victory,
      fled,
      rounds: this.round,
      combatLog: this.combatLog,
      totalXP,
      xpPerCharacter,
      characterStates: this.characters.map(c => ({
        name: c ? c.name : 'Unknown',
        currentHP: c ? c.currentHP : 0,
        maxHP: c ? c.maxHP : 0,
        alive: c ? c.currentHP > 0 : false,
      })),
      enemyStates: this.enemies.map(e => ({
        name: e.name,
        currentHP: e.currentHP,
        maxHP: e.maxHP,
        alive: !e.checkIsDead(),
      })),
    };
  }

  /**
   * Add log entry
   */
  log(message) {
    this.combatLog.push(message);
  }

  /**
   * Generate combat log as formatted string
   */
  generateCombatLog() {
    return this.combatLog.join('\n');
  }

  /**
   * Get combat summary for UI
   */
  getCombatSummary(result) {
    let summary = '';

    if (result.victory) {
      summary += 'VICTORY! All enemies defeated!\n\n';
    } else if (result.fled) {
      summary += 'FLED! The party escaped from combat.\n\n';
    } else {
      summary += 'DEFEAT! The party was wiped out.\n\n';
    }

    summary += `Combat lasted ${result.rounds} round${result.rounds !== 1 ? 's' : ''}.\n\n`;

    summary += '--- Party Status ---\n';
    result.characterStates.forEach(char => {
      const status = char.alive ? `${char.currentHP}/${char.maxHP} HP` : 'Unconscious';
      summary += `${char.name}: ${status}\n`;
    });

    if (result.victory) {
      summary += '\n--- Defeated Enemies ---\n';
      result.enemyStates.forEach(enemy => {
        summary += `${enemy.name}\n`;
      });

      if (result.totalXP > 0) {
        summary += `\n--- XP Reward ---\n`;
        summary += `Total XP: ${result.totalXP}\n`;
        summary += `XP per living member: ${result.xpPerCharacter}\n`;
      }
    }

    return summary;
  }

  // ============================================================
  // HEX-BASED TACTICAL COMBAT METHODS
  // ============================================================

  /**
   * Get combatant by ID from turn order
   * @param {string} id - Combatant ID
   * @returns {object|null} Combatant or null if not found
   */
  getCombatantById(id) {
    return this.turnOrder.find(c => c.id === id) || null;
  }

  /**
   * Process attack action for a combatant
   * @param {string} attackerId - ID of attacking combatant
   * @param {string} targetId - ID of target combatant
   * @returns {object} Result {success, hit, critical, damage, message}
   */
  processAttack(attackerId, targetId) {
    const attacker = this.getCombatantById(attackerId);
    const target = this.getCombatantById(targetId);

    if (!attacker || !target) {
      return {
        success: false,
        message: 'Invalid attacker or target',
        hit: false,
        critical: false,
        damage: 0,
      };
    }

    if (!attacker.position || !target.position) {
      return {
        success: false,
        message: 'Attacker or target has no position',
        hit: false,
        critical: false,
        damage: 0,
      };
    }

    // Get weapon range (default to melee range 1)
    // attacker.character is null for enemies — use .enemy fallback
    let weaponRange = 1;
    const attackerChar = attacker.character || attacker.enemy;

    if (attackerChar?.equipment && attackerChar.equipment.mainHand) {
      const weapon = attackerChar.equipment.mainHand;
      weaponRange = weapon.range || 1;
    } else if (attacker.enemy) {
      // Enemy — use their range property directly
      weaponRange = attacker.enemy.range || 1;
    }

    // Check range
    const distance = getHexDistance(
      attacker.position.col,
      attacker.position.row,
      target.position.col,
      target.position.row
    );

    if (distance > weaponRange) {
      return {
        success: false,
        message: `Target out of range (${distance} > ${weaponRange})`,
        hit: false,
        critical: false,
        damage: 0,
      };
    }

    // Check line of sight for ranged attacks
    if (weaponRange > 1) {
      const hasLoS = checkLineOfSight(attacker.position, target.position, this.battlefield);

      if (!hasLoS) {
        return {
          success: false,
          message: 'No line of sight to target',
          hit: false,
          critical: false,
          damage: 0,
        };
      }
    }

    // Execute attack using existing logic
    const attackResult = this._resolveAttack(attacker, target);

    if (attackResult.hit) {
      // Apply damage to target HP
      target.hp -= attackResult.damage;
      if (target.hp < 0) target.hp = 0;

      // Update underlying character/enemy object HP to keep in sync
      if (target.character) {
        target.character.currentHP = target.hp;
      } else if (target.enemy) {
        target.enemy.currentHP = target.hp;
      }
    }

    return {
      success: true,
      hit: attackResult.hit,
      critical: attackResult.critical,
      damage: attackResult.damage,
      message: attackResult.message,
    };
  }

  /**
   * Resolve attack between two combatants (internal helper)
   * @param {object} attacker - Attacking combatant
   * @param {object} target - Target combatant
   * @returns {object} Result {hit, critical, damage, message}
   */
  _resolveAttack(attacker, target) {
    // Support both hero combatants (attacker.character) and enemy combatants (attacker.enemy)
    const attackerChar = attacker.character || attacker.enemy;
    const targetChar = target.character || target.enemy;

    if (!attackerChar) {
      logger.combat.error('_resolveAttack: attacker has neither .character nor .enemy');
      return { hit: false, critical: false, damage: 0, message: 'Invalid attacker' };
    }
    if (!targetChar) {
      logger.combat.error('_resolveAttack: target has neither .character nor .enemy');
      return { hit: false, critical: false, damage: 0, message: 'Invalid target' };
    }

    // Get weapon info — heroes use equipment; enemies use their attacks[] / stats
    let weaponDamage = '1d6';
    let damageType = 'slashing';
    let attackBonus = 0;
    let damageBonus = 0;
    let weaponRange = 1;
    let weaponName = 'Melee Attack';

    if (attacker.character && attacker.character.equipment?.mainHand) {
      // Hero attacker — read from equipped weapon
      const weapon = attacker.character.equipment.mainHand;
      weaponDamage = weapon.damage || '1d6';
      damageType = weapon.damageType || 'slashing';
      weaponRange = weapon.range || 1;
      weaponName = weapon.name || (weaponRange > 1 ? 'Ranged Attack' : 'Melee Attack');
      if (weapon.effects) {
        attackBonus = weapon.effects.attackBonus || 0;
        damageBonus = weapon.effects.damageBonus || 0;
      }
    } else if (attacker.enemy) {
      // Enemy attacker — read from Enemy stat block
      const enemy = attacker.enemy;
      const primaryAttack = enemy.attacks?.[0];
      weaponDamage = primaryAttack?.damage || '1d6';
      damageType = primaryAttack?.damageType || 'slashing';
      weaponName = primaryAttack?.name || 'Attack';
      weaponRange = enemy.range || 1;
      attackBonus = enemy.attackBonus || 0;
      // Enemies roll straight attackBonus without extra modifiers through the DiceRoller path
      // We handle this below by passing attackBonus into the manual roll
    }

    // Determine attack type
    const attackType = weaponRange > 1 ? 'ranged' : 'melee';

    // Get target AC — Character uses .armorClass, Enemy uses .ac
    const targetAC = targetChar.armorClass ?? targetChar.ac ?? 10;

    // --- Determine roll type (normal / advantage / disadvantage) ---
    // Per D&D 5e rules, any number of advantage/disadvantage sources collapse to one pair;
    // if both advantage AND disadvantage apply, they cancel to normal.
    let hasAdvantage = false;
    let hasDisadvantage = false;

    // Attacker: Rage grants Advantage on STR melee attacks
    if (attacker.character) {
      const attackerRage = attacker.statusEffects?.find(
        e => e.name === 'Rage' && e.effects?.strengthAdvantage
      );
      if (attackerRage && attackType === 'melee') {
        hasAdvantage = true;
      }
    }

    // Defender: Dodge gives attackers disadvantage (existing mechanic, replacing the +2 AC hack)
    const targetDodging = target.statusEffects?.some(e => e.name === 'Dodge');
    if (targetDodging) {
      hasDisadvantage = true;
    }

    // Resolve to a single rollType (advantage + disadvantage cancel out)
    let rollType = 'normal';
    if (hasAdvantage && !hasDisadvantage) rollType = 'advantage';
    else if (hasDisadvantage && !hasAdvantage) rollType = 'disadvantage';

    // Both hero and enemy attackers now use the rollType system for Dodge disadvantage.
    // effectiveAC is always the raw AC — advantage/disadvantage is expressed via rollType.
    const effectiveAC = targetAC;

    let hit = false;
    let critical = false;
    let damage = 0;
    let message = '';

    if (attacker.character) {
      // Hero attacker — use DiceRoller.attackRoll() which auto-logs and uses character stats
      // Pass rollType so advantage/disadvantage is reflected in the roll and log
      const attackResult = this.diceRoller.attackRoll(
        attackerChar,
        attackType,
        targetAC, // use raw targetAC; disadvantage handled via rollType for hero attackers
        weaponName,
        rollType
      );
      hit = attackResult.hit;
      critical = attackResult.crit;

      if (hit) {
        const abilityMod =
          attackType === 'melee'
            ? Math.floor((attackerChar.abilities.strength - 10) / 2)
            : Math.floor((attackerChar.abilities.dexterity - 10) / 2);

        // Build the full dice string with modifier so the damage log shows e.g. "1d12+4"
        const totalMod = abilityMod + damageBonus;
        const fullDiceString =
          totalMod !== 0 ? `${weaponDamage}${totalMod > 0 ? '+' : ''}${totalMod}` : weaponDamage;

        if (critical) {
          // Roll both dice without individual logs, then emit one combined line.
          // e.g. "19 slashing damage (1d12+2=11 + 1d12=8 crit)"
          const baseDmg = this.diceRoller.damageRoll(fullDiceString);
          const critDmg = this.diceRoller.damageRoll(weaponDamage);
          damage = baseDmg + critDmg;
          if (this.diceRoller.logger) {
            this.diceRoller.log(
              `${damage} ${damageType} damage (${fullDiceString}=${baseDmg} + ${weaponDamage}=${critDmg} crit)`,
              'info'
            );
          }
        } else {
          damage = this.diceRoller.damageRoll(fullDiceString, damageType);
        }

        // --- Rage damage bonus (PHB'24): applies to STR-based melee and unarmed attacks ---
        const attackerRage = attacker.statusEffects?.find(e => e.name === 'Rage');
        if (attackerRage && attackType === 'melee') {
          const rageBonus = attackerRage.effects?.rageDamageBonus || 2;
          damage += rageBonus;
          // Mark rage as extended since an attack was made
          attackerRage.extendedThisTurn = true;
          logger.combat.debug('Rage damage bonus applied', {
            attacker: attackerChar.name,
            rageBonus,
            totalDamage: damage,
          });
        }

        // --- Rage resistance (PHB'24): target with Rage takes half BPS damage ---
        const targetRage = target.statusEffects?.find(
          e => e.name === 'Rage' && e.effects?.physicalResistance
        );
        const isPhysicalDamage = ['bludgeoning', 'piercing', 'slashing'].includes(damageType);
        if (targetRage && isPhysicalDamage) {
          damage = Math.floor(damage / 2);
          if (this.logger) {
            this.logger(
              `${targetChar.name} resists physical damage (Rage). Damage halved to ${damage}.`,
              'info'
            );
          }
        }

        message = `${damage} ${damageType} damage to ${targetChar.name}`;
      } else {
        message = `${attackerChar.name} misses ${targetChar.name}`;
      }
    } else {
      // Enemy attacker — manual roll using enemy.attackBonus (no DiceRoller character path)
      // Use rollType to apply Dodge disadvantage (and any future advantage sources) correctly.
      let roll: number;
      let rollText = '';
      if (rollType === 'disadvantage') {
        const result = this.diceRoller.rollWithDisadvantage();
        roll = result.roll;
        rollText = ` (disadvantage: ${result.kept}, ${result.dropped})`;
      } else if (rollType === 'advantage') {
        const result = this.diceRoller.rollWithAdvantage();
        roll = result.roll;
        rollText = ` (advantage: ${result.kept}, ${result.dropped})`;
      } else {
        roll = this.diceRoller.rollD20();
      }
      const total = roll + attackBonus;
      hit = roll === 20 || (roll !== 1 && total >= effectiveAC);
      critical = roll === 20;

      if (this.logger) {
        const hitStr = hit ? (critical ? 'CRITICAL HIT!' : 'Hit') : 'Miss';
        this.logger(
          `${weaponName}${rollText} ${roll}+${attackBonus}=${total} vs AC ${effectiveAC}: ${hitStr}`,
          'encounter'
        );
      }

      if (hit) {
        const baseDamage = this.diceRoller.damageRoll(weaponDamage, damageType);
        damage = baseDamage;
        if (critical) {
          damage += this.diceRoller.damageRoll(weaponDamage, damageType);
        }

        // --- Rage resistance (PHB'24): target with Rage takes half BPS damage ---
        const targetRage = target.statusEffects?.find(
          e => e.name === 'Rage' && e.effects?.physicalResistance
        );
        const isPhysicalDamage = ['bludgeoning', 'piercing', 'slashing'].includes(damageType);
        if (targetRage && isPhysicalDamage) {
          damage = Math.floor(damage / 2);
          if (this.logger) {
            this.logger(
              `${targetChar.name} resists physical damage (Rage). Damage halved to ${damage}.`,
              'info'
            );
          }
        }

        message = `${damage} ${damageType} damage to ${targetChar.name}`;
      } else {
        message = `${attackerChar.name} misses ${targetChar.name}`;
      }
    }

    return {
      hit,
      critical,
      damage,
      message,
    };
  }

  /**
   * Process ability action for a combatant
   * @param {string} combatantId - ID of combatant using ability
   * @param {string} abilityName - Name of ability to use
   * @param {string} targetId - ID of target (optional for some abilities)
   * @returns {object} Result from AbilityEffects
   */
  processAbility(combatantId, abilityName, targetId = null) {
    const combatant = this.getCombatantById(combatantId);

    if (!combatant) {
      return {
        success: false,
        message: 'Combatant not found',
      };
    }

    const target = targetId ? this.getCombatantById(targetId) : null;

    // Check if combatant has the ability
    const ability = combatant.character.abilities_list?.find(a => a.name === abilityName);

    if (!ability) {
      return {
        success: false,
        message: `${combatant.character.name} does not have ability: ${abilityName}`,
      };
    }

    // Check uses remaining (maxUses === -1 means unlimited)
    if (ability.maxUses !== -1 && ability.uses !== undefined && ability.uses <= 0) {
      return {
        success: false,
        message: `No uses remaining for ${abilityName}`,
      };
    }

    // Execute ability
    const result = AbilityEffects.execute(abilityName, combatant, target, this);

    // Decrement uses on the live ability object so the Redux sync below picks it up
    if (result.success && ability.maxUses !== -1 && ability.uses !== undefined) {
      ability.uses = Math.max(0, ability.uses - 1);
    }

    return result;
  }

  /**
   * Process spell casting for a combatant
   * @param {string} combatantId - ID of caster
   * @param {string} spellName - Name of spell to cast
   * @param {string} targetId - ID of target (optional for some spells)
   * @param {number} spellLevel - Level to cast spell at
   * @returns {object} Result from spell cast
   */
  processSpell(combatantId, spellName, targetId = null, spellLevel = 1) {
    const caster = this.getCombatantById(combatantId);

    if (!caster) {
      return {
        success: false,
        message: 'Caster not found',
      };
    }

    const target = targetId ? this.getCombatantById(targetId) : null;

    // Get spell - need to check caster's class
    const className = caster.character.class || caster.character.className;
    const spell = getSpell(className, spellName);

    if (!spell) {
      return {
        success: false,
        message: `Spell not found: ${spellName}`,
      };
    }

    // Check if caster has spell slots (unless it's a cantrip)
    const isCantrip = spell.level === 0;

    if (!isCantrip) {
      const hasSlot = hasSpellSlot(caster.character, spellLevel);

      if (!hasSlot) {
        return {
          success: false,
          message: `No level ${spellLevel} spell slots remaining`,
        };
      }
    }

    // Cast spell
    const result = spell.cast(caster.character, target?.character || null, this.diceRoller);

    // Use spell slot if not a cantrip and cast was successful
    if (result.success && !isCantrip) {
      useSpellSlot(caster.character, spellLevel);
    }

    return result;
  }

  /**
   * Process dodge action for a combatant
   * @param {string} combatantId - ID of combatant taking dodge action
   * @returns {object} Result {success, message}
   */
  processDodge(combatantId) {
    const combatant = this.getCombatantById(combatantId);

    if (!combatant) {
      return {
        success: false,
        message: 'Combatant not found',
      };
    }

    this.addStatusEffect(combatant, {
      name: 'Dodge',
      duration: 1, // Lasts until end of next turn
      description: 'Attacks against you have disadvantage',
    });

    return {
      success: true,
      message: `${combatant.character.name} takes the Dodge action. Attacks against them have disadvantage until their next turn.`,
    };
  }

  /**
   * Process dash action for a combatant
   * @param {string} combatantId - ID of combatant taking dash action
   * @returns {object} Result {success, message}
   */
  processDash(combatantId) {
    const combatant = this.getCombatantById(combatantId);

    if (!combatant) {
      return {
        success: false,
        message: 'Combatant not found',
      };
    }

    return {
      success: true,
      message: `${combatant.character.name} takes the Dash action (movement doubled)`,
    };
  }

  /**
   * Calculate XP reward from defeated enemies
   * @returns {number} Total XP earned
   */
  _calculateXP() {
    return this.enemies.reduce((sum, enemy) => {
      return sum + getXPForCR(enemy.cr);
    }, 0);
  }

  /**
   * Tick Rage at the START of the raging combatant's turn (PHB'24).
   * Rage lasts until end of the rager's next turn. Each turn we check whether
   * an extension criteria was met the previous turn; if not, Rage ends.
   * Also enforces the 10-round maximum duration.
   *
   * @param {object} combatant - Combatant whose Rage to tick (turnOrder entry)
   */
  tickRage(combatant) {
    if (!combatant.statusEffects) return;

    const rageEffect = combatant.statusEffects.find(e => e.name === 'Rage');
    if (!rageEffect) return;

    const name = combatant.character?.name || combatant.name || 'Combatant';

    // Increment total rounds active
    rageEffect.roundsActive = (rageEffect.roundsActive || 0) + 1;

    // Hard cap: 10 rounds maximum (10 minutes)
    if (rageEffect.roundsActive > rageEffect.maxDuration) {
      combatant.statusEffects = combatant.statusEffects.filter(e => e.name !== 'Rage');
      if (this.logger) {
        this.logger(`${name}'s Rage ends — 10-round limit reached.`, 'info');
      }
      logger.combat.info('Rage ended: max duration reached', { name });
      return;
    }

    // First turn of Rage: extendedThisTurn starts false but we give it the turn to prove itself
    if (rageEffect.roundsActive === 1) {
      // First real turn — Rage just started, no extension check yet
      rageEffect.extendedThisTurn = false;
      return;
    }

    // Subsequent turns: check if extension criteria were met on the previous turn
    if (rageEffect.extendedThisTurn) {
      // Extension met — reset flag and let Rage continue
      rageEffect.extendedThisTurn = false;
      logger.combat.debug('Rage extended', { name, roundsActive: rageEffect.roundsActive });
    } else {
      // No qualifying action last turn — Rage ends
      combatant.statusEffects = combatant.statusEffects.filter(e => e.name !== 'Rage');
      if (this.logger) {
        this.logger(`${name}'s Rage fades — no qualifying action last turn.`, 'info');
      }
      logger.combat.info('Rage ended: no extension', { name });
    }
  }

  /**
   * Determine the roll type (advantage/disadvantage/normal) for an ability check or saving throw,
   * accounting for active status effects like Rage (STR advantage).
   *
   * @param {object} combatant - The combatant making the check
   * @param {string} ability - The ability being checked ('strength', 'dexterity', etc.)
   * @returns {'advantage'|'disadvantage'|'normal'}
   */
  getRollTypeForAbilityCheck(combatant, ability) {
    let hasAdvantage = false;
    let hasDisadvantage = false;

    // Rage: Advantage on STR checks and STR saving throws
    const rage = combatant.statusEffects?.find(
      e => e.name === 'Rage' && e.effects?.strengthAdvantage
    );
    if (rage && ability === 'strength') {
      hasAdvantage = true;
    }

    // Dodge: Advantage on DEX saving throws (PHB — Dodge also grants Dex save advantage)
    const dodge = combatant.statusEffects?.find(e => e.name === 'Dodge');
    if (dodge && ability === 'dexterity') {
      hasAdvantage = true;
    }

    // Advantage and disadvantage cancel each other out (PHB rule)
    if (hasAdvantage && hasDisadvantage) return 'normal';
    if (hasAdvantage) return 'advantage';
    if (hasDisadvantage) return 'disadvantage';
    return 'normal';
  }

  /**
   * Add status effect to combatant
   * @param {object} combatant - Combatant to add effect to
   * @param {object} effect - Effect object {name, duration, description}
   */
  addStatusEffect(combatant, effect) {
    if (!combatant.statusEffects) {
      combatant.statusEffects = [];
    }
    combatant.statusEffects.push(effect);
  }

  /**
   * Remove status effect from combatant
   * @param {object} combatant - Combatant to remove effect from
   * @param {string} effectName - Name of effect to remove
   */
  removeStatusEffect(combatant, effectName) {
    if (!combatant.statusEffects) return;
    combatant.statusEffects = combatant.statusEffects.filter(e => e.name !== effectName);
  }

  /**
   * Tick status effects (decrease duration, remove expired effects)
   * @param {object} combatant - Combatant whose effects to tick
   */
  tickStatusEffects(combatant) {
    if (!combatant.statusEffects) return;

    combatant.statusEffects.forEach(effect => {
      if (effect.duration !== undefined) {
        effect.duration--;
      }
    });

    combatant.statusEffects = combatant.statusEffects.filter(
      e => e.duration === undefined || e.duration > 0
    );
  }
}

export default Combat;
