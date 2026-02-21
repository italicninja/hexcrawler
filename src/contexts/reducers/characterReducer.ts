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
import { applyStarvation } from '../../game/SurvivalManager';
import { Character } from '../../game/Character';
import type { GameState, Action } from '../../types/state';

export function characterReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): GameState | null {
  switch (action.type) {
    case ACTIONS.SET_PLAYER_CHARACTER:
      return {
        ...state,
        playerCharacter: action.payload,
      };

    case ACTIONS.SET_PARTY:
      return {
        ...state,
        party: action.payload,
      };

    case ACTIONS.UPDATE_CHARACTER:
      return {
        ...state,
        playerCharacter: action.payload,
      };

    case ACTIONS.SHORT_REST: {
      const { character } = action.payload;

      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.SHORT_REST_MINUTES);

      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime,
      };
    }

    case ACTIONS.LONG_REST: {
      const { character } = action.payload;

      // Apply starvation check after long rest
      // Character may have gained exhaustion from lack of food
      applyStarvation(character);

      // Note: starvationResult modifies character in place
      // Message is logged by the component that dispatched this action

      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.LONG_REST_MINUTES);

      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime,
      } as GameState;
    }

    case ACTIONS.INN_REST: {
      const { character } = action.payload;

      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.INN_REST_MINUTES);

      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime,
      };
    }

    case ACTIONS.AWARD_XP: {
      const { xp } = action.payload;

      if (!state.playerCharacter) return state;

      const character = Character.fromJSON(state.playerCharacter.toJSON()) as any;
      const oldLevel = character.level;
      character.awardXP(xp);
      const newLevel = character.level;

      return {
        ...state,
        playerCharacter: character,
        leveledUp: newLevel > oldLevel,
      };
    }

    case ACTIONS.LEVEL_UP_CHARACTER: {
      const { character } = action.payload;

      return {
        ...state,
        playerCharacter: character,
        leveledUp: false,
      };
    }

    case ACTIONS.APPLY_EXHAUSTION: {
      const { levels } = action.payload;

      if (!state.playerCharacter) return state;

      const character = Character.fromJSON(state.playerCharacter.toJSON()) as any;
      character.exhaustion = Math.min(6, character.exhaustion + levels);

      return {
        ...state,
        playerCharacter: character,
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
