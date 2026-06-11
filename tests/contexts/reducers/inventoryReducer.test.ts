import { describe, it, expect, vi } from 'vitest';
import { inventoryReducer } from '../../../src/contexts/reducers/inventoryReducer';

// ─── Mock heavy dependencies ─────────────────────────────────────────────────

vi.mock('../../../src/game/TimeManager', () => ({
  advanceTime: vi.fn(() => ({ day: 1, hour: 8, minute: 0 })),
}));

vi.mock('../../../src/constants/gameConstants', () => ({
  TIME: {
    FORAGE_TIME_MINUTES: 240,
    SEARCH_TIME_MINUTES: 120,
  },
}));

// Character.fromJSON returns a plain mutable object mimicking the Character interface
vi.mock('../../../src/game/Character', () => ({
  Character: {
    fromJSON: vi.fn((json: unknown) => {
      const obj = { ...(json as Record<string, unknown>) };
      obj.toJSON = () => ({ ...obj });
      return obj;
    }),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  EQUIP_ITEM: 'EQUIP_ITEM',
  UNEQUIP_ITEM: 'UNEQUIP_ITEM',
  CONSUME_RATIONS: 'CONSUME_RATIONS',
  CONSUME_WATER: 'CONSUME_WATER',
  FORAGE: 'FORAGE',
  FIND_WATER: 'FIND_WATER',
};

function makeItem(id: string, slot = 'mainHand') {
  return { id, name: `Item-${id}`, slot, type: 'weapon', rarity: 'common', value: 10, weight: 1 };
}

function makeCharacterStub(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Hero',
    inventory: [] as unknown[],
    equipment: {
      mainHand: null,
      offHand: null,
      chest: null,
      head: null,
      neck: null,
      hands: null,
      legs: null,
      feet: null,
      ring1: null,
      ring2: null,
    } as Record<string, unknown>,
    rations: 5,
    water: 3,
    toJSON: function () {
      return { ...this };
    },
    ...overrides,
  };
}

function makeState(charOverrides?: Record<string, unknown>) {
  return {
    playerCharacter: makeCharacterStub(charOverrides),
    gameTime: { day: 1, hour: 6, minute: 0 },
  };
}

// ─── ADD_ITEM ─────────────────────────────────────────────────────────────────

describe('inventoryReducer — ADD_ITEM', () => {
  it('adds an item to inventory', () => {
    const state = makeState();
    const item = makeItem('sword-1');
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.ADD_ITEM, payload: { item } } as any,
      ACTIONS
    );
    expect((result?.playerCharacter as any).inventory).toHaveLength(1);
    expect((result?.playerCharacter as any).inventory[0].id).toBe('sword-1');
  });

  it('returns original state if playerCharacter is null', () => {
    const state = { ...makeState(), playerCharacter: null };
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.ADD_ITEM, payload: { item: makeItem('x') } } as any,
      ACTIONS
    );
    expect(result).toEqual(state);
  });

  it('returns a new playerCharacter object (not the same reference)', () => {
    const state = makeState();
    const original = state.playerCharacter;
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.ADD_ITEM, payload: { item: makeItem('a') } } as any,
      ACTIONS
    );
    // The returned playerCharacter should be a different object from the original
    expect(result?.playerCharacter).not.toBe(original);
  });
});

// ─── REMOVE_ITEM ─────────────────────────────────────────────────────────────

describe('inventoryReducer — REMOVE_ITEM', () => {
  it('removes an item by id', () => {
    const item = makeItem('potion-1');
    const state = makeState({ inventory: [item] });
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.REMOVE_ITEM, payload: { itemId: 'potion-1' } } as any,
      ACTIONS
    );
    expect((result?.playerCharacter as any).inventory).toHaveLength(0);
  });

  it('leaves inventory unchanged if item not found', () => {
    const state = makeState({ inventory: [makeItem('x')] });
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.REMOVE_ITEM, payload: { itemId: 'does-not-exist' } } as any,
      ACTIONS
    );
    expect((result?.playerCharacter as any).inventory).toHaveLength(1);
  });

  it('returns original state if playerCharacter is null', () => {
    const state = { ...makeState(), playerCharacter: null };
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.REMOVE_ITEM, payload: { itemId: 'x' } } as any,
      ACTIONS
    );
    expect(result).toEqual(state);
  });
});

// ─── EQUIP_ITEM ───────────────────────────────────────────────────────────────

describe('inventoryReducer — EQUIP_ITEM', () => {
  it('moves item from inventory to equipment slot', () => {
    const item = makeItem('axe-1', 'mainHand');
    const state = makeState({ inventory: [item] });
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.EQUIP_ITEM, payload: { item, slot: 'mainHand' } } as any,
      ACTIONS
    );
    const char = result?.playerCharacter as any;
    expect(char.equipment.mainHand?.id).toBe('axe-1');
    // Item removed from inventory
    expect(char.inventory.find((i: any) => i.id === 'axe-1')).toBeUndefined();
  });

  it('returns original state if playerCharacter is null', () => {
    const state = { ...makeState(), playerCharacter: null };
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.EQUIP_ITEM, payload: { item: makeItem('x'), slot: 'mainHand' } } as any,
      ACTIONS
    );
    expect(result).toEqual(state);
  });
});

// ─── UNEQUIP_ITEM ────────────────────────────────────────────────────────────

describe('inventoryReducer — UNEQUIP_ITEM', () => {
  it('moves item from equipment slot to inventory', () => {
    const item = makeItem('shield-1', 'offHand');
    const state = makeState({
      equipment: {
        mainHand: null,
        offHand: item,
        chest: null,
        head: null,
        neck: null,
        hands: null,
        legs: null,
        feet: null,
        ring1: null,
        ring2: null,
      },
      inventory: [],
    });
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.UNEQUIP_ITEM, payload: { slot: 'offHand' } } as any,
      ACTIONS
    );
    const char = result?.playerCharacter as any;
    // Empty slots are represented as null (matches Character.unequipItem and toJSON), not deleted.
    expect(char.equipment.offHand).toBeNull();
    expect(char.inventory.some((i: any) => i.id === 'shield-1')).toBe(true);
  });

  it('does nothing if slot is empty', () => {
    const state = makeState({ inventory: [] });
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.UNEQUIP_ITEM, payload: { slot: 'offHand' } } as any,
      ACTIONS
    );
    expect((result?.playerCharacter as any).inventory).toHaveLength(0);
  });
});

// ─── CONSUME_RATIONS ─────────────────────────────────────────────────────────

describe('inventoryReducer — CONSUME_RATIONS', () => {
  it('reduces rations by the given amount', () => {
    const state = makeState({ rations: 5 });
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.CONSUME_RATIONS, payload: { amount: 2 } } as any,
      ACTIONS
    );
    expect((result?.playerCharacter as any).rations).toBe(3);
  });

  it('does not reduce rations below 0', () => {
    const state = makeState({ rations: 1 });
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.CONSUME_RATIONS, payload: { amount: 10 } } as any,
      ACTIONS
    );
    expect((result?.playerCharacter as any).rations).toBe(0);
  });

  it('returns original state if playerCharacter is null', () => {
    const state = { ...makeState(), playerCharacter: null };
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.CONSUME_RATIONS, payload: { amount: 1 } } as any,
      ACTIONS
    );
    expect(result).toEqual(state);
  });
});

// ─── FORAGE ──────────────────────────────────────────────────────────────────

describe('inventoryReducer — FORAGE', () => {
  it('updates playerCharacter and advances game time', () => {
    const character = makeCharacterStub();
    const state = makeState();
    const result = inventoryReducer(
      state as any,
      { type: ACTIONS.FORAGE, payload: { character } } as any,
      ACTIONS
    );
    expect(result?.playerCharacter).toBe(character);
    expect(result?.gameTime).toBeDefined();
  });
});

// ─── Unhandled action ────────────────────────────────────────────────────────

describe('inventoryReducer — unhandled action', () => {
  it('returns null for unknown actions', () => {
    const state = makeState();
    const result = inventoryReducer(
      state as any,
      { type: 'TOTALLY_UNKNOWN', payload: {} } as any,
      ACTIONS
    );
    expect(result).toBeNull();
  });
});
