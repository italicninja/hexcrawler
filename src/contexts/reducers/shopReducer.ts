/**
 * Shop Reducer - Handles shop inventory and transactions
 *
 * Actions handled:
 * - GENERATE_SHOP_INVENTORY
 * - BUY_ITEM
 * - SELL_ITEM
 */

import { Shop } from '../../game/Shop';

export function shopReducer(state, action, ACTIONS) {
  switch (action.type) {
    case ACTIONS.GENERATE_SHOP_INVENTORY: {
      const { townName, townSize } = action.payload;

      const shop = new Shop(townName);
      shop.generateInventory(townSize);

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

      // Deduct gold
      state.playerCharacter.gold -= cost;

      // Add item to inventory
      state.playerCharacter.inventory.push(item);

      // Remove item from shop
      const shopIndex = state.currentShop.inventory.findIndex(i => i.id === item.id);
      if (shopIndex >= 0) {
        state.currentShop.inventory.splice(shopIndex, 1);
      }

      return {
        ...state,
        playerCharacter: state.playerCharacter,
        currentShop: state.currentShop,
      };
    }

    case ACTIONS.SELL_ITEM: {
      const { item, sellPrice } = action.payload;

      if (!state.playerCharacter || !state.currentShop) return state;

      // Remove item from inventory
      const invIndex = state.playerCharacter.inventory.findIndex(i => i.id === item.id);
      if (invIndex >= 0) {
        state.playerCharacter.inventory.splice(invIndex, 1);
      }

      // Add gold
      state.playerCharacter.gold += sellPrice;

      // Add item to shop (optional - shops could refuse certain items)
      state.currentShop.inventory.push(item);

      return {
        ...state,
        playerCharacter: state.playerCharacter,
        currentShop: state.currentShop,
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
