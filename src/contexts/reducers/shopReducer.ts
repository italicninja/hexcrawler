/**
 * Shop Reducer - Handles shop inventory and transactions
 *
 * Actions handled:
 * - GENERATE_SHOP_INVENTORY
 * - BUY_ITEM
 * - SELL_ITEM
 */

 
import { Shop } from '../../game/Shop';
import { Character } from '../../game/Character';
import type { GameState, Action } from '../../types/state';

export function shopReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): GameState | null {
  switch (action.type) {
    case ACTIONS.GENERATE_SHOP_INVENTORY: {
      const { townName, townSize } = action.payload;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shop = new (Shop as any)(townName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (shop as any).generateInventory(townSize);

      return {
        ...state,
        currentShop: shop,
      };
    }

    case ACTIONS.BUY_ITEM: {
      const { item, cost } = action.payload;

      if (!state.playerCharacter || !state.currentShop) return state;

      // Check if player can afford
      if (state.playerCharacter.gold < cost) {
        return state;
      }

      // Clone character immutably before mutating
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const character = Character.fromJSON(state.playerCharacter.toJSON()) as any;
      character.gold -= cost;
      character.inventory.push(item);

      // Clone shop inventory immutably — remove purchased item
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedShopInventory = state.currentShop.inventory.filter((i: any) => i.id !== item.id);
      const updatedShop = { ...state.currentShop, inventory: updatedShopInventory };

      return {
        ...state,
        playerCharacter: character,
        currentShop: updatedShop,
      };
    }

    case ACTIONS.SELL_ITEM: {
      const { item, sellPrice } = action.payload;

      if (!state.playerCharacter || !state.currentShop) return state;

      // Clone character immutably before mutating
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const character = Character.fromJSON(state.playerCharacter.toJSON()) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invIndex = character.inventory.findIndex((i: any) => i.id === item.id);
      if (invIndex >= 0) {
        character.inventory.splice(invIndex, 1);
      }
      character.gold += sellPrice;

      // Clone shop inventory immutably — add sold item back to shop
      const updatedShop = {
        ...state.currentShop,
        inventory: [...state.currentShop.inventory, item],
      };

      return {
        ...state,
        playerCharacter: character,
        currentShop: updatedShop,
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
