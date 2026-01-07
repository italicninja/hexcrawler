/**
 * Combat - D&D 5e Combat Simulation System
 * Handles auto-resolved combat with full dice rolls and combat logs
 */

import { DiceRoller } from './DiceRoller.js';
import { Enemy } from './Enemy.js';

/**
 * D&D 5e CR to XP Conversion Table
 * Maps Challenge Rating to Experience Points awarded
 */
export const CR_TO_XP = {
  0: 10,
  0.125: 25,    // CR 1/8
  0.25: 50,     // CR 1/4
  0.5: 100,     // CR 1/2
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
  30: 155000
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
  constructor(characters, enemies, options = {}) {
    this.characters = characters; // Array of Character instances (party members)
    this.enemies = enemies; // Array of Enemy instances
    this.diceRoller = new DiceRoller();
    this.combatLog = [];
    this.round = 0;
    this.canFlee = options.canFlee !== false; // Default true
    this.fleeAttempted = false;
    this.fleeDC = 10 + Math.floor(this.getAverageCR() / 2); // Higher CR = harder to flee
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
    this.characters.forEach((char) => {
      if (char && char.currentHP > 0) {
        const dexMod = Math.floor((char.abilities.dexterity - 10) / 2);
        const roll = this.diceRoller.rollD20();
        const total = roll + dexMod;

        initiatives.push({
          type: 'character',
          combatant: char,
          initiative: total,
          roll: roll
        });
      }
    });

    // Roll for enemies
    this.enemies.forEach((enemy) => {
      if (!enemy.checkIsDead()) {
        const dexMod = Math.floor((enemy.abilities.dexterity - 10) / 2);
        const roll = this.diceRoller.rollD20();
        const total = roll + dexMod;

        initiatives.push({
          type: 'enemy',
          combatant: enemy,
          initiative: total,
          roll: roll
        });
      }
    });

    // Sort by initiative (highest first)
    initiatives.sort((a, b) => b.initiative - a.initiative);

    // Log initiative
    this.log('=== INITIATIVE ===');
    initiatives.forEach((init) => {
      const name = init.combatant.name;
      this.log(`${name}: ${init.initiative} (rolled ${init.roll})`);
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
    const livingEnemies = this.enemies.filter((e) => !e.checkIsDead());
    if (livingEnemies.length === 0) return;

    // Select random target
    const target = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];

    // Determine attack type based on character abilities
    const attackType = character.abilities.dexterity > character.abilities.strength ? 'ranged' : 'melee';

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
    const abilityMod = attackType === 'melee'
      ? Math.floor((character.abilities.strength - 10) / 2)
      : Math.floor((character.abilities.dexterity - 10) / 2);

    const attackRoll = this.diceRoller.rollD20();
    const attackTotal = attackRoll + abilityMod + character.proficiencyBonus + attackBonus;

    const hit = attackRoll === 20 || (attackRoll !== 1 && attackTotal >= target.ac);
    const crit = attackRoll === 20;

    if (hit) {
      // Roll damage
      let damage = this.diceRoller.damageRoll(weaponDamage) + abilityMod + damageBonus;

      // Double damage on crit
      if (crit) {
        damage += this.diceRoller.damageRoll(weaponDamage);
        this.log(`  CRITICAL HIT! Rolled ${attackRoll}, hit AC ${target.ac}`);
      } else {
        this.log(`  Rolled ${attackRoll} + ${abilityMod + character.proficiencyBonus + attackBonus} = ${attackTotal}, hit AC ${target.ac}`);
      }

      this.log(`  Deals ${damage} ${damageType} damage to ${target.name}`);

      const killed = target.takeDamage(damage);

      if (killed) {
        this.log(`  ${target.name} is defeated!`);
      } else {
        this.log(`  ${target.name} has ${target.currentHP}/${target.maxHP} HP remaining`);
      }
    } else {
      this.log(`  Rolled ${attackRoll} + ${abilityMod + character.proficiencyBonus + attackBonus} = ${attackTotal}, missed AC ${target.ac}`);
    }
  }

  /**
   * Execute an enemy's turn
   */
  executeEnemyTurn(enemy) {
    this.log(`${enemy.name}'s turn:`);

    // Find living characters
    const livingChars = this.characters.filter((c) => c && c.currentHP > 0);
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
        const damageResult = enemy.rollDamage(attackResult.crit, this.diceRoller, i % enemy.attacks.length);

        if (attackResult.crit) {
          this.log(`  CRITICAL HIT! ${damageResult.attackName} - Rolled ${attackResult.roll}, hit AC ${target.armorClass}`);
        } else {
          this.log(`  ${damageResult.attackName} - Rolled ${attackResult.roll} + ${attackResult.modifier} = ${attackResult.total}, hit AC ${target.armorClass}`);
        }

        this.log(`  Deals ${damageResult.damage} ${damageResult.damageType} damage to ${target.name}`);

        const killed = target.takeDamage(damageResult.damage);

        if (killed) {
          this.log(`  ${target.name} is knocked unconscious!`);
        } else {
          this.log(`  ${target.name} has ${target.currentHP}/${target.maxHP} HP remaining`);
        }
      } else {
        this.log(`  ${enemy.attacks[i % enemy.attacks.length].name} - Rolled ${attackResult.roll} + ${attackResult.modifier} = ${attackResult.total}, missed AC ${target.armorClass}`);
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
    const livingChars = this.characters.filter((c) => c && c.currentHP > 0);
    let successCount = 0;

    livingChars.forEach((char) => {
      const dexMod = Math.floor((char.abilities.dexterity - 10) / 2);
      const roll = this.diceRoller.rollD20();
      const total = roll + dexMod;

      if (total >= this.fleeDC) {
        this.log(`${char.name} escapes! (Rolled ${roll} + ${dexMod} = ${total} vs DC ${this.fleeDC})`);
        successCount++;
      } else {
        this.log(`${char.name} fails to escape. (Rolled ${roll} + ${dexMod} = ${total} vs DC ${this.fleeDC})`);
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
    const livingEnemies = this.enemies.filter((e) => !e.checkIsDead());
    return livingEnemies.length === 0;
  }

  /**
   * Check if characters have lost
   */
  checkDefeat() {
    const livingChars = this.characters.filter((c) => c && c.currentHP > 0);
    return livingChars.length === 0;
  }

  /**
   * Simulate full combat to completion
   * @param {boolean} autoFlee - Automatically flee if losing badly
   * @returns {object} Combat result { victory, fled, rounds, combatLog, characterStates, enemyStates }
   */
  simulateCombat(autoFlee = false) {
    this.log('=== COMBAT START ===');
    this.log(`Party: ${this.characters.filter(c => c && c.currentHP > 0).map(c => c.name).join(', ')}`);
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
        const livingChars = this.characters.filter((c) => c && c.currentHP > 0);
        const avgCharHP = livingChars.reduce((sum, c) => sum + (c.currentHP / c.maxHP), 0) / livingChars.length;

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
      const livingChars = this.characters.filter((c) => c && c.currentHP > 0);
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
      characterStates: this.characters.map((c) => ({
        name: c ? c.name : 'Unknown',
        currentHP: c ? c.currentHP : 0,
        maxHP: c ? c.maxHP : 0,
        alive: c ? c.currentHP > 0 : false
      })),
      enemyStates: this.enemies.map((e) => ({
        name: e.name,
        currentHP: e.currentHP,
        maxHP: e.maxHP,
        alive: !e.checkIsDead()
      }))
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
    result.characterStates.forEach((char) => {
      const status = char.alive ? `${char.currentHP}/${char.maxHP} HP` : 'Unconscious';
      summary += `${char.name}: ${status}\n`;
    });

    if (result.victory) {
      summary += '\n--- Defeated Enemies ---\n';
      result.enemyStates.forEach((enemy) => {
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
}

export default Combat;
