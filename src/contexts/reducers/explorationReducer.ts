/**
 * Exploration Reducer - Handles interior/dungeon exploration
 *
 * Actions handled:
 * - SET_ACTIVE_EVENT
 * - SEARCH_POI
 * - SET_INTERIOR_MAP
 * - SET_INTERIOR_FLOOR
 * - SET_INTERIOR_PLAYER_POSITION
 * - ENTER_EXPLORATION
 * - EXIT_EXPLORATION
 * - CHANGE_FLOOR
 * - DEFEAT_ENCOUNTER
 * - COLLECT_LOOT
 * - TRIGGER_HAZARD
 * - DISCOVER_ENCOUNTER
 * - DISCOVER_HAZARD
 * - DISCOVER_LOOT
 * - ENTER_TOWN
 * - EXIT_TOWN
 */

import type { GameState, Action } from '../../types/state';
import { Character } from '../../game/Character';
import logger from '../../utils/logger';

export function explorationReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): GameState | null {
  switch (action.type) {
    case ACTIONS.SET_ACTIVE_EVENT:
      return {
        ...state,
        activeEvent: action.payload,
      };

    case ACTIONS.SEARCH_POI: {
      const { col, row } = action.payload;

      return {
        ...state,
        discoveredPOIs: new Set([...state.discoveredPOIs, `${col},${row}`]),
      };
    }

    case ACTIONS.SET_INTERIOR_MAP: {
      const { key, map } = action.payload;

      return {
        ...state,
        interiorMaps: {
          ...state.interiorMaps,
          [key]: map,
        },
      };
    }

    case ACTIONS.SET_INTERIOR_PLAYER_POSITION: {
      return {
        ...state,
        interiorPlayerPosition: action.payload,
      };
    }

    case ACTIONS.SET_INTERIOR_FLOOR: {
      // Store a generated floor map under key "col,row:floorIndex"
      const { key, map } = action.payload;
      return {
        ...state,
        interiorFloors: {
          ...state.interiorFloors,
          [key]: map,
        },
      };
    }

    case ACTIONS.CHANGE_FLOOR: {
      // Switch to a different floor within the current multi-level POI.
      // payload: { floor: number, spawnPosition: { col, row } }
      const { floor, spawnPosition } = action.payload;
      return {
        ...state,
        currentFloor: floor,
        interiorPlayerPosition: spawnPosition,
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
        currentFloor: 0,
        interiorPlayerPosition: entrancePos,
      };
    }

    case ACTIONS.EXIT_EXPLORATION:
      return {
        ...state,
        inInterior: false,
        currentPOI: null,
        currentFloor: 0,
        interiorPlayerPosition: null,
      };

    case ACTIONS.DEFEAT_ENCOUNTER: {
      const { encounterId, loot, xp } = action.payload;

      const newState = { ...state };

      // Mark encounter as defeated — immutably
      if (state.interiorMap?.encounters) {
        const updatedEncounters = state.interiorMap.encounters.map(e =>
          e.id === encounterId ? { ...e, defeated: true } : e
        );
        newState.interiorMap = { ...state.interiorMap, encounters: updatedEncounters };
      }

      // Award XP — immutably
      if (xp && state.playerCharacter) {
        const character = Character.fromJSON(state.playerCharacter.toJSON());
        character.awardXP(xp);
        newState.playerCharacter = character;
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

      const character = Character.fromJSON(state.playerCharacter.toJSON());

      // Add items to inventory
      if (items) {
        character.inventory.push(...items);
      }

      // Add gold
      if (gold) {
        character.gold += gold;
      }

      return {
        ...state,
        playerCharacter: character,
        pendingLoot: null,
      };
    }

    case ACTIONS.TRIGGER_HAZARD: {
      const { damage } = action.payload;

      if (!state.playerCharacter) return state;

      const character = Character.fromJSON(state.playerCharacter.toJSON());

      // Apply damage
      if (damage) {
        character.currentHP = Math.max(0, character.currentHP - damage);
      }

      return {
        ...state,
        playerCharacter: character,
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
            encounters: updatedEncounters,
          },
        },
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
            hazards: updatedHazards,
          },
        },
      };
    }

    case ACTIONS.DISCOVER_LOOT: {
      const { poiKey, lootKey, collected } = action.payload;
      const interiorMap = state.interiorMaps[poiKey];
      if (!interiorMap) return state;

      const updatedLoot = interiorMap.loot.map(l => {
        if (`${l.col},${l.row}` === lootKey) {
          return { ...l, discovered: true, ...(collected ? { collected: true } : {}) };
        }
        return l;
      });

      return {
        ...state,
        interiorMaps: {
          ...state.interiorMaps,
          [poiKey]: {
            ...interiorMap,
            loot: updatedLoot,
          },
        },
      };
    }

    case ACTIONS.ENTER_TOWN: {
      const { col, row, poi } = action.payload;
      const poiKey = `${col},${row}`;

      // Interior should already be generated by useHexInteraction before this action
      const townInterior = state.interiorMaps[poiKey];

      if (!townInterior) {
        logger.state.error('ENTER_TOWN called but interior not found! This should not happen.');
        return state;
      }

      const entrancePos = townInterior.entrance || { col: 0, row: 0 };

      return {
        ...state,
        inInterior: true,
        currentPOI: { col, row, poi },
        currentFloor: 0,
        interiorPlayerPosition: entrancePos,
      };
    }

    case ACTIONS.EXIT_TOWN:
      return {
        ...state,
        inInterior: false,
        currentPOI: null,
        currentFloor: 0,
        interiorPlayerPosition: null,
      };

    default:
      return null; // Action not handled by this reducer
  }
}
