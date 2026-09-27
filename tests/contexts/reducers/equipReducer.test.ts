import { describe, it, expect } from 'vitest';
import { inventoryReducer } from '../../../src/contexts/reducers/inventoryReducer';
import { Character } from '../../../src/game/Character';
import { Item } from '../../../src/game/Item';

const ACTIONS = { EQUIP_ITEM: 'EQUIP_ITEM', UNEQUIP_ITEM: 'UNEQUIP_ITEM' };

function equip(pc: Character, itemId: string, slot: string) {
  const state = { playerCharacter: pc } as any;
  return inventoryReducer(state, { type: 'EQUIP_ITEM', payload: { itemId, slot } }, ACTIONS)!
    .playerCharacter as Character;
}

describe('inventoryReducer — EQUIP_ITEM via Character.equipItem', () => {
  it('moves the previously equipped item back into the inventory', () => {
    const pc = new Character('Hero', 'barbarian');
    const oldWeapon = pc.equipment.mainHand!;
    pc.addItem(new Item({ id: 'club', name: 'Club', type: 'weapon', slot: 'mainHand' }));

    const after = equip(pc, 'club', 'mainHand');

    expect(after.equipment.mainHand?.id).toBe('club');
    expect(after.inventory.some(i => i.name === oldWeapon.name)).toBe(true);
    expect(pc.equipment.mainHand?.name).toBe(oldWeapon.name); // original untouched
  });

  it('applies item AC and keeps level-up HP', () => {
    const pc = new Character('Hero', 'barbarian');
    pc.levelUp();
    const maxHP = pc.maxHP;
    const ac = pc.armorClass;
    pc.addItem(new Item({ id: 'helm', name: 'Helm', type: 'armor', slot: 'head', effects: { ac: 1 } }));

    const after = equip(pc, 'helm', 'head');

    expect(after.armorClass).toBe(ac + 1);
    expect(after.maxHP).toBe(maxHP);
  });

  it('unequips into the inventory', () => {
    const pc = new Character('Hero', 'barbarian');
    const weapon = pc.equipment.mainHand!;
    const state = { playerCharacter: pc } as any;
    const after = inventoryReducer(
      state,
      { type: 'UNEQUIP_ITEM', payload: { slot: 'mainHand' } },
      ACTIONS
    )!.playerCharacter as Character;
    expect(after.equipment.mainHand).toBeNull();
    expect(after.inventory.some(i => i.id === weapon.id)).toBe(true);
  });
});
