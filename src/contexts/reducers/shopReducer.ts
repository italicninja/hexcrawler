/**
 * Shop Reducer - Handles shop inventory and transactions
 *
 * Actions handled:
 * - GENERATE_SHOP_INVENTORY
 * - BUY_ITEM
 * - SELL_ITEM
 */

 
import { Shop } from '../../game/Shop';
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

      // Must afford it, and it must still be on the shelf (a double-click would duplicate it)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inStock = state.currentShop.inventory.some((i: any) => i.id === item.id);
      if (state.playerCharacter.gold < cost || !inStock) {
        return state;
      }

      // Clone character immutably before mutating
       
      const character = state.playerCharacter.clone();
      character.gold -= cost;
      character.inventory.push(item);

      // Clone shop inventory immutably — remove purchased item
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedShopInventory = state.currentShop.inventory.filter((i: any) => i.id !== item.id);
      const updatedShop = withInventory(state.currentShop, updatedShopInventory);

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
       
      const character = state.playerCharacter.clone();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invIndex = character.inventory.findIndex((i: any) => i.id === item.id);
      // Selling something you no longer carry (double-click, stale UI) must not pay out
      if (invIndex < 0) return state;
      character.inventory.splice(invIndex, 1);
      character.gold += sellPrice;

      // Clone shop inventory immutably — add sold item back to shop
      const updatedShop = withInventory(state.currentShop, [...state.currentShop.inventory, item]);

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

/** Copy a Shop with a new inventory, keeping its class (a spread would drop toJSON). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withInventory(shop: any, inventory: unknown[]) {
  return Object.assign(Object.create(Object.getPrototypeOf(shop)), shop, { inventory });
}
