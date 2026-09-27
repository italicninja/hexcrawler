/**
 * QuestLog.tsx
 * Quest tracking UI component - displays active and completed quests as a journal page
 */

import { useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { Quest, type QuestObjective } from '../../game/Quest';
import PixelIcon from './PixelIcon';
import './QuestLog.css';

type Filter = 'active' | 'completed' | 'all';

export default function QuestLog() {
  const { state, dispatch, actions } = useGameState();
  const [filter, setFilter] = useState<Filter>('active');
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  // State declares quests via the lightweight game/game.ts Quest interface. Active quests
  // are Quest instances; completed ones are plain spread copies (see questReducer), so
  // progress is computed via the prototype rather than calling methods on the object.
  const activeQuests = state.activeQuests as unknown as Quest[];
  const completedQuests = state.completedQuests as unknown as Quest[];
  const progressOf = (quest: Quest) => Quest.prototype.getProgress.call(quest);
  const isCompleted = (quest: Quest) => completedQuests.includes(quest);

  const filteredQuests =
    filter === 'completed'
      ? completedQuests
      : filter === 'all'
        ? [...activeQuests, ...completedQuests]
        : activeQuests;
  const selectedQuest = filteredQuests.find(q => q.id === selectedQuestId) || filteredQuests[0];

  // Auto-select first quest if none selected
  if (!selectedQuest && filteredQuests.length > 0 && selectedQuestId !== filteredQuests[0]?.id) {
    setSelectedQuestId(filteredQuests[0].id);
  }

  const handleCompleteQuest = (questId: string) => {
    const quest = activeQuests.find(q => q.id === questId);
    if (quest && quest.isComplete()) {
      dispatch({
        type: actions.COMPLETE_QUEST,
        payload: { questId },
      });
    }
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeQuests.length },
    { id: 'completed', label: 'Completed', count: completedQuests.length },
    { id: 'all', label: 'All', count: activeQuests.length + completedQuests.length },
  ];

  const renderObjective = (objective: QuestObjective) => {
    const done = objective.current >= objective.required;
    return (
      <li key={objective.description} className={done ? 'questlog-done' : undefined}>
        <span className="questlog-check">{done && <PixelIcon name="check" label="Done" />}</span>
        <span className="questlog-objective">{objective.description}</span>
        <span className="jp-aside">
          {Math.min(objective.current, objective.required)} / {objective.required}
        </span>
      </li>
    );
  };

  const renderQuestDetails = (quest: Quest) => {
    const completed = isCompleted(quest);
    const readyToTurnIn = !completed && quest.status === 'active' && quest.isComplete();

    return (
      <article className="questlog-entry">
        <h3 className="questlog-title">{quest.title}</h3>
        {quest.description && <p className="jp-prose">{quest.description}</p>}

        <dl className="jp-rows">
          <div className="jp-row">
            <dt>Quest giver</dt>
            <dd>{quest.questGiver}</dd>
          </div>
          <div className="jp-row">
            <dt>Location</dt>
            <dd>{quest.location}</dd>
          </div>
          <div className="jp-row">
            <dt>Progress</dt>
            <dd>{completed ? 'Completed' : `${progressOf(quest)}%`}</dd>
          </div>
        </dl>

        <h4 className="jp-heading">Objectives</h4>
        <ul className="jp-list questlog-objectives">{quest.objectives.map(renderObjective)}</ul>

        <h4 className="jp-heading">Rewards</h4>
        <ul className="jp-rows">
          {quest.rewards.xp > 0 && (
            <li className="jp-row">
              <span>
                <PixelIcon name="star" /> Experience
              </span>
              <span>{quest.rewards.xp} XP</span>
            </li>
          )}
          {quest.rewards.gold > 0 && (
            <li className="jp-row">
              <span>
                <PixelIcon name="coins" /> Gold
              </span>
              <span>{quest.rewards.gold} gp</span>
            </li>
          )}
          {quest.rewards.items?.map((item, idx) => (
            <li key={idx} className="jp-row">
              <span>
                <PixelIcon name="gift" /> Item
              </span>
              <span>{item.name || item}</span>
            </li>
          ))}
        </ul>

        {readyToTurnIn && (
          <div className="jp-actions">
            <button
              type="button"
              className="jp-link jp-link--primary"
              onClick={() => handleCompleteQuest(quest.id)}
            >
              <PixelIcon name="check" /> Complete Quest
            </button>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="questlog">
      <div className="questlog-filters" role="group" aria-label="Filter quests">
        {filters.map(f => (
          <button
            key={f.id}
            type="button"
            className={`jp-link${filter === f.id ? ' jp-link--primary' : ''}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {filteredQuests.length === 0 ? (
        <p className="jp-prose jp-muted questlog-empty">
          No {filter === 'all' ? '' : `${filter} `}quests are written here yet. Speak with townsfolk
          and explore the wilds to take up new work.
        </p>
      ) : (
        <>
          {filteredQuests.length > 1 && (
            <>
              <h3 className="jp-heading">Entries</h3>
              <div className="jp-list">
                {filteredQuests.map(quest => (
                  <button
                    key={quest.id}
                    type="button"
                    className={selectedQuest?.id === quest.id ? 'is-selected' : undefined}
                    aria-pressed={selectedQuest?.id === quest.id}
                    onClick={() => setSelectedQuestId(quest.id)}
                  >
                    <span className="questlog-list-title">{quest.title}</span>
                    <span className="jp-aside">
                      {isCompleted(quest) ? 'completed' : `${progressOf(quest)}%`}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {selectedQuest && renderQuestDetails(selectedQuest)}
        </>
      )}
    </div>
  );
}
