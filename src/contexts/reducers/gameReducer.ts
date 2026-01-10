/**
 * Game Reducer - Handles core game state, scenes, time, and save/load
 * 
 * Actions handled:
 * - SET_CURRENT_SCENE
 * - NEW_GAME
 * - LOAD_GAME
 * - ADVANCE_TIME
 * - UPDATE_PLAYTIME
 */

import { Character } from '../../game/Character';
import { Party } from '../../game/Party';
import { createGameTime, advanceTime } from '../../game/TimeManager';
import { GAME_DEFAULTS } from '../../constants/gameConstants';

export function gameReducer(state, action, ACTIONS) {
  switch (action.type) {
    case ACTIONS.SET_CURRENT_SCENE:
      return {
        ...state,
        currentScene: action.payload
      };

    case ACTIONS.NEW_GAME: {
      const { character, seed } = action.payload;
      
      return {
        ...state,
        playerCharacter: character,
        party: new Party(character),
        mapSeed: seed,
        gameTime: createGameTime(),
        playtime: 0,
        exploredHexes: new Set(),
        discoveredPOIs: new Set(),
        activeQuests: [],
        completedQuests: [],
        failedQuests: [],
        availableQuests: [],
        inCombat: false,
        inInterior: false,
        inTown: false,
        currentPOI: null,
        currentShop: null,
        combat: null,
        battlefield: null,
        combatPositions: null,
        interiorMap: null,
        interiorPlayerPosition: null,
        currentScene: 'overworld'
      };
    }

    case ACTIONS.LOAD_GAME: {
      const loadedState = action.payload;
      
      // Reconstruct class instances
      let playerCharacter = null;
      if (loadedState.playerCharacter) {
        playerCharacter = Character.fromJSON(loadedState.playerCharacter);
      }
      
      let party = null;
      if (loadedState.party) {
        party = Party.fromJSON(loadedState.party);
      }
      
      // Reconstruct Sets
      const exploredHexes = new Set(loadedState.exploredHexes || []);
      const discoveredPOIs = new Set(loadedState.discoveredPOIs || []);
      
      return {
        ...state,
        ...loadedState,
        playerCharacter,
        party,
        exploredHexes,
        discoveredPOIs,
        // Don't restore combat state
        inCombat: false,
        combat: null,
        battlefield: null,
        combatPositions: null
      };
    }

    case ACTIONS.ADVANCE_TIME:
      return {
        ...state,
        gameTime: advanceTime(state.gameTime, action.payload)
      };

    case ACTIONS.UPDATE_PLAYTIME:
      return {
        ...state,
        playtime: (state.playtime || 0) + action.payload
      };

    default:
      return null; // Action not handled by this reducer
  }
}
