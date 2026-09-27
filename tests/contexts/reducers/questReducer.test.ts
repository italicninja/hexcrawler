/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { questReducer } from '../../../src/contexts/reducers/questReducer';
import { Quest, QuestStatus } from '../../../src/game/Quest';
import type { GameState } from '../../../src/types/state';
import { combinedReducer } from '../../../src/contexts/reducers';
import { ACTIONS as ACTIONS_ALL } from '../../../src/contexts/GameStateContext';
import { createInitialState } from '../../../src/contexts/initialState';
import { Character } from '../../../src/game/Character';
import { Item } from '../../../src/game/Item';

const ACTIONS = { COMPLETE_QUEST: 'COMPLETE_QUEST' };

describe('questReducer COMPLETE_QUEST', () => {
  it('keeps the completed quest a serializable Quest instance', () => {
    const quest = new Quest({
      id: 'q1',
      title: 'Clear the cellar',
      objectives: [
        { type: 'kill', target: 'rat', description: 'Kill rats', current: 3, required: 3 },
      ],
      rewards: { xp: 0, gold: 0, items: [] },
      status: QuestStatus.ACTIVE,
    });
    const state = { activeQuests: [quest], completedQuests: [] } as unknown as GameState;

    const next = questReducer(
      state,
      { type: 'COMPLETE_QUEST', payload: { questId: 'q1' } },
      ACTIONS
    );
    const done = next!.completedQuests[0] as unknown as Quest & { completedAt: number };

    expect(next!.activeQuests).toHaveLength(0);
    expect(done).toBeInstanceOf(Quest);
    expect(done.status).toBe(QuestStatus.COMPLETED);
    expect(typeof done.completedAt).toBe('number');
    // SaveManager serializes completed quests with toJSON(); this threw on plain objects.
    expect(done.toJSON().title).toBe('Clear the cellar');
  });
});

describe('quest flow through the combined reducer', () => {
  const reduce = (state: any, type: string, payload: unknown) =>
    combinedReducer(state, { type, payload }, ACTIONS_ALL) as any;
  const start = () => ({
    ...createInitialState(),
    playerCharacter: new Character('Tess', 'barbarian'),
  });

  const letterQuest = new Quest({
    id: 'board:1,1:0:0',
    title: 'Letter to Oakmoor',
    objectives: [Quest.createDeliverObjective('Sealed Letter for Oakmoor', '9,9', 'Deliver it')],
    rewards: { xp: 40, gold: 30, items: [] },
    grantItems: [{ name: 'Sealed Letter for Oakmoor', type: 'quest' }],
  });

  it('accepting hands over quest items, and arriving delivers them and pays out', () => {
    const accepted = reduce(start(), ACTIONS_ALL.ACCEPT_QUEST, { quest: letterQuest });
    const gold = accepted.playerCharacter.gold;
    expect(
      accepted.playerCharacter.inventory.some((i: any) => i.name === 'Sealed Letter for Oakmoor')
    ).toBe(true);
    // Accepting twice is a no-op
    expect(
      reduce(accepted, ACTIONS_ALL.ACCEPT_QUEST, { quest: letterQuest }).activeQuests
    ).toHaveLength(1);

    const elsewhere = reduce(accepted, ACTIONS_ALL.QUEST_EVENT, { kind: 'arrive', hexKey: '5,5' });
    expect(elsewhere).toBe(accepted);

    const delivered = reduce(accepted, ACTIONS_ALL.QUEST_EVENT, { kind: 'arrive', hexKey: '9,9' });
    expect(delivered.activeQuests).toHaveLength(0);
    expect(delivered.completedQuests[0].id).toBe(letterQuest.id);
    expect(delivered.playerCharacter.gold).toBe(gold + 30);
    expect(
      delivered.playerCharacter.inventory.some((i: any) => i.name === 'Sealed Letter for Oakmoor')
    ).toBe(false);
  });

  it('a delivery without the item does not count', () => {
    const accepted = reduce(start(), ACTIONS_ALL.ACCEPT_QUEST, { quest: letterQuest });
    accepted.playerCharacter.inventory = [];
    expect(
      reduce(accepted, ACTIONS_ALL.QUEST_EVENT, {
        kind: 'arrive',
        hexKey: '9,9',
      }).activeQuests[0].isComplete()
    ).toBe(false);
  });

  it('board quests wait to be handed in; reveals mark the map', () => {
    const scout = new Quest({
      id: 'scout',
      objectives: [Quest.createVisitObjective('3,3', 'Find it')],
      rewards: { xp: 10, gold: 0, items: [] },
      turnInAt: '1,1',
      reveal: ['3,3'],
    });
    const accepted = reduce(start(), ACTIONS_ALL.ACCEPT_QUEST, { quest: scout });
    expect(accepted.discoveredPOIs.has('3,3')).toBe(true);
    expect(accepted.exploredHexes.has('3,3')).toBe(true);

    const found = reduce(accepted, ACTIONS_ALL.QUEST_EVENT, { kind: 'arrive', hexKey: '3,3' });
    expect(found.activeQuests[0].isComplete()).toBe(true);
    expect(found.completedQuests).toHaveLength(0);
  });

  it('picking up a quest note starts its quest', () => {
    const note = Object.assign(new Item({ name: 'Tattered Note', type: 'quest' }), {
      quest: new Quest({ id: 'note:survival', title: 'Reach Safety' }).toJSON(),
    });
    const after = reduce(start(), ACTIONS_ALL.COLLECT_LOOT, { items: [note], gold: 0 });
    expect(after.activeQuests.map((q: Quest) => q.id)).toEqual(['note:survival']);
    expect(after.activeQuests[0]).toBeInstanceOf(Quest);
  });
});
