import { getHexDistance } from '../utils/hexMath.js';
import logger from '../utils/logger.js';

/**
 * Implements the Opportunity Attack system for D&D 5e combat
 */
export class OpportunityAttackSystem {
  /**
   * Checks which combatants can make opportunity attacks against a moving combatant
   * @param {Object} movingCombatant - The combatant that is moving
   * @param {Object} fromHex - The hex the combatant is moving from {col, row}
   * @param {Object} toHex - The hex the combatant is moving to {col, row}
   * @param {Array} allCombatants - All combatants in the combat
   * @returns {Array} Array of combatants that can make opportunity attacks
   */
  static checkOpportunityAttacks(movingCombatant, fromHex, toHex, allCombatants) {
    // Skip if combatant has Disengaged
    const conditions = movingCombatant.conditions || [];
    if (conditions.some(c => c.type === 'Disengaged')) {
      logger.combat.debug('Opportunity attack skipped: combatant has Disengaged condition');
      return [];
    }

    const attackers = [];

    for (const combatant of allCombatants) {
      // Skip self
      if (combatant === movingCombatant) {
        continue;
      }

      // Skip if dead
      if (combatant.currentHP <= 0) {
        continue;
      }

      // Skip if already used reaction
      if (combatant.reactionUsed === true) {
        continue;
      }

      // Skip if same team
      if (combatant.isAlly === movingCombatant.isAlly) {
        continue;
      }

      // Check if target was in melee reach and is now leaving
      const distanceFrom = getHexDistance(combatant.position.col, combatant.position.row, fromHex.col, fromHex.row);
      const distanceTo = getHexDistance(combatant.position.col, combatant.position.row, toHex.col, toHex.row);

      // Trigger if was in reach (1 hex) and is now leaving reach
      if (distanceFrom <= 1 && distanceTo > 1) {
        logger.combat.debug('Opportunity attack available', { 
          attacker: combatant.name, 
          target: movingCombatant.name 
        });
        attackers.push(combatant);
      }
    }

    return attackers;
  }

  /**
   * Creates a prompt for an opportunity attack or auto-confirms for AI
   * @param {Object} attacker - The combatant making the opportunity attack
   * @param {Object} target - The combatant being attacked
   * @param {Function} onConfirm - Callback when attack is confirmed
   * @param {Function} onDecline - Callback when attack is declined
   * @returns {Object|null} Prompt object for UI, or null if auto-confirmed
   */
  static promptOpportunityAttack(attacker, target, onConfirm, onDecline) {
    // AI auto-confirms
    if (attacker.isEnemy) {
      logger.combat.info('AI auto-confirms opportunity attack', { 
        attacker: attacker.name, 
        target: target.name 
      });
      onConfirm();
      return null;
    }

    // Return prompt object for player
    return {
      type: 'opportunityAttack',
      attacker: attacker,
      target: target,
      onConfirm: onConfirm,
      onDecline: onDecline
    };
  }
}

export default OpportunityAttackSystem;
