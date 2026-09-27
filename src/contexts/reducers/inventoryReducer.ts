/**
 * Inventory Reducer - Handles items, equipment, and survival resources
 *
 * Actions handled:
 * - ADD_ITEM
 * - REMOVE_ITEM
 * - EQUIP_ITEM
 * - UNEQUIP_ITEM
 * - CONSUME_RATIONS
 * - FORAGE
 */

import { advanceTime } from '../../game/TimeManager';
import { TIME } from '../../constants/gameConstants';
import logger from '../../utils/logger';
import type { GameState, Action } from '../../types/state';

export function inventoryReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): GameState | null {
  switch (action.type) {
    case ACTIONS.ADD_ITEM: {
      const { item } = action.payload;

      if (!state.playerCharacter) return state;

      const character = state.playerCharacter.clone();
      character.inventory.push(item);

      return {
        ...state,
        playerCharacter: character,
      };
    }

    case ACTIONS.REMOVE_ITEM: {
      const { itemId } = action.payload;

      if (!state.playerCharacter) return state;

      const character = state.playerCharacter.clone();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const index = character.inventory.findIndex((i: any) => i.id === itemId);
      if (index >= 0) {
        character.inventory.splice(index, 1);
      }

      return {
        ...state,
        playerCharacter: character,
      };
    }

    case ACTIONS.EQUIP_ITEM: {
      // Payload may be { item } (full object) or { itemId, slot } (id + slot)
      const { item: payloadItem, itemId, slot } = action.payload;

      if (!state.playerCharacter) return state;

      const character = state.playerCharacter.clone();
      // Character.equipItem swaps out whatever is in the slot, enforces two-handed
      // rules and reapplies item stat bonuses — never assign equipment directly.
      if (!character.equipItem(payloadItem?.id ?? itemId, slot ?? null)) {
        logger.items.warn('EQUIP_ITEM failed', { itemId, payloadItem, slot });
        return state;
      }

      return {
        ...state,
        playerCharacter: character,
      };
    }

    case ACTIONS.UNEQUIP_ITEM: {
      const { slot } = action.payload;

      if (!state.playerCharacter) return state;

      const character = state.playerCharacter.clone();
      if (!character.unequipItem(slot)) return state;

      return {
        ...state,
        playerCharacter: character,
      };
    }

    case ACTIONS.CONSUME_RATIONS: {
      const { amount } = action.payload;

      if (!state.playerCharacter) return state;

      const character = state.playerCharacter.clone();
      character.rations = Math.max(0, character.rations - amount);

      return {
        ...state,
        playerCharacter: character,
      };
    }

    case ACTIONS.FORAGE: {
      const { character } = action.payload;

      // Advance time
      const newGameTime = advanceTime(state.gameTime, TIME.FORAGE_TIME_MINUTES);

      return {
        ...state,
        playerCharacter: character,
        gameTime: newGameTime,
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
