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

import Quest from '../../game/Quest';

export function questReducer(state, action, ACTIONS) {
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

      // Award rewards
      let newState = { ...state };

      if (quest.rewards.gold && state.playerCharacter) {
        state.playerCharacter.gold += quest.rewards.gold;
        newState.playerCharacter = state.playerCharacter;
      }

      if (quest.rewards.xp && state.playerCharacter) {
        state.playerCharacter.gainXP(quest.rewards.xp);
        newState.playerCharacter = state.playerCharacter;
      }

      // Move to completed
      newState.activeQuests = state.activeQuests?.filter(q => q.id !== questId) || [];
      newState.completedQuests = [
        ...(state.completedQuests || []),
        { ...quest, completedAt: Date.now() },
      ];

      return newState;
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
