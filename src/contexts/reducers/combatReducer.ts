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

import { Combat } from '../../game/Combat';
import { CombatTerrainGenerator } from '../../game/CombatTerrainGenerator';
import { EncounterPositions } from '../../game/EncounterPositions';
import { COMBAT } from '../../constants/gameConstants';

export function combatReducer(state, action, ACTIONS) {
  switch (action.type) {
    case ACTIONS.START_COMBAT: {
      // Legacy combat log support (keep for backward compatibility)
      if (action.payload.combatLog) {
        return {
          ...state,
          combatLog: action.payload.combatLog
        };
      }
      
      // New tactical combat system
      const { allies, enemies, encounterName, encounterType, terrainType } = action.payload;
      
      if (!allies || !enemies) {
        console.error('START_COMBAT requires allies and enemies');
        return state;
      }
      
      // Generate battlefield
      const battlefield = CombatTerrainGenerator.generate(encounterType, terrainType, state.mapSeed);
      
      // Create combat instance
      const combat = new Combat(allies, enemies, battlefield);
      
      // Roll initiative
      const initiativeOrder = combat.rollInitiative();
      
      // Transform initiative order into combat-ready format
      // rollInitiative() returns { type, combatant, initiative, roll }
      // We need { id, name, currentHP, maxHP, isAlly, character/enemy, position }
      const turnOrder = initiativeOrder.map((init, index) => {
        const isAlly = init.type === 'character';
        const combatant = init.combatant;
        
        return {
          id: isAlly ? `ally-${index}` : `enemy-${index}`,
          name: combatant.name,
          currentHP: combatant.currentHP,
          maxHP: combatant.maxHP,
          isAlly: isAlly,
          isEnemy: !isAlly,
          character: isAlly ? combatant : null,
          enemy: !isAlly ? combatant : null,
          characterClass: combatant.class || combatant.type || 'Fighter',
          initiative: init.initiative,
          position: null, // Will be set by EncounterPositions
          statusEffects: []
        };
      });
      
      // Place combatants on battlefield
      const alliesToPlace = turnOrder.filter(c => c.isAlly);
      const enemiesToPlace = turnOrder.filter(c => c.isEnemy);
      
      const { allies: placedAllies, enemies: placedEnemies } = EncounterPositions.placeForEncounter(
        encounterType,
        alliesToPlace,
        enemiesToPlace,
        battlefield
      );
      
      // Merge positions back into turnOrder
      const updatedTurnOrder = turnOrder.map(combatant => {
        const placed = combatant.isAlly 
          ? placedAllies.find(a => a.id === combatant.id)
          : placedEnemies.find(e => e.id === combatant.id);
        
        if (!placed || !placed.position) {
          console.error('Failed to place combatant:', combatant.name);
          return { ...combatant, position: { col: 0, row: 0 } }; // Fallback position
        }
        
        return { ...combatant, position: placed.position };
      });
      
      // Update combat instance with positioned combatants
      combat.turnOrder = updatedTurnOrder;
      combat.allies = updatedTurnOrder.filter(c => !c.isEnemy);
      combat.enemies = updatedTurnOrder.filter(c => c.isEnemy);
      
      // Get first combatant's movement distance
      const firstCombatant = updatedTurnOrder[0];
      const moveDistance = firstCombatant?.character?.moveDistance || 6;
      
      return {
        ...state,
        combatState: {
          active: true,
          combat,
          battlefield,
          turnOrder: updatedTurnOrder,
          currentTurnIndex: 0,
          round: 1,
          encounterName: encounterName || 'Combat',
          encounterType: encounterType || 'standard',
          waitingForPlayerAction: !firstCombatant?.isEnemy,
          movementRemaining: moveDistance * 5 // Convert hexes to feet
        },
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
