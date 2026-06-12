import { describe, it, expect, vi } from 'vitest';
import { characterReducer } from '../../../src/contexts/reducers/characterReducer';

// ─── Minimal mock setup ───────────────────────────────────────────────────────
// characterReducer imports advanceTime, applyStarvation, Character, TIME, FEATURES
// We mock the heavy game modules so tests stay fast and isolated.

vi.mock('../../../src/game/TimeManager', () => ({
  advanceTime: vi.fn((_time: unknown, _mins: number) => ({
    day: 1,
    hour: 8,
    minute: 0,
  })),
}));

vi.mock('../../../src/game/SurvivalManager', () => ({
  applyStarvation: vi.fn(),
}));

vi.mock('../../../src/constants/gameConstants', () => ({
  TIME: {
    SHORT_REST_MINUTES: 60,
    LONG_REST_MINUTES: 480,
    INN_REST_MINUTES: 480,
  },
  FEATURES: {
    SURVIVAL_ENABLED: false,
  },
}));

vi.mock('../../../src/game/Character', () => ({
  Character: {
    fromJSON: vi.fn((json: Record<string, unknown>) => ({
      ...(json as Record<string, unknown>),
      awardXP: vi.fn(function (this: Record<string, unknown>, amount: number) {
        (this as Record<string, unknown>).xp =
          ((this as Record<string, unknown>).xp as number) + amount;
      }),
      levelUp: vi.fn(),
      toJSON: vi.fn(function (this: Record<string, unknown>) {
        return { ...this };
      }),
      level: 1,
      xp: 0,
    })),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTIONS = {
  SET_PLAYER_CHARACTER: 'SET_PLAYER_CHARACTER',
  SET_PARTY: 'SET_PARTY',
  UPDATE_CHARACTER: 'UPDATE_CHARACTER',
  SHORT_REST: 'SHORT_REST',
  LONG_REST: 'LONG_REST',
  INN_REST: 'INN_REST',
  AWARD_XP: 'AWARD_XP',
  LEVEL_UP_CHARACTER: 'LEVEL_UP_CHARACTER',
  APPLY_EXHAUSTION: 'APPLY_EXHAUSTION',
};

function makeState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    playerCharacter: null,
    party: [],
    gameTime: { day: 1, hour: 6, minute: 0 },
    leveledUp: false,
    ...overrides,
  };
}

function makeCharacterStub(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Hero',
    level: 1,
    xp: 0,
    xpToNextLevel: 300,
    exhaustionLevel: 0,
    toJSON: vi.fn(function (this: Record<string, unknown>) {
      return { ...this };
    }),
    clone: vi.fn(function (this: Record<string, unknown>) {
      return { ...this };
    }),
    awardXP: vi.fn(),
    shouldLevelUp: vi.fn(() => false),
    ...overrides,
  };
}

// ─── SET_PLAYER_CHARACTER ────────────────────────────────────────────────────

describe('characterReducer — SET_PLAYER_CHARACTER', () => {
  it('sets the playerCharacter from payload', () => {
    const character = makeCharacterStub();
    const state = makeState();
    const result = characterReducer(
      state as any,
      { type: ACTIONS.SET_PLAYER_CHARACTER, payload: character } as any,
      ACTIONS
    );
    expect(result?.playerCharacter).toBe(character);
  });
});

// ─── SET_PARTY ────────────────────────────────────────────────────────────────

describe('characterReducer — SET_PARTY', () => {
  it('sets the party array from payload', () => {
    const party = [makeCharacterStub(), makeCharacterStub({ name: 'Ally' })];
    const state = makeState();
    const result = characterReducer(
      state as any,
      { type: ACTIONS.SET_PARTY, payload: party } as any,
      ACTIONS
    );
    expect(result?.party).toEqual(party);
  });
});

// ─── UPDATE_CHARACTER ────────────────────────────────────────────────────────

describe('characterReducer — UPDATE_CHARACTER', () => {
  it('replaces playerCharacter with payload', () => {
    const newChar = makeCharacterStub({ name: 'Updated' });
    const state = makeState({ playerCharacter: makeCharacterStub() });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.UPDATE_CHARACTER, payload: newChar } as any,
      ACTIONS
    );
    expect(result?.playerCharacter).toBe(newChar);
  });
});

// ─── SHORT_REST ───────────────────────────────────────────────────────────────

describe('characterReducer — SHORT_REST', () => {
  it('updates playerCharacter and advances game time', () => {
    const character = makeCharacterStub();
    const state = makeState({ playerCharacter: makeCharacterStub() });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.SHORT_REST, payload: { character } } as any,
      ACTIONS
    );
    expect(result?.playerCharacter).toBe(character);
    expect(result?.gameTime).toBeDefined();
  });

  it('preserves other state fields', () => {
    const character = makeCharacterStub();
    const state = makeState({ party: ['memberA'], playerCharacter: character });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.SHORT_REST, payload: { character } } as any,
      ACTIONS
    );
    expect(result?.party).toEqual(['memberA']);
  });
});

// ─── LONG_REST ────────────────────────────────────────────────────────────────

describe('characterReducer — LONG_REST', () => {
  it('updates playerCharacter and advances game time', () => {
    const character = makeCharacterStub();
    const state = makeState({ playerCharacter: makeCharacterStub() });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.LONG_REST, payload: { character } } as any,
      ACTIONS
    );
    expect(result?.playerCharacter).toBe(character);
    expect(result?.gameTime).toBeDefined();
  });
});

// ─── INN_REST ────────────────────────────────────────────────────────────────

describe('characterReducer — INN_REST', () => {
  it('updates playerCharacter and advances game time', () => {
    const character = makeCharacterStub();
    const state = makeState({ playerCharacter: makeCharacterStub() });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.INN_REST, payload: { character } } as any,
      ACTIONS
    );
    expect(result?.playerCharacter).toBe(character);
    expect(result?.gameTime).toBeDefined();
  });
});

// ─── LEVEL_UP_CHARACTER ───────────────────────────────────────────────────────

describe('characterReducer — LEVEL_UP_CHARACTER', () => {
  it('sets playerCharacter and clears leveledUp flag', () => {
    const character = makeCharacterStub({ level: 2 });
    const state = makeState({ leveledUp: true });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.LEVEL_UP_CHARACTER, payload: { character } } as any,
      ACTIONS
    );
    expect(result?.playerCharacter).toBe(character);
    expect(result?.leveledUp).toBe(false);
  });
});

// ─── APPLY_EXHAUSTION ────────────────────────────────────────────────────────

describe('characterReducer — APPLY_EXHAUSTION', () => {
  it('returns state unchanged when no playerCharacter', () => {
    const state = makeState({ playerCharacter: null });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.APPLY_EXHAUSTION, payload: { levels: 2 } } as any,
      ACTIONS
    );
    expect(result).toEqual(state);
  });

  it('adds exhaustion levels on a clone, leaving the original untouched', () => {
    const character = makeCharacterStub({ exhaustionLevel: 1 });
    const state = makeState({ playerCharacter: character });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.APPLY_EXHAUSTION, payload: { levels: 2 } } as any,
      ACTIONS
    ) as any;
    expect(result.playerCharacter.exhaustionLevel).toBe(3);
    expect(character.exhaustionLevel).toBe(1);
  });

  it('caps exhaustion at 6 (death in 5e terms)', () => {
    const character = makeCharacterStub({ exhaustionLevel: 4 });
    const state = makeState({ playerCharacter: character });
    const result = characterReducer(
      state as any,
      { type: ACTIONS.APPLY_EXHAUSTION, payload: { levels: 9 } } as any,
      ACTIONS
    ) as any;
    expect(result.playerCharacter.exhaustionLevel).toBe(6);
  });
});

// ─── Unhandled action ────────────────────────────────────────────────────────

describe('characterReducer — unhandled action', () => {
  it('returns null for unrecognised action types', () => {
    const state = makeState();
    const result = characterReducer(
      state as any,
      { type: 'UNKNOWN_ACTION', payload: {} } as any,
      ACTIONS
    );
    expect(result).toBeNull();
  });
});
