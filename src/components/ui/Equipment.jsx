/**
 * Equipment component - displays character equipment
 */

function EquipmentSlot({ label, item, slotId }) {
  if (!item) {
    return (
      <div className="equipment-slot empty" data-slot={slotId}>
        <div className="slot-label">{label}</div>
        <div className="slot-content">Empty</div>
      </div>
    );
  }

  let stats = null;
  if (item.ac) {
    stats = <span className="item-stat">AC +{item.ac}</span>;
  } else if (item.damage) {
    stats = <span className="item-stat">{item.damage}</span>;
  }

  return (
    <div className="equipment-slot" data-slot={slotId}>
      <div className="slot-label">{label}</div>
      <div className="slot-content">
        <div className="item-name">{item.name}</div>
        {stats}
      </div>
    </div>
  );
}

function Inventory({ inventory }) {
  if (!inventory || inventory.length === 0) {
    return (
      <div className="inventory-section">
        <h4>Inventory</h4>
        <div className="inventory-empty">No items</div>
      </div>
    );
  }

  return (
    <div className="inventory-section">
      <h4>Inventory</h4>
      <div className="inventory-list">
        {inventory.map((item, index) => (
          <div key={index} className="inventory-item">
            <span className="item-name">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Equipment({ character }) {
  if (!character) {
    return (
      <div className="equipment-placeholder">
        Select a party member to view equipment
      </div>
    );
  }

  const equipment = character.equipment;

  return (
    <div className="equipment-display">
      <div className="equipment-header">
        <h3>{character.name}'s Equipment</h3>
      </div>

      <div className="equipment-grid">
        <div className="equipment-column">
          <EquipmentSlot label="Head" item={equipment.head} slotId="head" />
          <EquipmentSlot label="Neck" item={equipment.neck} slotId="neck" />
          <EquipmentSlot label="Chest" item={equipment.chest} slotId="chest" />
          <EquipmentSlot label="Hands" item={equipment.hands} slotId="hands" />
          <EquipmentSlot label="Legs" item={equipment.legs} slotId="legs" />
        </div>

        <div className="equipment-column">
          <EquipmentSlot label="Feet" item={equipment.feet} slotId="feet" />
          <EquipmentSlot label="Ring 1" item={equipment.ring1} slotId="ring1" />
          <EquipmentSlot label="Ring 2" item={equipment.ring2} slotId="ring2" />
          <EquipmentSlot label="Main Hand" item={equipment.mainHand} slotId="mainHand" />
          <EquipmentSlot label="Off Hand" item={equipment.offHand} slotId="offHand" />
        </div>
      </div>

      <Inventory inventory={character.inventory} />
    </div>
  );
}

export default Equipment;
