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
      const { item: payloadItem, itemId, slot: payloadSlot } = action.payload;

      if (!state.playerCharacter) return state;

      const character = state.playerCharacter.clone();

      // Resolve the item — either passed directly or looked up by id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item: any = payloadItem || character.inventory.find((i: any) => i.id === itemId);

      if (!item) {
        logger.items.warn('EQUIP_ITEM: item not found', { itemId, payloadItem });
        return state;
      }

      const slot = (payloadSlot || item.slot) as keyof typeof character.equipment;

      // Remove from inventory
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const index = character.inventory.findIndex((i: any) => i.id === item.id);
      if (index >= 0) {
        character.inventory.splice(index, 1);
      }

      // Add to equipped slot
      character.equipment[slot] = item;

      return {
        ...state,
        playerCharacter: character,
      };
    }

    case ACTIONS.UNEQUIP_ITEM: {
      const { slot } = action.payload;

      if (!state.playerCharacter) return state;

      const character = state.playerCharacter.clone();
      const equipSlot = slot as keyof typeof character.equipment;
      const item = character.equipment[equipSlot];
      if (item) {
        character.equipment[equipSlot] = null;
        character.inventory.push(item);
      }

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
