import { describe, it, expect } from 'vitest';
import { combinedReducer } from '../../../src/contexts/reducers';
import { ACTIONS } from '../../../src/contexts/GameStateContext';
import { createInitialState } from '../../../src/contexts/initialState';
import { Character } from '../../../src/game/Character';
import { Party } from '../../../src/game/Party';
import { stepCR, formatCR } from '../../../src/constants/gameConstants';

/** State mid-fight: the player clone took damage and spent a Rage. */
function fightState(source: unknown) {
  const pc = new Character('Grog', 'barbarian');
  const fought = pc.clone();
  fought.currentHP = 3;
  fought.abilities_list.find(a => a.name === 'Rage')!.uses = 1;
  const entry = { id: 'ally-0', isAlly: true, isPlayer: true, currentHP: 3, character: fought };
  const state = createInitialState();
  return {
    pc,
    state: {
      ...state,
      playerCharacter: pc,
      interiorMaps: { '4,4': { encounters: [{ col: 2, row: 3, defeated: false }] } },
      combatState: {
        ...state.combatState!,
        active: true,
        turnOrder: [entry],
        combat: { turnOrder: [entry] },
        encounterSource: source,
      },
    } as any,
  };
}

const reduce = (state: any, action: any) => combinedReducer(state, action, ACTIONS);

describe('END_COMBAT on victory', () => {
  it('writes the fight HP and spent resources back to the player', () => {
    const { pc, state } = fightState(null);
    const after = reduce(state, { type: ACTIONS.END_COMBAT, payload: { victory: true } });
    expect(after.playerCharacter.currentHP).toBe(3);
    expect(after.playerCharacter.abilities_list.find((a: any) => a.name === 'Rage').uses).toBe(1);
    expect(pc.currentHP).toBe(pc.maxHP); // previous instance untouched
    expect(after.combatState).toBeNull();
  });

  it('revives a downed player at 1 HP when the party still won', () => {
    const { state } = fightState(null);
    state.combatState.turnOrder[0].currentHP = 0;
    const after = reduce(state, { type: ACTIONS.END_COMBAT, payload: { victory: true } });
    expect(after.playerCharacter.currentHP).toBe(1);
  });

  it('clears an overworld POI so it cannot be farmed', () => {
    const { state } = fightState({ kind: 'poi', col: 7, row: 9 });
    const after = reduce(state, { type: ACTIONS.END_COMBAT, payload: { victory: true } });
    expect(after.explorationState.clearedEncounters.overworld.has('7,9')).toBe(true);
  });

  it('marks an interior encounter defeated and remembers it for regenerated floors', () => {
    const source = { kind: 'interior', mapKey: '4,4', floorKey: '4,4:floor0', col: 2, row: 3 };
    const { state } = fightState(source);
    const after = reduce(state, { type: ACTIONS.END_COMBAT, payload: { victory: true } });
    expect(after.interiorMaps['4,4'].encounters[0].defeated).toBe(true);

    const regenerated = { encounters: [{ col: 2, row: 3, defeated: false }] };
    const reloaded = reduce(
      { ...after, currentFloor: 0 },
      { type: ACTIONS.SET_INTERIOR_MAP, payload: { key: '4,4', map: regenerated } }
    );
    expect(reloaded.interiorMaps['4,4'].encounters[0].defeated).toBe(true);
  });
});

describe('party.player stays in sync with playerCharacter', () => {
  it('follows every character update', () => {
    const pc = new Character('Grog', 'barbarian');
    const party = new Party();
    party.setPlayer(pc);
    const state = { ...createInitialState(), playerCharacter: pc, party } as any;
    const updated = pc.clone();
    updated.level = 3;
    const after = reduce(state, { type: ACTIONS.UPDATE_CHARACTER, payload: updated });
    expect(after.party.player).toBe(updated);
    expect(after.party).toBeInstanceOf(Party);
    expect(party.player).toBe(pc); // old party not mutated
  });
});

describe('SEARCH_POI', () => {
  it('records the POI as searched', () => {
    const after = reduce(createInitialState(), { type: ACTIONS.SEARCH_POI, payload: '3,5' });
    expect(after.explorationState.searchedPOIs.has('3,5')).toBe(true);
  });
});

describe('CR helpers', () => {
  it('steps along the CR ladder and formats fractions', () => {
    expect(stepCR(0.125, 2)).toBe(0.5);
    expect(stepCR(3, 2)).toBe(5);
    expect(stepCR(30, 2)).toBe(30);
    expect(formatCR(0.125)).toBe('1/8');
    expect(formatCR(0.5)).toBe('1/2');
    expect(formatCR(4)).toBe('4');
  });
});
