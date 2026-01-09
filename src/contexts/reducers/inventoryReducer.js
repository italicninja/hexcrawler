/**
 * Inventory Reducer - Handles items, equipment, and survival resources
 * 
 * Actions handled:
 * - ADD_ITEM
 * - REMOVE_ITEM
 * - EQUIP_ITEM
 * - UNEQUIP_ITEM
 * - CONSUME_RATIONS
 * - CONSUME_WATER
 * - FORAGE
 * - FIND_WATER
 */

import SurvivalManager from '../../game/SurvivalManager.js';
import { advanceTime } from '../../game/TimeManager.js';
import { TIME } from '../../constants/gameConstants.js';

export function inventoryReducer(state, action, ACTIONS) {
  switch (action.type) {
    case ACTIONS.ADD_ITEM: {
      const { item } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      state.playerCharacter.inventory.push(item);
      
      return {
        ...state,
        playerCharacter: state.playerCharacter
      };
    }

    case ACTIONS.REMOVE_ITEM: {
      const { itemId } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      const index = state.playerCharacter.inventory.findIndex(i => i.id === itemId);
      if (index >= 0) {
        state.playerCharacter.inventory.splice(index, 1);
      }
      
      return {
        ...state,
        playerCharacter: state.playerCharacter
      };
    }

    case ACTIONS.EQUIP_ITEM: {
      const { item } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      // Remove from inventory
      const index = state.playerCharacter.inventory.findIndex(i => i.id === item.id);
      if (index >= 0) {
        state.playerCharacter.inventory.splice(index, 1);
      }
      
      // Add to equipped
      state.playerCharacter.equipped[item.slot] = item;
      
      return {
        ...state,
        playerCharacter: state.playerCharacter
      };
    }

    case ACTIONS.UNEQUIP_ITEM: {
      const { slot } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      const item = state.playerCharacter.equipped[slot];
      if (item) {
        delete state.playerCharacter.equipped[slot];
        state.playerCharacter.inventory.push(item);
      }
      
      return {
        ...state,
        playerCharacter: state.playerCharacter
      };
    }

    case ACTIONS.CONSUME_RATIONS: {
      const { amount } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      state.playerCharacter.rations = Math.max(0, state.playerCharacter.rations - amount);
      
      return {
        ...state,
        playerCharacter: state.playerCharacter
      };
    }

    case ACTIONS.CONSUME_WATER: {
      const { amount } = action.payload;
      
      if (!state.playerCharacter) return state;
      
      state.playerCharacter.water = Math.max(0, state.playerCharacter.water - amount);
      
      return {
        ...state,
        playerCharacter: state.playerCharacter
      };
    }

    case ACTIONS.FORAGE: {
      const { character } = action.payload;
      
      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.FORAGE_TIME_MINUTES);
      
      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime
      };
    }

    case ACTIONS.FIND_WATER: {
      const { character } = action.payload;
      
      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.SEARCH_TIME_MINUTES);
      
      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
