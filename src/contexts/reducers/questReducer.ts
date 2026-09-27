/**
 * Quest Reducer - Handles quest acceptance, progress, and completion
 *
 * Actions handled:
 * - ACCEPT_QUEST
 * - QUEST_EVENT
 * - COMPLETE_QUEST
 * - FAIL_QUEST
 *
 * acceptQuest / advanceQuests are also called from other reducers (picking up a quest
 * note in COLLECT_LOOT, clearing a site in END_COMBAT).
 */

import type { GameState, Action } from '../../types/state';
import {
  Quest as QuestModel,
  QuestStatus,
  ObjectiveType,
  type QuestConfig,
} from '../../game/Quest';
import { Item } from '../../game/Item';

// State declares quests with the lightweight types/game.ts interface; they are Quest instances.
const questsOf = (list: unknown[] | undefined) => (list ?? []) as unknown as QuestModel[];
const toState = (list: QuestModel[]) => list as unknown as GameState['activeQuests'];

/** Pay a finished quest's rewards and move it to the completed list. */
function completeQuest(state: GameState, questId: string): GameState {
  const quest = questsOf(state.activeQuests).find(q => q.id === questId);
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
    activeQuests: toState(questsOf(state.activeQuests).filter(q => q.id !== questId)),
    // Keep it a Quest instance: saves call toJSON() on every completed quest.
    completedQuests: toState([
      ...questsOf(state.completedQuests),
      Object.assign(QuestModel.fromJSON({ ...quest.toJSON(), status: QuestStatus.COMPLETED }), {
        completedAt: Date.now(),
      }),
    ]),
  };
}

/** Start a quest (once per id), handing over its items and marking its places on the map. */
export function acceptQuest(state: GameState, config: QuestConfig | QuestModel): GameState {
  const quest = QuestModel.fromJSON(config instanceof QuestModel ? config.toJSON() : config);
  const seen = [state.activeQuests, state.completedQuests, state.failedQuests].some(list =>
    questsOf(list).some(q => q.id === quest.id)
  );
  if (seen) return state;
  quest.status = QuestStatus.ACTIVE;

  let playerCharacter = state.playerCharacter;
  if (quest.grantItems.length > 0 && playerCharacter) {
    playerCharacter = playerCharacter.clone();
    playerCharacter.inventory.push(...quest.grantItems.map(cfg => new Item(cfg)));
  }

  return {
    ...state,
    playerCharacter,
    activeQuests: toState([...questsOf(state.activeQuests), quest]),
    exploredHexes: new Set([...state.exploredHexes, ...quest.reveal]),
    discoveredPOIs: new Set([...state.discoveredPOIs, ...quest.reveal]),
  };
}

/**
 * Advance objectives for something that happened in the world:
 *  - 'arrive' at a hex: VISIT objectives on it, and DELIVER objectives addressed to it
 *    when the player carries the item (which is handed over)
 *  - 'clear' a site: CLEAR objectives on it
 * Quests without a turn-in location complete as soon as every objective is done.
 */
export function advanceQuests(
  state: GameState,
  kind: 'arrive' | 'clear',
  hexKey: string
): GameState {
  let character = state.playerCharacter;
  let changed = false;

  const activeQuests = questsOf(state.activeQuests).map(quest => {
    const next = QuestModel.fromJSON(quest.toJSON());
    let touched = false;

    next.objectives.forEach(obj => {
      if (obj.current >= obj.required) return;
      const hit =
        (kind === 'clear' && obj.type === ObjectiveType.CLEAR && obj.target === hexKey) ||
        (kind === 'arrive' && obj.type === ObjectiveType.VISIT && obj.target === hexKey);

      if (hit) {
        obj.current = obj.required;
        touched = true;
      } else if (
        kind === 'arrive' &&
        obj.type === ObjectiveType.DELIVER &&
        obj.recipient === hexKey &&
        character?.inventory.some((item: Item) => item.name === obj.target)
      ) {
        if (character === state.playerCharacter) character = character.clone();
        character.inventory.splice(
          character.inventory.findIndex((item: Item) => item.name === obj.target),
          1
        );
        obj.current = obj.required;
        touched = true;
      }
    });

    if (touched) changed = true;
    return touched ? next : quest;
  });

  if (!changed) return state;

  let next: GameState = {
    ...state,
    playerCharacter: character,
    activeQuests: toState(activeQuests),
  };
  for (const quest of activeQuests) {
    if (!quest.turnInAt && quest.isComplete()) next = completeQuest(next, quest.id);
  }
  return next;
}

export function questReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): GameState | null {
  switch (action.type) {
    case ACTIONS.ACCEPT_QUEST:
      return acceptQuest(state, action.payload.quest);

    case ACTIONS.QUEST_EVENT:
      return advanceQuests(state, action.payload.kind, action.payload.hexKey);

    case ACTIONS.COMPLETE_QUEST:
      return completeQuest(state, action.payload.questId);

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

    default:
      return null; // Action not handled by this reducer
  }
}
