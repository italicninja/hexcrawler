import { describe, it, expect } from 'vitest';
import { questReducer } from '../../../src/contexts/reducers/questReducer';
import { Quest, QuestStatus } from '../../../src/game/Quest';
import type { GameState } from '../../../src/types/state';

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
