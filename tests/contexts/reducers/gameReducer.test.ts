import { describe, it, expect, afterEach } from 'vitest';
import { gameReducer } from '../../../src/contexts/reducers/gameReducer';
import { Character } from '../../../src/game/Character';
import { FEATURES } from '../../../src/constants/gameConstants';
import type { GameState } from '../../../src/types/state';

const ACTIONS = { ADVANCE_TIME: 'ADVANCE_TIME' };
const survival = FEATURES.SURVIVAL_ENABLED;

describe('gameReducer ADVANCE_TIME', () => {
  afterEach(() => {
    (FEATURES as { SURVIVAL_ENABLED: boolean }).SURVIVAL_ENABLED = survival;
  });

  const run = (hour: number, minutes: number) => {
    const hero = new Character('Tess', 'barbarian');
    hero.rations = 5;
    const state = { gameTime: { day: 1, hour, minute: 0 }, playerCharacter: hero } as unknown as GameState;
    const next = gameReducer(state, { type: 'ADVANCE_TIME', payload: minutes }, ACTIONS)!;
    return { hero, next };
  };

  it('eats one ration per midnight crossed, not per action', () => {
    (FEATURES as { SURVIVAL_ENABLED: boolean }).SURVIVAL_ENABLED = true;

    expect(run(8, 120).next.playerCharacter.rations).toBe(5); // same day
    expect(run(23, 120).next.playerCharacter.rations).toBe(4); // crosses midnight
    const { hero, next } = run(8, 3 * 1440);
    expect(next.playerCharacter.rations).toBe(2);
    expect(hero.rations).toBe(5); // state's instance untouched (clone-then-mutate)
  });

  it('leaves rations alone when survival is off', () => {
    (FEATURES as { SURVIVAL_ENABLED: boolean }).SURVIVAL_ENABLED = false;
    expect(run(23, 1440).next.playerCharacter.rations).toBe(5);
  });
});
