/**
 * Equipment component - displays character equipment with equip/unequip functionality.
 * Layout: 3-column split — equipped slots | inventory list | item detail panel.
 */

import { useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import type { Item } from '../../game/Item';
import type { Character } from '../../game/Character';

interface ItemSource {
  type: string;
  slotId?: string;
}

// ─── Item Detail Panel ────────────────────────────────────────────────────────

interface ItemDetailPanelProps {
  item: Item | null;
  source: ItemSource | null;
  onEquip: (item: Item) => void;
  onUnequip: (slotId: string) => void;
}

function ItemDetailPanel({ item, source, onEquip, onUnequip }: ItemDetailPanelProps) {
  if (!item) {
    return (
      <div className="item-detail-panel empty">
        <div className="detail-panel-placeholder">
          <div className="placeholder-icon">⚔</div>
          <div className="placeholder-text">Click any item to inspect it</div>
        </div>
      </div>
    );
  }

  const rarityLabel = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
  const effectsText = item.getEffectsText();

  return (
    <div className="item-detail-panel" style={{ borderTopColor: item.getRarityColor() }}>
      <div className="detail-name" style={{ color: item.getRarityColor() }}>
        {item.name}
      </div>
      <div className="detail-rarity-type">
        {rarityLabel} {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
      </div>

      <div className="detail-divider" />

      <div className="detail-stats">
        {item.slot && (
          <div className="detail-stat-row">
            <span className="detail-stat-label">Slot</span>
            <span className="detail-stat-value">{item.slot}</span>
          </div>
        )}
        {item.damage && (
          <div className="detail-stat-row">
            <span className="detail-stat-label">Damage</span>
            <span className="detail-stat-value">
              {item.damage}
              {item.damageType && ` ${item.damageType}`}
              {item.twoHanded && ' (2H)'}
            </span>
          </div>
        )}
        {item.armorType && (
          <div className="detail-stat-row">
            <span className="detail-stat-label">Armor</span>
            <span className="detail-stat-value">{item.armorType}</span>
          </div>
        )}
        {item.effects?.ac && (
          <div className="detail-stat-row">
            <span className="detail-stat-label">AC Bonus</span>
            <span className="detail-stat-value">+{item.effects.ac}</span>
          </div>
        )}
        {effectsText !== 'No special effects' && (
          <div className="detail-stat-row effects">
            <span className="detail-stat-label">Effects</span>
            <span className="detail-stat-value">{effectsText}</span>
          </div>
        )}
        {item.charges !== null && item.maxCharges !== null && (
          <div className="detail-stat-row">
            <span className="detail-stat-label">Charges</span>
            <span className="detail-stat-value">
              {item.charges}/{item.maxCharges}
            </span>
          </div>
        )}
      </div>

      {item.description && (
        <>
          <div className="detail-divider" />
          <div className="detail-description">{item.description}</div>
        </>
      )}

      <div className="detail-divider" />

      <div className="detail-footer">
        <span>{item.weight} lbs</span>
        <span>{item.value} gp</span>
      </div>

      <div className="detail-actions">
        {source?.type === 'slot' && (
          <button className="detail-action-btn unequip" onClick={() => onUnequip(source.slotId ?? '')}>
            Unequip
          </button>
        )}
        {source?.type === 'inventory' && item.isEquippable() && (
          <button className="detail-action-btn equip" onClick={() => onEquip(item)}>
            Equip
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Equipment Slot (compact) ─────────────────────────────────────────────────

interface EquipmentSlotProps {
  label: string;
  item: Item | null;
  slotId: string;
  isSelected: boolean;
  onSelect: (item: Item, source: ItemSource) => void;
}

function EquipmentSlot({ label, item, slotId, isSelected, onSelect }: EquipmentSlotProps) {
  const handleClick = () => {
    if (item) onSelect(item, { type: 'slot', slotId });
  };

  if (!item) {
    return (
      <div className="equipment-slot empty" data-slot={slotId}>
        <div className="slot-label">{label}</div>
        <div className="slot-content-empty">Empty</div>
      </div>
    );
  }

  return (
    <div
      className={`equipment-slot equipped${isSelected ? ' selected' : ''}`}
      data-slot={slotId}
      style={{ borderLeftColor: item.getRarityColor() }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
    >
      <div className="slot-label">{label}</div>
      <div className="slot-content">
        <div className="item-name" style={{ color: item.getRarityColor() }}>
          {item.name}
        </div>
        <div className="slot-mini-stats">
          {item.effects?.ac && <span className="mini-stat">AC +{item.effects.ac}</span>}
          {item.damage && <span className="mini-stat">{item.damage}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Item (mini-display) ────────────────────────────────────────────

interface InventoryItemProps {
  item: Item;
  isSelected: boolean;
  onSelect: (item: Item, source: ItemSource) => void;
}

function InventoryItem({ item, isSelected, onSelect }: InventoryItemProps) {
  const itemType = item.type.charAt(0).toUpperCase() + item.type.slice(1);

  const handleClick = () => onSelect(item, { type: 'inventory' });

  return (
    <div
      className={`inventory-item${isSelected ? ' selected' : ''}`}
      style={{ borderLeftColor: item.getRarityColor(), borderLeftWidth: '3px' }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
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
          {item.value > 0 && <span className="item-detail">{item.value} gp</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Panel ──────────────────────────────────────────────────────────

interface InventoryProps {
  inventory: Item[] | null | undefined;
  selectedItem: Item | null;
  onSelect: (item: Item, source: ItemSource) => void;
}

function Inventory({ inventory, selectedItem, onSelect }: InventoryProps) {
  const [filter, setFilter] = useState('all');

  if (!inventory || inventory.length === 0) {
    return (
      <div className="inventory-col">
        <div className="inventory-col-header">
          <h4>Inventory</h4>
        </div>
        <div className="inventory-empty">No items in inventory</div>
      </div>
    );
  }

  const itemsByType: Record<string, Item[]> = {
    weapon: [],
    armor: [],
    consumable: [],
    quest: [],
    misc: [],
  };
  inventory.forEach(item => {
    const type = item.type || 'misc';
    if (itemsByType[type]) itemsByType[type].push(item);
    else itemsByType.misc.push(item);
  });

  const filteredItems = filter === 'all' ? inventory : itemsByType[filter] || [];

  const typeCounts = {
    all: inventory.length,
    weapon: itemsByType.weapon.length,
    armor: itemsByType.armor.length,
    consumable: itemsByType.consumable.length,
    quest: itemsByType.quest.length,
    misc: itemsByType.misc.length,
  };

  return (
    <div className="inventory-col">
      <div className="inventory-col-header">
        <h4>Inventory ({inventory.length})</h4>
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
          filteredItems.map(item => (
            <InventoryItem
              key={item.id}
              item={item}
              isSelected={selectedItem?.id === item.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Equipment (root) ─────────────────────────────────────────────────────────

interface EquipmentProps {
  character: Character | null;
}

function Equipment({ character }: EquipmentProps) {
  const { dispatch, actions } = useGameState();
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedSource, setSelectedSource] = useState<ItemSource | null>(null);

  if (!character) {
    return <div className="equipment-placeholder">Select a party member to view equipment</div>;
  }

  if (!character.equipment) {
    return <div className="equipment-placeholder">Invalid character data (missing equipment)</div>;
  }

  const equipment = character.equipment as Record<string, Item | null>;

  const handleSelect = (item: Item, source: ItemSource) => {
    // Clicking the same item again deselects it
    if (selectedItem?.id === item.id && selectedSource?.slotId === source?.slotId) {
      setSelectedItem(null);
      setSelectedSource(null);
    } else {
      setSelectedItem(item);
      setSelectedSource(source);
    }
  };

  const handleUnequip = (slotId: string) => {
    dispatch({ type: actions.UNEQUIP_ITEM, payload: { slot: slotId } });
    setSelectedItem(null);
    setSelectedSource(null);
  };

  const handleEquip = (item: Item) => {
    let targetSlot = item.slot;

    if (item.slot === 'ring1' || item.slot === 'ring2') {
      if (!equipment.ring1) targetSlot = 'ring1';
      else if (!equipment.ring2) targetSlot = 'ring2';
      else targetSlot = 'ring1';
    }

    dispatch({
      type: actions.EQUIP_ITEM,
      payload: { itemId: item.id, slot: targetSlot },
    });
    setSelectedItem(null);
    setSelectedSource(null);
  };

  const slots = [
    { label: 'Head', id: 'head' },
    { label: 'Neck', id: 'neck' },
    { label: 'Chest', id: 'chest' },
    { label: 'Hands', id: 'hands' },
    { label: 'Legs', id: 'legs' },
    { label: 'Feet', id: 'feet' },
    { label: 'Ring 1', id: 'ring1' },
    { label: 'Ring 2', id: 'ring2' },
    { label: 'Main Hand', id: 'mainHand' },
    { label: 'Off Hand', id: 'offHand' },
  ];

  return (
    <div className="equipment-display">
      <div className="equipment-header">
        <h3>{character.name}'s Equipment</h3>
      </div>

      <div className="equipment-layout">
        {/* Column 1: Equipped Slots */}
        <div className="equipped-slots-col">
          <h4 className="col-heading">Equipped</h4>
          {slots.map(({ label, id }) => (
            <EquipmentSlot
              key={id}
              label={label}
              item={equipment[id]}
              slotId={id}
              isSelected={selectedSource?.type === 'slot' && selectedSource?.slotId === id}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* Column 2: Inventory */}
        <Inventory
          inventory={character.inventory}
          selectedItem={selectedSource?.type === 'inventory' ? selectedItem : null}
          onSelect={handleSelect}
        />

        {/* Column 3: Item Detail Panel */}
        <ItemDetailPanel
          item={selectedItem}
          source={selectedSource}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
        />
      </div>
    </div>
  );
}

export default Equipment;
