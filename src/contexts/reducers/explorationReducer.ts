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
 * - DISCOVER_ENCOUNTER
 * - DISCOVER_HAZARD
 * - DISCOVER_LOOT
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
      const { key, map } = action.payload;
      
      return {
        ...state,
        interiorMaps: {
          ...state.interiorMaps,
          [key]: map
        }
      };
    }

    case ACTIONS.SET_INTERIOR_PLAYER_POSITION: {
      return {
        ...state,
        interiorPlayerPosition: action.payload
      };
    }

    case ACTIONS.ENTER_EXPLORATION: {
      const { col, row, poi } = action.payload;

      // Get interior map to set player position
      const poiKey = `${col},${row}`;
      const interiorMap = state.interiorMaps[poiKey];
      const entrancePos = interiorMap?.entrance || { col: 0, row: 0 };

      return {
        ...state,
        inInterior: true,
        currentPOI: { col, row, poi },
        interiorPlayerPosition: entrancePos
      };
    }

    case ACTIONS.EXIT_EXPLORATION:
      return {
        ...state,
        inInterior: false,
        currentPOI: null,
        interiorPlayerPosition: null
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

    case ACTIONS.DISCOVER_ENCOUNTER: {
      const { poiKey, encounterKey } = action.payload;
      const interiorMap = state.interiorMaps[poiKey];
      if (!interiorMap) return state;

      const updatedEncounters = interiorMap.encounters.map(e => {
        if (`${e.col},${e.row}` === encounterKey) {
          return { ...e, discovered: true };
        }
        return e;
      });

      return {
        ...state,
        interiorMaps: {
          ...state.interiorMaps,
          [poiKey]: {
            ...interiorMap,
            encounters: updatedEncounters
          }
        }
      };
    }

    case ACTIONS.DISCOVER_HAZARD: {
      const { poiKey, hazardKey } = action.payload;
      const interiorMap = state.interiorMaps[poiKey];
      if (!interiorMap) return state;

      const updatedHazards = interiorMap.hazards.map(h => {
        if (`${h.col},${h.row}` === hazardKey) {
          return { ...h, discovered: true };
        }
        return h;
      });

      return {
        ...state,
        interiorMaps: {
          ...state.interiorMaps,
          [poiKey]: {
            ...interiorMap,
            hazards: updatedHazards
          }
        }
      };
    }

    case ACTIONS.DISCOVER_LOOT: {
      const { poiKey, lootKey } = action.payload;
      const interiorMap = state.interiorMaps[poiKey];
      if (!interiorMap) return state;

      const updatedLoot = interiorMap.loot.map(l => {
        if (`${l.col},${l.row}` === lootKey) {
          return { ...l, discovered: true };
        }
        return l;
      });

      return {
        ...state,
        interiorMaps: {
          ...state.interiorMaps,
          [poiKey]: {
            ...interiorMap,
            loot: updatedLoot
          }
        }
      };
    }

    case ACTIONS.ENTER_TOWN: {
      const { col, row, poi } = action.payload;
      const poiKey = `${col},${row}`;

      // Interior should already be generated by useHexInteraction before this action
      const townInterior = state.interiorMaps[poiKey];
      
      if (!townInterior) {
        console.error('ENTER_TOWN called but interior not found! This should not happen.');
        return state;
      }

      const entrancePos = townInterior.entrance || { col: 0, row: 0 };

      return {
        ...state,
        inInterior: true,
        currentPOI: { col, row, poi },
        interiorPlayerPosition: entrancePos
      };
    }

    case ACTIONS.EXIT_TOWN:
      return {
        ...state,
        inInterior: false,
        currentPOI: null,
        interiorPlayerPosition: null
      };

    default:
      return null; // Action not handled by this reducer
  }
}
