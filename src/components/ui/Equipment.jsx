/**
 * Equipment component - displays character equipment with equip/unequip functionality
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext.jsx';

function ItemTooltip({ item, children }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!item) return children;

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div className="item-tooltip">
          <div className="tooltip-header" style={{ color: item.getRarityColor() }}>
            {item.name}
          </div>
          <div className="tooltip-type">
            {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)} {item.type}
          </div>
          {item.slot && (
            <div className="tooltip-slot">Slot: {item.slot}</div>
          )}
          {item.damage && (
            <div className="tooltip-damage">
              Damage: {item.damage}
              {item.damageType && ` ${item.damageType}`}
              {item.twoHanded && ' (Two-Handed)'}
            </div>
          )}
          {item.armorType && (
            <div className="tooltip-armor">Armor Type: {item.armorType}</div>
          )}
          {item.getEffectsText() !== 'No special effects' && (
            <div className="tooltip-effects">{item.getEffectsText()}</div>
          )}
          {item.charges !== null && item.maxCharges !== null && (
            <div className="tooltip-charges">Charges: {item.charges}/{item.maxCharges}</div>
          )}
          {item.description && (
            <div className="tooltip-description">{item.description}</div>
          )}
          <div className="tooltip-footer">
            Weight: {item.weight} lbs | Value: {item.value} gp
          </div>
        </div>
      )}
    </div>
  );
}

ItemTooltip.propTypes = {
  item: PropTypes.object,
  children: PropTypes.node.isRequired
};

function EquipmentSlot({ label, item, slotId, onUnequip }) {
  if (!item) {
    return (
      <div className="equipment-slot empty" data-slot={slotId}>
        <div className="slot-label">{label}</div>
        <div className="slot-content">Empty</div>
      </div>
    );
  }

  return (
    <ItemTooltip item={item}>
      <div
        className="equipment-slot equipped"
        data-slot={slotId}
        style={{ borderColor: item.getRarityColor() }}
      >
        <div className="slot-label">{label}</div>
        <div className="slot-content">
          <div className="item-name" style={{ color: item.getRarityColor() }}>
            {item.name}
          </div>
          <div className="item-details">
            {item.effects?.ac && <span className="item-stat">AC +{item.effects.ac}</span>}
            {item.damage && <span className="item-stat">{item.damage}</span>}
            {item.getEffectsText() !== 'No special effects' &&
             !item.effects?.ac &&
             !item.damage && (
              <span className="item-stat">{item.getEffectsText()}</span>
            )}
          </div>
          <button
            className="unequip-btn"
            onClick={() => onUnequip(slotId)}
            title="Unequip item"
          >
            Unequip
          </button>
        </div>
      </div>
    </ItemTooltip>
  );
}

EquipmentSlot.propTypes = {
  label: PropTypes.string.isRequired,
  item: PropTypes.object,
  slotId: PropTypes.string.isRequired,
  onUnequip: PropTypes.func.isRequired
};

function InventoryItem({ item, onEquip }) {
  const canEquip = item.isEquippable();
  const itemType = item.type.charAt(0).toUpperCase() + item.type.slice(1);

  return (
    <ItemTooltip item={item}>
      <div
        className="inventory-item"
        style={{ borderLeftColor: item.getRarityColor(), borderLeftWidth: '3px' }}
      >
        <div className="inventory-item-content">
          <div className="inventory-item-header">
            <span className="item-name" style={{ color: item.getRarityColor() }}>
              {item.name}
            </span>
            <span className="item-type-badge">{itemType}</span>
          </div>
          <div className="inventory-item-details">
            {item.damage && <span className="item-detail">{item.damage}</span>}
            {item.effects?.ac && <span className="item-detail">AC +{item.effects.ac}</span>}
            {item.weight > 0 && <span className="item-detail">{item.weight} lbs</span>}
          </div>
        </div>
        {canEquip && (
          <button
            className="equip-btn"
            onClick={() => onEquip(item)}
            title={`Equip to ${item.slot}`}
          >
            Equip
          </button>
        )}
      </div>
    </ItemTooltip>
  );
}

InventoryItem.propTypes = {
  item: PropTypes.object.isRequired,
  onEquip: PropTypes.func.isRequired
};

function Inventory({ inventory, onEquip }) {
  const [filter, setFilter] = useState('all');

  if (!inventory || inventory.length === 0) {
    return (
      <div className="inventory-section">
        <h4>Inventory</h4>
        <div className="inventory-empty">No items in inventory</div>
      </div>
    );
  }

  // Group items by type
  const itemsByType = {
    weapon: [],
    armor: [],
    consumable: [],
    quest: [],
    misc: []
  };

  inventory.forEach(item => {
    const type = item.type || 'misc';
    if (itemsByType[type]) {
      itemsByType[type].push(item);
    } else {
      itemsByType.misc.push(item);
    }
  });

  // Filter items
  const filteredItems = filter === 'all'
    ? inventory
    : itemsByType[filter] || [];

  // Count items by type
  const typeCounts = {
    all: inventory.length,
    weapon: itemsByType.weapon.length,
    armor: itemsByType.armor.length,
    consumable: itemsByType.consumable.length,
    quest: itemsByType.quest.length,
    misc: itemsByType.misc.length
  };

  return (
    <div className="inventory-section">
      <div className="inventory-header">
        <h4>Inventory ({inventory.length} items)</h4>
        <div className="inventory-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({typeCounts.all})
          </button>
          {typeCounts.weapon > 0 && (
            <button
              className={`filter-btn ${filter === 'weapon' ? 'active' : ''}`}
              onClick={() => setFilter('weapon')}
            >
              Weapons ({typeCounts.weapon})
            </button>
          )}
          {typeCounts.armor > 0 && (
            <button
              className={`filter-btn ${filter === 'armor' ? 'active' : ''}`}
              onClick={() => setFilter('armor')}
            >
              Armor ({typeCounts.armor})
            </button>
          )}
          {typeCounts.consumable > 0 && (
            <button
              className={`filter-btn ${filter === 'consumable' ? 'active' : ''}`}
              onClick={() => setFilter('consumable')}
            >
              Consumables ({typeCounts.consumable})
            </button>
          )}
          {(typeCounts.quest > 0 || typeCounts.misc > 0) && (
            <button
              className={`filter-btn ${filter === 'misc' || filter === 'quest' ? 'active' : ''}`}
              onClick={() => setFilter('misc')}
            >
              Other ({typeCounts.quest + typeCounts.misc})
            </button>
          )}
        </div>
      </div>
      <div className="inventory-list">
        {filteredItems.length === 0 ? (
          <div className="inventory-empty">No items in this category</div>
        ) : (
          filteredItems.map((item) => (
            <InventoryItem
              key={item.id}
              item={item}
              onEquip={onEquip}
            />
          ))
        )}
      </div>
    </div>
  );
}

Inventory.propTypes = {
  inventory: PropTypes.array,
  onEquip: PropTypes.func.isRequired
};

function Equipment({ character }) {
  const { dispatch, actions } = useGameState();

  if (!character) {
    return (
      <div className="equipment-placeholder">
        Select a party member to view equipment
      </div>
    );
  }

  // Null check for equipment object
  if (!character.equipment) {
    return (
      <div className="equipment-placeholder">
        Invalid character data (missing equipment)
      </div>
    );
  }

  const equipment = character.equipment;

  const handleUnequip = (slot) => {
    dispatch({
      type: actions.UNEQUIP_ITEM,
      payload: { slot }
    });
  };

  const handleEquip = (item) => {
    // Determine target slot
    let targetSlot = item.slot;

    // Special handling for rings - check which slot is available
    if (item.slot === 'ring1' || item.slot === 'ring2') {
      if (!equipment.ring1) {
        targetSlot = 'ring1';
      } else if (!equipment.ring2) {
        targetSlot = 'ring2';
      } else {
        // Both occupied, default to ring1 (will unequip existing)
        targetSlot = 'ring1';
      }
    }

    dispatch({
      type: actions.EQUIP_ITEM,
      payload: {
        itemId: item.id,
        slot: targetSlot
      }
    });
  };

  return (
    <div className="equipment-display">
      <div className="equipment-header">
        <h3>{character.name}'s Equipment</h3>
      </div>

      <div className="equipment-grid">
        <div className="equipment-column">
          <EquipmentSlot
            label="Head"
            item={equipment.head}
            slotId="head"
            onUnequip={handleUnequip}
          />
          <EquipmentSlot
            label="Neck"
            item={equipment.neck}
            slotId="neck"
            onUnequip={handleUnequip}
          />
          <EquipmentSlot
            label="Chest"
            item={equipment.chest}
            slotId="chest"
            onUnequip={handleUnequip}
          />
          <EquipmentSlot
            label="Hands"
            item={equipment.hands}
            slotId="hands"
            onUnequip={handleUnequip}
          />
          <EquipmentSlot
            label="Legs"
            item={equipment.legs}
            slotId="legs"
            onUnequip={handleUnequip}
          />
        </div>

        <div className="equipment-column">
          <EquipmentSlot
            label="Feet"
            item={equipment.feet}
            slotId="feet"
            onUnequip={handleUnequip}
          />
          <EquipmentSlot
            label="Ring 1"
            item={equipment.ring1}
            slotId="ring1"
            onUnequip={handleUnequip}
          />
          <EquipmentSlot
            label="Ring 2"
            item={equipment.ring2}
            slotId="ring2"
            onUnequip={handleUnequip}
          />
          <EquipmentSlot
            label="Main Hand"
            item={equipment.mainHand}
            slotId="mainHand"
            onUnequip={handleUnequip}
          />
          <EquipmentSlot
            label="Off Hand"
            item={equipment.offHand}
            slotId="offHand"
            onUnequip={handleUnequip}
          />
        </div>
      </div>

      <Inventory
        inventory={character.inventory}
        onEquip={handleEquip}
      />
    </div>
  );
}

Equipment.propTypes = {
  character: PropTypes.shape({
    name: PropTypes.string.isRequired,
    equipment: PropTypes.shape({
      head: PropTypes.object,
      neck: PropTypes.object,
      chest: PropTypes.object,
      hands: PropTypes.object,
      legs: PropTypes.object,
      feet: PropTypes.object,
      ring1: PropTypes.object,
      ring2: PropTypes.object,
      mainHand: PropTypes.object,
      offHand: PropTypes.object
    }).isRequired,
    inventory: PropTypes.array
  })
};

export default Equipment;
