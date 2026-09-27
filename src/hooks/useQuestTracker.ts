/**
 * useQuestTracker — writes quest changes to the game log: new quests, finished objectives,
 * quests ready to hand in, and completions. It watches state rather than each dispatch
 * site, so notes, boards, movement and combat are all covered in one place.
 */
import { useEffect, useRef } from 'react';
import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import type { Quest } from '../game/Quest';

interface Snapshot {
  active: Map<string, Quest>;
  completed: Set<string>;
  hexGrid: unknown;
}

export function useQuestTracker() {
  const { state } = useGameState();
  const { addMessage } = useGameLog();
  const prev = useRef<Snapshot | null>(null);

  useEffect(() => {
    const active = state.activeQuests as unknown as Quest[];
    const completed = state.completedQuests as unknown as Quest[];
    const before = prev.current;
    prev.current = {
      active: new Map(active.map(q => [q.id, q])),
      completed: new Set(completed.map(q => q.id)),
      hexGrid: state.hexGrid,
    };
    // First render, or a save was loaded (LOAD_GAME builds a new hexGrid): nothing is "new".
    if (!before || before.hexGrid !== state.hexGrid) return;

    for (const quest of active) {
      const was = before.active.get(quest.id);
      if (!was) {
        addMessage(`New quest: ${quest.title}`, 'discovery');
        continue;
      }
      quest.objectives.forEach((obj, i) => {
        const old = was.objectives[i];
        if (obj.current >= obj.required && old && old.current < old.required) {
          addMessage(`Objective complete: ${obj.description}`, 'success');
        }
      });
      if (quest.isComplete() && !was.isComplete()) {
        addMessage(
          `${quest.title} is done. Return to ${quest.location} for your reward.`,
          'success'
        );
      }
    }

    for (const quest of completed) {
      if (before.completed.has(quest.id)) continue;
      const { xp, gold } = quest.rewards;
      const reward = [xp && `${xp} XP`, gold && `${gold} gold`].filter(Boolean).join(', ');
      addMessage(`Quest complete: ${quest.title}${reward ? ` (${reward})` : ''}`, 'success');
    }
  }, [state.activeQuests, state.completedQuests, state.hexGrid, addMessage]);
}
