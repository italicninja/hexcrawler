/**
 * Map Reducer - Handles map data, exploration, and POI discovery
 *
 * Actions handled:
 * - SET_PLAYER_POSITION
 * - SET_MAP_DATA
 * - SET_MAP_SEED
 * - ADD_EXPLORED_HEX
 * - REVEAL_AROUND_PLAYER
 * - DISCOVER_POI
 */

import { HexGrid } from '../../utils/HexGrid';
import { GAME_DEFAULTS } from '../../constants/gameConstants';
import type { GameState, Action } from '../../types/state';

export function mapReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): (GameState & Record<string, unknown>) | null {
  switch (action.type) {
    case ACTIONS.SET_PLAYER_POSITION:
      return {
        ...state,
        playerPosition: action.payload,
      };

    case ACTIONS.SET_MAP_DATA: {
      // New format: { hexes, regions, hexToRegion, weatherSystem }
      // Old format: just array of hexes
      const isNewFormat = action.payload && action.payload.hexes;

      if (isNewFormat) {
        const { hexes, regions, hexToRegion, weatherSystem } = action.payload;
        const hexGrid = new HexGrid(hexes);

        return {
          ...state,
          mapData: hexes,
          hexGrid,
          regions: regions || [],
          hexToRegion: hexToRegion || null,
          weatherSystem: weatherSystem || null,
        };
      } else {
        // Legacy format for backwards compatibility
        const hexGrid = new HexGrid(action.payload);
        return {
          ...state,
          mapData: action.payload,
          hexGrid,
        };
      }
    }

    case ACTIONS.SET_MAP_SEED:
      return {
        ...state,
        mapSeed: action.payload,
      };

    case ACTIONS.ADD_EXPLORED_HEX:
      return {
        ...state,
        exploredHexes: new Set([...state.exploredHexes, action.payload]),
      };

    case ACTIONS.REVEAL_AROUND_PLAYER: {
      const { col, row } = action.payload;
      const newExploredHexes = new Set(state.exploredHexes);

      // Reveal hexes within view distance
      const viewDistance = state.playerCharacter?.viewDistance || GAME_DEFAULTS.VIEW_RADIUS;

      for (let r = row - viewDistance; r <= row + viewDistance; r++) {
        for (let c = col - viewDistance; c <= col + viewDistance; c++) {
          const hexKey = `${c},${r}`;
          newExploredHexes.add(hexKey);
        }
      }

      return {
        ...state,
        exploredHexes: newExploredHexes,
      };
    }

    case ACTIONS.DISCOVER_POI:
      return {
        ...state,
        discoveredPOIs: new Set([
          ...state.discoveredPOIs,
          `${action.payload.col},${action.payload.row}`,
        ]),
      };

    default:
      return null; // Action not handled by this reducer
  }
}
