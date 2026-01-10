/**
 * Character Reducer - Handles character state, XP, leveling, and rest
 * 
 * Actions handled:
 * - SET_PLAYER_CHARACTER
 * - SET_PARTY
 * - UPDATE_CHARACTER
 * - SHORT_REST
 * - LONG_REST
 * - INN_REST
 * - AWARD_XP
 * - LEVEL_UP_CHARACTER
 * - APPLY_EXHAUSTION
 */

import { advanceTime } from '../../game/TimeManager';
import { TIME } from '../../constants/gameConstants';

export function characterReducer(state, action, ACTIONS) {
  switch (action.type) {
    case ACTIONS.SET_PLAYER_CHARACTER:
      return {
        ...state,
        playerCharacter: action.payload
      };

    case ACTIONS.SET_PARTY:
      return {
        ...state,
        party: action.payload
      };

    case ACTIONS.UPDATE_CHARACTER:
      return {
        ...state,
        playerCharacter: action.payload
      };

    case ACTIONS.SHORT_REST: {
      const { character } = action.payload;
      
      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.SHORT_REST_MINUTES);
      
      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime
      };
    }

    case ACTIONS.LONG_REST: {
      const { character } = action.payload;
      
      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.LONG_REST_MINUTES);
      
      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime
      };
    }

    case ACTIONS.INN_REST: {
      const { character } = action.payload;
      
      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.INN_REST_MINUTES);
      
      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime
      };
    }

    case ACTIONS.AWARD_XP: {
      const { xp } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      const character = state.playerCharacter;
      const oldLevel = character.level;
      character.gainXP(xp);
      const newLevel = character.level;
      
      return {
        ...state,
        playerCharacter: character,
        leveledUp: newLevel > oldLevel
      };
    }

    case ACTIONS.LEVEL_UP_CHARACTER: {
      const { character } = action.payload;
      
      return {
        ...state,
        playerCharacter: character,
        leveledUp: false
      };
    }

    case ACTIONS.APPLY_EXHAUSTION: {
      const { levels } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      const character = state.playerCharacter;
      character.exhaustion = Math.min(6, character.exhaustion + levels);
      
      return {
        ...state,
        playerCharacter: character
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
