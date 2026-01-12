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
import { GAME_DEFAULTS, COMBAT } from '../../constants/gameConstants';

export function gameReducer(state, action, ACTIONS) {
  switch (action.type) {
    case ACTIONS.SET_CURRENT_SCENE:
      return {
        ...state,
        currentScene: action.payload
      };

    case ACTIONS.NEW_GAME: {
      const mapSeed = action.payload;

      // Transition to character creation scene instead of creating default character
      // This matches the expected flow: Title -> CharacterCreation -> Overworld
      return {
        ...state,
        playerPosition: GAME_DEFAULTS.START_POSITION,
        playerCharacter: null,
        party: null,
        mapData: null,
        mapSeed,
        hexGrid: null,
        exploredHexes: new Set(),
        discoveredPOIs: new Set(),
        currentScene: 'characterCreation',
        characterCreationSeed: mapSeed,
        hasActiveEvent: false,
        interiorMaps: {},
        currentPOI: null,
        interiorPlayerPosition: null,
        inInterior: false,
        explorationState: {
          searchedPOIs: new Set(),
          clearedEncounters: {},
          collectedLoot: {},
          triggeredHazards: {}
        },
        gameTime: createGameTime(),
        playtime: 0,
        combatLog: [],
        combatState: {
          active: false,
          combat: null,
          battlefield: null,
          turnOrder: [],
          currentTurnIndex: 0,
          round: 1,
          encounterName: '',
          encounterType: 'standard',
          waitingForPlayerAction: false,
          movementRemaining: COMBAT.DEFAULT_MOVEMENT_FEET
        },
        activeQuests: [],
        completedQuests: [],
        townQuests: {},
        shopInventories: {}
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
