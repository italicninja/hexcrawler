/**
 * Combat Reducer - Handles combat state, turns, and combat actions
 * 
 * Actions handled:
 * - START_COMBAT
 * - RESOLVE_COMBAT
 * - PROCESS_COMBAT_MOVEMENT
 * - PROCESS_COMBAT_ACTION
 * - ADVANCE_COMBAT_TURN
 * - END_COMBAT
 * - UPDATE_COMBAT_STATE
 */

import { Combat } from '../../game/Combat.js';
import { CombatTerrainGenerator } from '../../game/CombatTerrainGenerator.js';
import { EncounterPositions } from '../../game/EncounterPositions.js';
import { COMBAT } from '../../constants/gameConstants.js';

export function combatReducer(state, action, ACTIONS) {
  switch (action.type) {
    case ACTIONS.START_COMBAT: {
      const { poi, enemies } = action.payload;
      
      // Create combat instance
      const combat = new Combat(
        state.playerCharacter,
        state.party,
        enemies,
        poi
      );

      // Generate battlefield terrain
      const terrainGen = new CombatTerrainGenerator();
      const battlefield = terrainGen.generate(
        COMBAT.BATTLEFIELD_WIDTH,
        COMBAT.BATTLEFIELD_HEIGHT,
        poi.terrainType || 'grassland'
      );

      // Position combatants
      const positionManager = new EncounterPositions();
      const combatants = combat.getCombatants();
      const positioned = positionManager.positionCombatants(combatants, battlefield);

      // Roll initiative
      combat.rollInitiative();

      return {
        ...state,
        inCombat: true,
        combat,
        battlefield,
        combatPositions: positioned,
        currentScene: 'combat'
      };
    }

    case ACTIONS.RESOLVE_COMBAT: {
      const { victory } = action.payload;
      
      if (!state.combat) return state;

      let updates = { ...state };

      if (victory) {
        // Award XP
        const xp = state.combat.calculateXPReward();
        if (state.playerCharacter) {
          state.playerCharacter.gainXP(xp);
        }
      }

      return updates;
    }

    case ACTIONS.PROCESS_COMBAT_MOVEMENT: {
      const { combatantId, targetHex } = action.payload;
      
      if (!state.combat) return state;

      // Update combatant position
      const newPositions = new Map(state.combatPositions);
      newPositions.set(combatantId, targetHex);

      return {
        ...state,
        combatPositions: newPositions
      };
    }

    case ACTIONS.PROCESS_COMBAT_ACTION: {
      const { actionType, actorId, targetId, result } = action.payload;
      
      // Combat action processing happens in CombatScene
      // This just updates state if needed
      
      return state;
    }

    case ACTIONS.ADVANCE_COMBAT_TURN: {
      if (!state.combat) return state;

      state.combat.nextTurn();

      return {
        ...state,
        combat: state.combat // Trigger re-render
      };
    }

    case ACTIONS.END_COMBAT: {
      const { victory, fled } = action.payload;

      return {
        ...state,
        inCombat: false,
        combat: null,
        battlefield: null,
        combatPositions: null,
        currentScene: state.inInterior ? 'exploration' : 'overworld'
      };
    }

    case ACTIONS.UPDATE_COMBAT_STATE: {
      return {
        ...state,
        ...action.payload
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
