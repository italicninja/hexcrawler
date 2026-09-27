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
 * - COLLECT_LOOT
 * - TRIGGER_HAZARD
 * - DISCOVER_ENCOUNTER
 * - DISCOVER_HAZARD
 * - DISCOVER_LOOT
 * - ENTER_TOWN
 * - EXIT_TOWN
 */

import type { GameState, Action, InteriorMap } from '../../types/state';
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
      // payload: "col,row" — read back by isPoiSearched (search, shrine prayer/offering)
      const poiKey: string = action.payload;

      return {
        ...state,
        explorationState: {
          ...state.explorationState,
          searchedPOIs: new Set([...state.explorationState.searchedPOIs, poiKey]),
        },
      };
    }

    case ACTIONS.SET_INTERIOR_MAP: {
      // key is the POI key; the map shown is the current floor's (CHANGE_FLOOR runs first)
      const { key, map } = action.payload;

      return {
        ...state,
        interiorMaps: {
          ...state.interiorMaps,
          [key]: withClearedEncounters(state, map, `${key}:floor${state.currentFloor ?? 0}`),
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
          [key]: withClearedEncounters(state, map, key),
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

    case ACTIONS.COLLECT_LOOT: {
      const { items, gold } = action.payload;

      if (!state.playerCharacter) return state;

      const character = state.playerCharacter.clone();

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

      const character = state.playerCharacter.clone();

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

/**
 * Interiors regenerate from their seed (they aren't saved), so re-apply the
 * encounters already won on this floor (explorationState.clearedEncounters).
 */
function withClearedEncounters(state: GameState, map: InteriorMap, floorKey: string) {
  const cleared = state.explorationState.clearedEncounters[floorKey];
  if (!cleared?.size || !map?.encounters) return map;
  return {
    ...map,
    encounters: map.encounters.map(e =>
      cleared.has(`${e.col},${e.row}`) ? { ...e, defeated: true } : e
    ),
  };
}
