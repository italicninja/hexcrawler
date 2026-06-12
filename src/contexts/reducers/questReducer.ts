/**
 * Quest Reducer - Handles quest acceptance, progress, and completion
 *
 * Actions handled:
 * - ACCEPT_QUEST
 * - UPDATE_QUEST_PROGRESS
 * - COMPLETE_QUEST
 * - FAIL_QUEST
 * - GENERATE_TOWN_QUESTS
 * - REFRESH_QUESTS
 */

import type { GameState, Action } from '../../types/state';

export function questReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): GameState | null {
  switch (action.type) {
    case ACTIONS.ACCEPT_QUEST: {
      const { quest } = action.payload;

      return {
        ...state,
        activeQuests: [...(state.activeQuests || []), quest],
        availableQuests: state.availableQuests?.filter(q => q.id !== quest.id) || [],
      };
    }

    case ACTIONS.UPDATE_QUEST_PROGRESS: {
      const { questId, progress } = action.payload;

      const activeQuests =
        state.activeQuests?.map(q => {
          if (q.id === questId) {
            return { ...q, progress };
          }
          return q;
        }) || [];

      return {
        ...state,
        activeQuests,
      };
    }

    case ACTIONS.COMPLETE_QUEST: {
      const { questId } = action.payload;

      const quest = state.activeQuests?.find(q => q.id === questId);
      if (!quest) return state;

      let updatedCharacter = state.playerCharacter;

      // Apply rewards immutably
      if ((quest.rewards.gold || quest.rewards.xp) && state.playerCharacter) {
        const character = state.playerCharacter.clone();
        if (quest.rewards.gold) {
          character.gold += quest.rewards.gold;
        }
        if (quest.rewards.xp) {
          character.awardXP(quest.rewards.xp);
        }
        updatedCharacter = character;
      }

      return {
        ...state,
        playerCharacter: updatedCharacter,
        activeQuests: state.activeQuests?.filter(q => q.id !== questId) || [],
        completedQuests: [...(state.completedQuests || []), { ...quest, completedAt: Date.now() }],
      };
    }

    case ACTIONS.FAIL_QUEST: {
      const { questId } = action.payload;

      const quest = state.activeQuests?.find(q => q.id === questId);
      if (!quest) return state;

      return {
        ...state,
        activeQuests: state.activeQuests?.filter(q => q.id !== questId) || [],
        failedQuests: [...(state.failedQuests || []), { ...quest, failedAt: Date.now() }],
      };
    }

    case ACTIONS.GENERATE_TOWN_QUESTS: {
      const { quests } = action.payload;

      return {
        ...state,
        availableQuests: quests,
      };
    }

    case ACTIONS.REFRESH_QUESTS: {
      const { quests } = action.payload;

      return {
        ...state,
        availableQuests: quests,
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
