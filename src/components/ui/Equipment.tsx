/**
 * Equipment component - displays character equipment with equip/unequip functionality.
 * Layout: a single journal column — "worn & wielded" slot list, then the pack. The selected
 * item's details open inline beneath its row, with equip/unequip as ink links.
 */

import { useState, type ReactNode } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import type { Item } from '../../game/Item';
import type { Character } from '../../game/Character';
import PixelIcon from './PixelIcon';
import './Equipment.css';

interface ItemSource {
  type: string;
  slotId?: string;
}

const SLOTS = [
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

const slotLabel = (slot: string) => SLOTS.find(s => s.id === slot)?.label ?? slot;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Short stat summary shown at the end of a row, e.g. "2d6 · AC +1 · 7 lbs". */
function itemSummary(item: Item, withWeightValue: boolean): string {
  const parts: string[] = [];
  if (item.damage) parts.push(item.damage);
  if (item.effects?.ac) parts.push(`AC +${item.effects.ac}`);
  if (withWeightValue) {
    if (item.weight > 0) parts.push(`${item.weight} lbs`);
    if (item.value > 0) parts.push(`${item.value} gp`);
  }
  return parts.join(' · ');
}

// ─── Item Detail (inline, under the selected row) ─────────────────────────────

interface ItemDetailProps {
  item: Item;
  source: ItemSource;
  onEquip: (item: Item) => void;
  onUnequip: (slotId: string) => void;
}

function ItemDetail({ item, source, onEquip, onUnequip }: ItemDetailProps) {
  const effectsText = item.getEffectsText();

  return (
    <div className="eq-detail" id={`eq-detail-${item.id}`}>
      <p className="jp-note eq-detail-kind">
        <span className="eq-rarity" data-rarity={item.rarity}>
          {capitalize(item.rarity)}
        </span>{' '}
        {item.type}
      </p>

      {item.description && <p className="jp-prose">{item.description}</p>}

      <ul className="jp-rows">
        {item.slot && (
          <li className="jp-row">
            <span>Slot</span>
            <span>{slotLabel(item.slot)}</span>
          </li>
        )}
        {item.damage && (
          <li className="jp-row">
            <span>Damage</span>
            <span>
              {item.damage}
              {item.damageType && ` ${item.damageType}`}
              {item.twoHanded && ' (2H)'}
            </span>
          </li>
        )}
        {item.armorType && (
          <li className="jp-row">
            <span>Armor</span>
            <span>{item.armorType}</span>
          </li>
        )}
        {item.effects?.ac && (
          <li className="jp-row">
            <span>AC Bonus</span>
            <span>+{item.effects.ac}</span>
          </li>
        )}
        {effectsText !== 'No special effects' && (
          <li className="jp-row">
            <span>Effects</span>
            <span>{effectsText}</span>
          </li>
        )}
        {item.charges !== null && item.maxCharges !== null && (
          <li className="jp-row">
            <span>Charges</span>
            <span>
              {item.charges}/{item.maxCharges}
            </span>
          </li>
        )}
        <li className="jp-row">
          <span>Weight &amp; worth</span>
          <span>
            {item.weight} lbs · {item.value} gp
          </span>
        </li>
      </ul>

      {(source.type === 'slot' || (source.type === 'inventory' && item.isEquippable())) && (
        <div className="jp-actions">
          {source.type === 'slot' && (
            <button className="jp-link" onClick={() => onUnequip(source.slotId ?? '')}>
              Unequip
            </button>
          )}
          {source.type === 'inventory' && item.isEquippable() && (
            <button className="jp-link jp-link--primary" onClick={() => onEquip(item)}>
              Equip
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Item row (slot or pack entry) ────────────────────────────────────────────

interface ItemRowProps {
  item: Item;
  label: string;
  aside: string;
  isSelected: boolean;
  slotId?: string;
  onClick: () => void;
}

function ItemRow({ item, label, aside, isSelected, slotId, onClick }: ItemRowProps) {
  return (
    <button
      type="button"
      className={`eq-row${isSelected ? ' is-selected' : ''}`}
      data-slot={slotId}
      aria-expanded={isSelected}
      aria-controls={isSelected ? `eq-detail-${item.id}` : undefined}
      onClick={onClick}
    >
      <span className="eq-label">{label}</span>
      <span className="eq-name" data-rarity={item.rarity}>
        {item.name}
      </span>
      {aside && <span className="jp-aside">{aside}</span>}
    </button>
  );
}

// ─── Inventory (the pack) ─────────────────────────────────────────────────────

interface InventoryProps {
  inventory: Item[] | null | undefined;
  selectedItem: Item | null;
  onSelect: (item: Item, source: ItemSource) => void;
  renderDetail: (item: Item) => ReactNode;
}

function Inventory({ inventory, selectedItem, onSelect, renderDetail }: InventoryProps) {
  const [filter, setFilter] = useState('all');

  if (!inventory || inventory.length === 0) {
    return (
      <>
        <h4 className="jp-heading">
          <PixelIcon name="scroll" /> The pack
        </h4>
        <p className="jp-prose jp-muted">Your pack is empty.</p>
      </>
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

  const filters = [
    { id: 'all', label: 'All', count: inventory.length },
    { id: 'weapon', label: 'Weapons', count: itemsByType.weapon.length },
    { id: 'armor', label: 'Armor', count: itemsByType.armor.length },
    { id: 'consumable', label: 'Consumables', count: itemsByType.consumable.length },
    { id: 'misc', label: 'Other', count: itemsByType.quest.length + itemsByType.misc.length },
  ].filter(f => f.id === 'all' || f.count > 0);

  return (
    <>
      <h4 className="jp-heading">
        <PixelIcon name="scroll" /> The pack ({inventory.length})
      </h4>
      <div className="eq-filters" role="group" aria-label="Filter pack by type">
        {filters.map(f => {
          const active = filter === f.id || (f.id === 'misc' && filter === 'quest');
          return (
            <button
              key={f.id}
              type="button"
              className={`eq-filter${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <span className="jp-muted">({f.count})</span>
            </button>
          );
        })}
      </div>
      <div className="eq-list">
        {filteredItems.length === 0 ? (
          <p className="jp-note">Nothing of that kind in the pack.</p>
        ) : (
          filteredItems.map(item => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <div key={item.id}>
                <ItemRow
                  item={item}
                  label={item.type}
                  aside={itemSummary(item, true)}
                  isSelected={isSelected}
                  onClick={() => onSelect(item, { type: 'inventory' })}
                />
                {isSelected && renderDetail(item)}
              </div>
            );
          })
        )}
      </div>
    </>
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
    return <p className="jp-prose jp-muted">Select a party member to view equipment.</p>;
  }

  if (!character.equipment) {
    return <p className="jp-prose jp-muted">Invalid character data (missing equipment).</p>;
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

  const renderDetail = (item: Item) =>
    selectedSource && (
      <ItemDetail
        item={item}
        source={selectedSource}
        onEquip={handleEquip}
        onUnequip={handleUnequip}
      />
    );

  return (
    <div className="eq">
      <h4 className="jp-heading">
        <PixelIcon name="equipment" /> Worn &amp; wielded
      </h4>
      <div className="eq-list">
        {SLOTS.map(({ label, id }) => {
          const item = equipment[id];
          if (!item) {
            return (
              <div key={id} className="eq-row eq-row--empty" data-slot={id}>
                <span className="eq-label">{label}</span>
                <span className="eq-name">—</span>
              </div>
            );
          }
          const isSelected = selectedSource?.type === 'slot' && selectedSource?.slotId === id;
          return (
            <div key={id}>
              <ItemRow
                item={item}
                label={label}
                slotId={id}
                aside={itemSummary(item, false)}
                isSelected={isSelected}
                onClick={() => handleSelect(item, { type: 'slot', slotId: id })}
              />
              {isSelected && renderDetail(item)}
            </div>
          );
        })}
      </div>

      <Inventory
        inventory={character.inventory}
        selectedItem={selectedSource?.type === 'inventory' ? selectedItem : null}
        onSelect={handleSelect}
        renderDetail={renderDetail}
      />
    </div>
  );
}

export default Equipment;
