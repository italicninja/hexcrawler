/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../../src/utils/SaveManager';
import { gameReducer } from '../../src/contexts/reducers/gameReducer';
import { Character } from '../../src/game/Character';
import { Party } from '../../src/game/Party';
import { Quest } from '../../src/game/Quest';
import { Shop } from '../../src/game/Shop';
import { SAVE } from '../../src/constants/gameConstants';
import logger from '../../src/utils/logger';

const { SLOT_1, SLOT_2, SLOT_3, AUTOSAVE, QUICKSAVE_A, QUICKSAVE_B, QUICKSAVE_C } =
  SaveManager.SAVE_SLOTS;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a minimal-but-complete live game state, shaped the way SaveManager
 * expects it (real Character instance, Sets for exploration data, etc.).
 */
function makeGameState(overrides: Record<string, unknown> = {}): any {
  return {
    playerCharacter: new Character('Saver', 'fighter'),
    party: null,
    playerPosition: { col: 3, row: 4 },
    currentScene: 'overworld',
    mapSeed: 12345,
    exploredHexes: new Set(['3,4', '4,4']),
    discoveredPOIs: new Set(['town_3_4']),
    mapData: [{ col: 3, row: 4, terrain: { name: 'Plains' }, poi: null }],
    regions: [],
    hexToRegion: null,
    weatherSystem: null,
    interiorMaps: {},
    explorationState: {
      searchedPOIs: new Set(['poi_1']),
      clearedEncounters: { poi_1: new Set(['enc_1', 'enc_2']) },
      collectedLoot: { poi_1: new Set(['chest_1']) },
      triggeredHazards: {},
    },
    gameTime: { day: 3, hour: 14, minute: 30 },
    playtime: 4200,
    activeQuests: [],
    completedQuests: [],
    shopInventories: {},
    inInterior: false,
    currentPOI: null,
    ...overrides,
  };
}

/** Minimal reducer state for gameReducer LOAD_GAME tests. */
function makeReducerState(overrides: Record<string, unknown> = {}): any {
  return {
    playerPosition: { col: 0, row: 0 },
    playerCharacter: null,
    party: null,
    exploredHexes: new Set(),
    discoveredPOIs: new Set(),
    regions: [],
    hexToRegion: null,
    weatherSystem: null,
    explorationState: {
      searchedPOIs: new Set(),
      clearedEncounters: {},
      collectedLoot: {},
      triggeredHazards: {},
    },
    activeQuests: [],
    completedQuests: [],
    shopInventories: {},
    gameTime: { day: 1, hour: 8, minute: 0 },
    playtime: 0,
    currentScene: 'title',
    ...overrides,
  };
}

const ACTIONS = {
  SET_CURRENT_SCENE: 'SET_CURRENT_SCENE',
  NEW_GAME: 'NEW_GAME',
  LOAD_GAME: 'LOAD_GAME',
  ADVANCE_TIME: 'ADVANCE_TIME',
  UPDATE_PLAYTIME: 'UPDATE_PLAYTIME',
};

beforeEach(() => {
  localStorage.clear();
  // Silence storage logging but keep it spy-able for assertions
  vi.spyOn(logger.storage, 'warn').mockImplementation(() => {});
  vi.spyOn(logger.storage, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Save → Load round-trip ──────────────────────────────────────────────────

describe('SaveManager — save/load round-trip', () => {
  it('saveToSlot returns true and writes the slot key to localStorage', () => {
    const result = SaveManager.saveToSlot(SLOT_1, makeGameState());
    expect(result).toBe(true);
    expect(localStorage.getItem(SLOT_1)).not.toBeNull();
  });

  it('round-trip preserves scalar game data (position, scene, seed, time, playtime)', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    const loaded = SaveManager.loadFromSlot(SLOT_1);

    expect(loaded).not.toBeNull();
    expect(loaded.playerPosition).toEqual({ col: 3, row: 4 });
    expect(loaded.currentScene).toBe('overworld');
    expect(loaded.mapSeed).toBe(12345);
    expect(loaded.gameTime).toEqual({ day: 3, hour: 14, minute: 30 });
    expect(loaded.playtime).toBe(4200);
  });

  it('round-trip preserves serialized character data', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    const loaded = SaveManager.loadFromSlot(SLOT_1);

    expect(loaded.playerCharacter.name).toBe('Saver');
    expect(loaded.playerCharacter.class).toBe('fighter');
    expect(loaded.playerCharacter.level).toBe(1);
  });

  it('serializes exploredHexes/discoveredPOIs Sets as arrays that survive the round-trip', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    const loaded = SaveManager.loadFromSlot(SLOT_1);

    expect(Array.isArray(loaded.exploredHexes)).toBe(true);
    expect(new Set(loaded.exploredHexes)).toEqual(new Set(['3,4', '4,4']));
    expect(new Set(loaded.discoveredPOIs)).toEqual(new Set(['town_3_4']));
  });

  it('serializes explorationState record-of-Sets as arrays', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    const loaded = SaveManager.loadFromSlot(SLOT_1);

    expect(loaded.explorationState.searchedPOIs).toEqual(['poi_1']);
    expect(new Set(loaded.explorationState.clearedEncounters.poi_1)).toEqual(
      new Set(['enc_1', 'enc_2'])
    );
    expect(loaded.explorationState.collectedLoot.poi_1).toEqual(['chest_1']);
    expect(loaded.explorationState.triggeredHazards).toEqual({});
  });

  it('refuses to save when there is no player character', () => {
    const result = SaveManager.saveToSlot(SLOT_1, makeGameState({ playerCharacter: null }));
    expect(result).toBe(false);
    expect(localStorage.getItem(SLOT_1)).toBeNull();
    expect(logger.storage.warn).toHaveBeenCalledWith('Cannot save: no player character', {
      slotKey: SLOT_1,
    });
  });

  it('loadFromSlot returns null for an empty slot', () => {
    expect(SaveManager.loadFromSlot(SLOT_2)).toBeNull();
  });
});

// ─── Slot independence & deletion ────────────────────────────────────────────

describe('SaveManager — slot independence and deleteSlot', () => {
  it('keeps manual slots 1-3 independent', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState({ playerCharacter: new Character('One', 'fighter') }));
    SaveManager.saveToSlot(SLOT_2, makeGameState({ playerCharacter: new Character('Two', 'wizard') }));
    SaveManager.saveToSlot(SLOT_3, makeGameState({ playerCharacter: new Character('Three', 'rogue') }));

    expect(SaveManager.loadFromSlot(SLOT_1).playerCharacter.name).toBe('One');
    expect(SaveManager.loadFromSlot(SLOT_2).playerCharacter.name).toBe('Two');
    expect(SaveManager.loadFromSlot(SLOT_3).playerCharacter.name).toBe('Three');
  });

  it('deleteSlot removes only the targeted slot', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    SaveManager.saveToSlot(SLOT_2, makeGameState());

    SaveManager.deleteSlot(SLOT_1);

    expect(localStorage.getItem(SLOT_1)).toBeNull();
    expect(localStorage.getItem(SLOT_2)).not.toBeNull();
    expect(SaveManager.loadFromSlot(SLOT_2)).not.toBeNull();
  });

  it('deleteSlot clears the active slot pointer when deleting the active slot', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    expect(SaveManager.getActiveSlot()).toBe(SLOT_1);

    SaveManager.deleteSlot(SLOT_1);
    expect(SaveManager.getActiveSlot()).toBeNull();
  });

  it('deleteSlot leaves the active slot pointer alone when deleting another slot', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    SaveManager.saveToSlot(SLOT_2, makeGameState());
    expect(SaveManager.getActiveSlot()).toBe(SLOT_2);

    SaveManager.deleteSlot(SLOT_1);
    expect(SaveManager.getActiveSlot()).toBe(SLOT_2);
  });
});

// ─── Active slot & quicksave rotation ────────────────────────────────────────

describe('SaveManager — active slot and quicksave rotation', () => {
  it('saving to a manual slot sets it as the active slot', () => {
    SaveManager.saveToSlot(SLOT_3, makeGameState());
    expect(SaveManager.getActiveSlot()).toBe(SLOT_3);
  });

  it('saving to the autosave or quicksave slots does not change the active slot', () => {
    SaveManager.saveToSlot(AUTOSAVE, makeGameState());
    SaveManager.saveToSlot(QUICKSAVE_A, makeGameState());
    expect(SaveManager.getActiveSlot()).toBeNull();
  });

  it('loading from a manual slot marks it active', () => {
    SaveManager.saveToSlot(SLOT_2, makeGameState());
    localStorage.removeItem(SaveManager.ACTIVE_SLOT_KEY);

    SaveManager.loadFromSlot(SLOT_2);
    expect(SaveManager.getActiveSlot()).toBe(SLOT_2);
  });

  it('rotates quicksave slots A → B → C → A', () => {
    expect(SaveManager.getNextQuicksaveSlot()).toBe(QUICKSAVE_A);

    SaveManager.saveToSlot(QUICKSAVE_A, makeGameState());
    expect(SaveManager.getNextQuicksaveSlot()).toBe(QUICKSAVE_B);

    SaveManager.saveToSlot(QUICKSAVE_B, makeGameState());
    expect(SaveManager.getNextQuicksaveSlot()).toBe(QUICKSAVE_C);

    SaveManager.saveToSlot(QUICKSAVE_C, makeGameState());
    expect(SaveManager.getNextQuicksaveSlot()).toBe(QUICKSAVE_A);
  });
});

// ─── Version mismatch ────────────────────────────────────────────────────────

describe('SaveManager — version mismatch', () => {
  it('loadFromSlot returns null and warns when the save version differs', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());

    const tampered = JSON.parse(localStorage.getItem(SLOT_1) as string);
    tampered.version = '0.1';
    localStorage.setItem(SLOT_1, JSON.stringify(tampered));

    expect(SaveManager.loadFromSlot(SLOT_1)).toBeNull();
    expect(logger.storage.warn).toHaveBeenCalledWith('Save version mismatch', {
      savedVersion: '0.1',
      currentVersion: SAVE.VERSION,
      slotKey: SLOT_1,
    });
  });

  it('saves are stamped with the current SAVE.VERSION', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    const raw = JSON.parse(localStorage.getItem(SLOT_1) as string);
    expect(raw.version).toBe(SAVE.VERSION);
    expect(SaveManager.SAVE_VERSION).toBe(SAVE.VERSION);
  });
});

// ─── Corrupt data handling ───────────────────────────────────────────────────

describe('SaveManager — corrupt save data', () => {
  it('loadFromSlot returns null (no throw) and logs on corrupt JSON', () => {
    localStorage.setItem(SLOT_1, '{not valid json!!');

    let loaded: unknown;
    expect(() => {
      loaded = SaveManager.loadFromSlot(SLOT_1);
    }).not.toThrow();
    expect(loaded).toBeNull();
    expect(logger.storage.error).toHaveBeenCalledWith(
      'Failed to load save',
      expect.objectContaining({ slotKey: SLOT_1 })
    );
  });

  it('getSlotMetadata returns null (no throw) and logs on corrupt JSON', () => {
    localStorage.setItem(SLOT_2, '<<<garbage>>>');

    expect(SaveManager.getSlotMetadata(SLOT_2)).toBeNull();
    expect(logger.storage.error).toHaveBeenCalledWith(
      'Failed to read slot metadata',
      expect.objectContaining({ slotKey: SLOT_2 })
    );
  });
});

// ─── Quota exceeded ──────────────────────────────────────────────────────────

describe('SaveManager — QuotaExceededError', () => {
  it('returns false and logs the quota-specific error when setItem throws', () => {
    const quotaError = new Error('quota exceeded');
    quotaError.name = 'QuotaExceededError';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError;
    });

    let result: boolean | undefined;
    expect(() => {
      result = SaveManager.saveToSlot(SLOT_1, makeGameState());
    }).not.toThrow();

    expect(result).toBe(false);
    expect(logger.storage.error).toHaveBeenCalledWith('Failed to save game', {
      error: quotaError,
      slotKey: SLOT_1,
    });
    expect(logger.storage.error).toHaveBeenCalledWith('Save Failed: Storage Quota Exceeded', {
      slotKey: SLOT_1,
    });
  });
});

// ─── Slot metadata ───────────────────────────────────────────────────────────

describe('SaveManager — getSlotMetadata / getAllSlots / hasSaveData', () => {
  it('returns the saved metadata fields plus timestamp and version', () => {
    const before = Date.now();
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    const after = Date.now();

    const meta = SaveManager.getSlotMetadata(SLOT_1);
    expect(meta).not.toBeNull();
    expect(meta.characterName).toBe('Saver');
    expect(meta.level).toBe(1);
    expect(meta.class).toBe('fighter');
    expect(meta.location).toBe('Plains'); // terrain name at player position
    expect(meta.day).toBe(3);
    expect(meta.playtime).toBe(4200);
    expect(meta.version).toBe(SAVE.VERSION);
    expect(meta.timestamp).toBeGreaterThanOrEqual(before);
    expect(meta.timestamp).toBeLessThanOrEqual(after);
  });

  it('returns null for a missing slot', () => {
    expect(SaveManager.getSlotMetadata(SLOT_3)).toBeNull();
  });

  it('getAllSlots reports metadata only for populated slots', () => {
    SaveManager.saveToSlot(SLOT_1, makeGameState());
    SaveManager.saveToSlot(AUTOSAVE, makeGameState());

    const slots = SaveManager.getAllSlots();
    expect(slots.slot1).not.toBeNull();
    expect(slots.autosave).not.toBeNull();
    expect(slots.slot2).toBeNull();
    expect(slots.slot3).toBeNull();
    expect(slots.quicksaveA).toBeNull();
    expect(slots.quicksaveB).toBeNull();
    expect(slots.quicksaveC).toBeNull();
  });

  it('hasSaveData is false with no saves and true after any save', () => {
    expect(SaveManager.hasSaveData()).toBe(false);
    SaveManager.saveToSlot(QUICKSAVE_B, makeGameState());
    expect(SaveManager.hasSaveData()).toBe(true);
  });
});

// ─── gameReducer LOAD_GAME — Set/Map/class reconstruction ────────────────────

describe('gameReducer — LOAD_GAME reconstructs saved data', () => {
  /** Full pipeline: live state → SaveManager.saveToSlot → loadFromSlot → LOAD_GAME. */
  function saveAndReduce(stateOverrides: Record<string, unknown> = {}) {
    const liveState = makeGameState(stateOverrides);
    expect(SaveManager.saveToSlot(SLOT_1, liveState)).toBe(true);
    const payload = SaveManager.loadFromSlot(SLOT_1);
    expect(payload).not.toBeNull();
    return gameReducer(
      makeReducerState() as any,
      { type: ACTIONS.LOAD_GAME, payload } as any,
      ACTIONS
    );
  }

  it('reconstructs exploredHexes and discoveredPOIs as Sets', () => {
    const result = saveAndReduce() as any;

    expect(result.exploredHexes).toBeInstanceOf(Set);
    expect(result.exploredHexes.has('3,4')).toBe(true);
    expect(result.exploredHexes.has('4,4')).toBe(true);
    expect(result.exploredHexes.size).toBe(2);

    expect(result.discoveredPOIs).toBeInstanceOf(Set);
    expect(result.discoveredPOIs.has('town_3_4')).toBe(true);
  });

  it('reconstructs the player Character and Party as class instances', () => {
    const player = new Character('Saver', 'fighter');
    const party = new Party();
    party.setPlayer(player);

    const result = saveAndReduce({ playerCharacter: player, party }) as any;

    expect(result.playerCharacter).toBeInstanceOf(Character);
    expect(result.playerCharacter.name).toBe('Saver');
    expect(result.playerCharacter.class).toBe('fighter');
    expect(result.party).toBeInstanceOf(Party);
    expect(result.party.player.name).toBe('Saver');
  });

  it('reconstructs explorationState record-of-Sets', () => {
    const result = saveAndReduce() as any;

    expect(result.explorationState.searchedPOIs).toBeInstanceOf(Set);
    expect(result.explorationState.searchedPOIs.has('poi_1')).toBe(true);
    expect(result.explorationState.clearedEncounters.poi_1).toBeInstanceOf(Set);
    expect(result.explorationState.clearedEncounters.poi_1.has('enc_1')).toBe(true);
    expect(result.explorationState.clearedEncounters.poi_1.has('enc_2')).toBe(true);
    expect(result.explorationState.collectedLoot.poi_1).toBeInstanceOf(Set);
    expect(result.explorationState.collectedLoot.poi_1.has('chest_1')).toBe(true);
  });

  it('reconstructs regions (boundaries as Sets) and hexToRegion as a Map', () => {
    const result = saveAndReduce({
      regions: [
        { id: 0, name: 'Heartlands', boundaries: new Set(['0,0', '1,0']) },
      ],
      hexToRegion: new Map([
        ['3,4', 0],
        ['4,4', 0],
      ]),
    }) as any;

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].name).toBe('Heartlands');
    expect(result.regions[0].boundaries).toBeInstanceOf(Set);
    expect(result.regions[0].boundaries.has('0,0')).toBe(true);
    expect(result.regions[0].boundaries.has('1,0')).toBe(true);

    expect(result.hexToRegion).toBeInstanceOf(Map);
    expect(result.hexToRegion.get('3,4')).toBe(0);
    expect(result.hexToRegion.get('4,4')).toBe(0);
  });

  it('reconstructs Quest instances with objective progress intact', () => {
    const quest = new Quest({
      id: 'q_relic',
      title: 'Find the Relic',
      objectives: [Quest.createKillObjective('goblin', 3)],
      rewards: { xp: 100, gold: 50, items: [] },
      status: 'active',
    });
    quest.updateObjective(0, 2);

    const done = new Quest({
      id: 'q_done',
      title: 'Old Errand',
      objectives: [Quest.createVisitObjective('village')],
      status: 'completed',
    });

    const result = saveAndReduce({ activeQuests: [quest], completedQuests: [done] }) as any;

    expect(result.activeQuests).toHaveLength(1);
    expect(result.activeQuests[0]).toBeInstanceOf(Quest);
    expect(result.activeQuests[0].title).toBe('Find the Relic');
    expect(result.activeQuests[0].objectives[0].current).toBe(2);
    expect(result.activeQuests[0].objectives[0].required).toBe(3);

    expect(result.completedQuests).toHaveLength(1);
    expect(result.completedQuests[0]).toBeInstanceOf(Quest);
    expect(result.completedQuests[0].id).toBe('q_done');
  });

  it('reconstructs Shop instances with their inventories', () => {
    const shop = new Shop({ name: 'Trader Tova', type: 'general', level: 2 });
    const originalCount = shop.inventory.length;

    const result = saveAndReduce({ shopInventories: { town_shop: shop } }) as any;

    expect(result.shopInventories.town_shop).toBeInstanceOf(Shop);
    expect(result.shopInventories.town_shop.name).toBe('Trader Tova');
    expect(result.shopInventories.town_shop.inventory).toHaveLength(originalCount);
  });

  it('resets combat and interior state instead of restoring it', () => {
    const liveState = makeGameState();
    SaveManager.saveToSlot(SLOT_1, liveState);
    const payload = SaveManager.loadFromSlot(SLOT_1);

    const dirtyState = makeReducerState({
      combatState: { active: true, round: 2, turnOrder: [] },
      combatLog: ['Goblin attacks!'],
      inInterior: true,
      currentPOI: { name: 'Old Inn' },
      interiorMaps: { dungeon_1: [] },
    });
    const result = gameReducer(
      dirtyState as any,
      { type: ACTIONS.LOAD_GAME, payload } as any,
      ACTIONS
    ) as any;

    expect(result.combatState).toBeNull();
    expect(result.combatLog).toEqual([]);
    expect(result.inInterior).toBe(false);
    expect(result.currentPOI).toBeNull();
    expect(result.interiorMaps).toEqual({});
  });

  it('falls back to existing playerPosition when the save has none (old saves)', () => {
    const payload = { exploredHexes: [], discoveredPOIs: [] };
    const result = gameReducer(
      makeReducerState({ playerPosition: { col: 7, row: 8 } }) as any,
      { type: ACTIONS.LOAD_GAME, payload } as any,
      ACTIONS
    ) as any;

    expect(result.playerPosition).toEqual({ col: 7, row: 8 });
  });
});
