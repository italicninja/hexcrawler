/**
 * Exploration Reducer - Handles interior/dungeon exploration
 * 
 * Actions handled:
 * - SET_ACTIVE_EVENT
 * - SEARCH_POI
 * - SET_INTERIOR_MAP
 * - SET_INTERIOR_PLAYER_POSITION
 * - ENTER_EXPLORATION
 * - EXIT_EXPLORATION
 * - DEFEAT_ENCOUNTER
 * - COLLECT_LOOT
 * - TRIGGER_HAZARD
 * - ENTER_TOWN
 * - EXIT_TOWN
 */

export function explorationReducer(state, action, ACTIONS) {
  switch (action.type) {
    case ACTIONS.SET_ACTIVE_EVENT:
      return {
        ...state,
        activeEvent: action.payload
      };

    case ACTIONS.SEARCH_POI: {
      const { col, row, discovered } = action.payload;
      
      return {
        ...state,
        discoveredPOIs: new Set([...state.discoveredPOIs, `${col},${row}`])
      };
    }

    case ACTIONS.SET_INTERIOR_MAP: {
      const { interiorMap } = action.payload;
      
      return {
        ...state,
        interiorMap
      };
    }

    case ACTIONS.SET_INTERIOR_PLAYER_POSITION: {
      return {
        ...state,
        interiorPlayerPosition: action.payload
      };
    }

    case ACTIONS.ENTER_EXPLORATION: {
      const { poi, interiorMap, startPosition } = action.payload;
      
      return {
        ...state,
        inInterior: true,
        currentPOI: poi,
        interiorMap,
        interiorPlayerPosition: startPosition,
        currentScene: 'exploration'
      };
    }

    case ACTIONS.EXIT_EXPLORATION:
      return {
        ...state,
        inInterior: false,
        currentPOI: null,
        interiorMap: null,
        interiorPlayerPosition: null,
        currentScene: 'overworld'
      };

    case ACTIONS.DEFEAT_ENCOUNTER: {
      const { encounterId, loot, xp } = action.payload;
      
      let newState = { ...state };
      
      // Mark encounter as defeated
      if (state.interiorMap?.encounters) {
        const encounter = state.interiorMap.encounters.find(e => e.id === encounterId);
        if (encounter) {
          encounter.defeated = true;
        }
        newState.interiorMap = state.interiorMap;
      }
      
      // Award XP
      if (xp && state.playerCharacter) {
        state.playerCharacter.gainXP(xp);
        newState.playerCharacter = state.playerCharacter;
      }
      
      // Add loot to pending collection
      if (loot) {
        newState.pendingLoot = loot;
      }
      
      return newState;
    }

    case ACTIONS.COLLECT_LOOT: {
      const { items, gold } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      // Add items to inventory
      if (items) {
        state.playerCharacter.inventory.push(...items);
      }
      
      // Add gold
      if (gold) {
        state.playerCharacter.gold += gold;
      }
      
      return {
        ...state,
        playerCharacter: state.playerCharacter,
        pendingLoot: null
      };
    }

    case ACTIONS.TRIGGER_HAZARD: {
      const { hazard, damage } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      // Apply damage
      if (damage) {
        state.playerCharacter.currentHP = Math.max(0, state.playerCharacter.currentHP - damage);
      }
      
      return {
        ...state,
        playerCharacter: state.playerCharacter
      };
    }

    case ACTIONS.ENTER_TOWN: {
      const { poi } = action.payload;
      
      return {
        ...state,
        inTown: true,
        currentPOI: poi
      };
    }

    case ACTIONS.EXIT_TOWN:
      return {
        ...state,
        inTown: false,
        currentPOI: null,
        currentShop: null
      };

    default:
      return null; // Action not handled by this reducer
  }
}
