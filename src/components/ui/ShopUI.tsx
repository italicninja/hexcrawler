// @ts-nocheck
import { useState } from 'react';
import { useGameState, ACTIONS } from '../../contexts/GameStateContext';
import './ShopUI.css';

/**
 * ShopUI - Modal component for buying and selling items at shops
 */
function ShopUI({ poiKey, shopType, onClose }) {
  const { state, dispatch } = useGameState();
  const [filter, setFilter] = useState('all');

  // Generate shop inventory if it doesn't exist
  const shop = state.shopInventories[poiKey];
  if (!shop) {
    dispatch({
      type: ACTIONS.GENERATE_SHOP_INVENTORY,
      payload: {
        poiKey,
        shopType: shopType || 'general',
        level: state.playerCharacter?.level || 1,
      },
    });
    return null; // Will re-render once shop is generated
  }

  const playerGold = state.playerCharacter?.gold || 0;
  const playerInventory = state.playerCharacter?.inventory || [];

  // Filter functions
  const filterItem = item => {
    if (filter === 'all') return true;
    if (filter === 'weapons') return item.type === 'weapon';
    if (filter === 'armor') return item.type === 'armor';
    if (filter === 'consumables') return item.type === 'consumable';
    if (filter === 'misc') return item.type === 'misc' || item.type === 'quest';
    return true;
  };

  const filteredShopInventory = shop.inventory.filter(filterItem);
  const filteredPlayerInventory = playerInventory.filter(filterItem);

  // Buy item handler
  const handleBuyItem = itemId => {
    dispatch({
      type: ACTIONS.BUY_ITEM,
      payload: { poiKey, itemId },
    });
  };

  // Sell item handler
  const handleSellItem = itemId => {
    dispatch({
      type: ACTIONS.SELL_ITEM,
      payload: { poiKey, itemId },
    });
  };

  // Check if item is equipped
  const isItemEquipped = itemId => {
    if (!state.playerCharacter) return false;
    return Object.values(state.playerCharacter.equipment).some(
      equipped => equipped && equipped.id === itemId
    );
  };

  return (
    <div className="shop-overlay">
      <div className="shop-modal">
        {/* Header */}
        <div className="shop-header">
          <h2>{shop.name}</h2>
          <button className="shop-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Gold Display */}
        <div className="shop-gold-display">
          <span className="gold-label">Your Gold:</span>
          <span className="gold-amount">{playerGold} gp</span>
        </div>

        {/* Filter Buttons */}
        <div className="shop-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'weapons' ? 'active' : ''}`}
            onClick={() => setFilter('weapons')}
          >
            Weapons
          </button>
          <button
            className={`filter-btn ${filter === 'armor' ? 'active' : ''}`}
            onClick={() => setFilter('armor')}
          >
            Armor
          </button>
          <button
            className={`filter-btn ${filter === 'consumables' ? 'active' : ''}`}
            onClick={() => setFilter('consumables')}
          >
            Consumables
          </button>
          <button
            className={`filter-btn ${filter === 'misc' ? 'active' : ''}`}
            onClick={() => setFilter('misc')}
          >
            Other
          </button>
        </div>

        {/* Two-column layout */}
        <div className="shop-content">
          {/* Shop Inventory Column */}
          <div className="shop-column shop-inventory-column">
            <h3>Shop Inventory</h3>
            <div className="item-list">
              {filteredShopInventory.length === 0 ? (
                <div className="no-items">No items available</div>
              ) : (
                filteredShopInventory.map(item => {
                  const buyPrice = shop.getBuyPrice(item);
                  const canAfford = playerGold >= buyPrice;

                  return (
                    <div key={item.id} className="shop-item">
                      <div className="item-info">
                        <div
                          className="item-name"
                          style={{ color: item.getRarityColor() }}
                          title={item.getTooltip()}
                        >
                          {item.name}
                        </div>
                        <div className="item-details">
                          <span className="item-type">{item.type}</span>
                          {item.damage && <span className="item-damage"> • {item.damage}</span>}
                          {item.effects.ac && (
                            <span className="item-ac"> • AC +{item.effects.ac}</span>
                          )}
                          {item.effects.hp && (
                            <span className="item-hp"> • HP +{item.effects.hp}</span>
                          )}
                        </div>
                      </div>
                      <div className="item-actions">
                        <span className="item-price">{buyPrice} gp</span>
                        <button
                          className="btn-buy"
                          disabled={!canAfford}
                          onClick={() => handleBuyItem(item.id)}
                          title={canAfford ? 'Buy this item' : 'Not enough gold'}
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Player Inventory Column */}
          <div className="shop-column player-inventory-column">
            <h3>Your Inventory</h3>
            <div className="item-list">
              {filteredPlayerInventory.length === 0 ? (
                <div className="no-items">No items to sell</div>
              ) : (
                filteredPlayerInventory.map(item => {
                  const sellPrice = shop.getSellPrice(item);
                  const equipped = isItemEquipped(item.id);

                  return (
                    <div key={item.id} className={`shop-item ${equipped ? 'equipped' : ''}`}>
                      <div className="item-info">
                        <div
                          className="item-name"
                          style={{ color: item.getRarityColor() }}
                          title={item.getTooltip()}
                        >
                          {item.name}
                          {equipped && <span className="equipped-badge">Equipped</span>}
                        </div>
                        <div className="item-details">
                          <span className="item-type">{item.type}</span>
                          {item.damage && <span className="item-damage"> • {item.damage}</span>}
                          {item.effects.ac && (
                            <span className="item-ac"> • AC +{item.effects.ac}</span>
                          )}
                          {item.effects.hp && (
                            <span className="item-hp"> • HP +{item.effects.hp}</span>
                          )}
                        </div>
                      </div>
                      <div className="item-actions">
                        <span className="item-price">{sellPrice} gp</span>
                        <button
                          className="btn-sell"
                          disabled={equipped}
                          onClick={() => handleSellItem(item.id)}
                          title={equipped ? 'Unequip before selling' : 'Sell this item'}
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shop-footer">
          <button className="btn-primary" onClick={onClose}>
            Close Shop
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShopUI;
