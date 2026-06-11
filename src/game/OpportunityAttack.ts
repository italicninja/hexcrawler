// Implements the Opportunity Attack system for D&D 5e combat
import { getHexDistance } from '../utils/hexMath';
import logger from '../utils/logger';

interface HexPos {
  col: number;
  row: number;
}

interface Combatant {
  name?: string;
  currentHP: number;
  reactionUsed?: boolean;
  isAlly?: boolean;
  isEnemy?: boolean;
  conditions?: Array<{ type: string }>;
  position: HexPos;
  [key: string]: unknown;
}

interface OpportunityAttackPrompt {
  type: 'opportunityAttack';
  attacker: Combatant;
  target: Combatant;
  onConfirm: () => void;
  onDecline: () => void;
}

export class OpportunityAttackSystem {
  /**
   * Checks which combatants can make opportunity attacks against a moving combatant.
   * Returns the combatants that can make opportunity attacks.
   */
  static checkOpportunityAttacks(
    movingCombatant: Combatant,
    fromHex: HexPos,
    toHex: HexPos,
    allCombatants: Combatant[]
  ): Combatant[] {
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
      const distanceFrom = getHexDistance(
        combatant.position.col,
        combatant.position.row,
        fromHex.col,
        fromHex.row
      );
      const distanceTo = getHexDistance(
        combatant.position.col,
        combatant.position.row,
        toHex.col,
        toHex.row
      );

      // Trigger if was in reach (1 hex) and is now leaving reach
      if (distanceFrom <= 1 && distanceTo > 1) {
        logger.combat.debug('Opportunity attack available', {
          attacker: combatant.name,
          target: movingCombatant.name,
        });
        attackers.push(combatant);
      }
    }

    return attackers;
  }

  /**
   * Creates a prompt for an opportunity attack or auto-confirms for AI.
   * Returns a prompt object for the UI, or null if auto-confirmed.
   */
  static promptOpportunityAttack(
    attacker: Combatant,
    target: Combatant,
    onConfirm: () => void,
    onDecline: () => void
  ): OpportunityAttackPrompt | null {
    // AI auto-confirms
    if (attacker.isEnemy) {
      logger.combat.info('AI auto-confirms opportunity attack', {
        attacker: attacker.name,
        target: target.name,
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
      onDecline: onDecline,
    };
  }
}

export default OpportunityAttackSystem;
