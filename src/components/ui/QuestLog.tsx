/**
 * QuestLog.tsx
 * Quest tracking UI component - displays active and completed quests as a journal page.
 * Inside a settlement it also shows that settlement's quest board.
 */

import { useMemo, useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { Quest, type QuestObjective } from '../../game/Quest';
import { generateBoardQuests } from '../../game/QuestGenerator';
import { isSettlement } from '../../constants/gameConstants';
import PixelIcon from './PixelIcon';
import './QuestLog.css';

type Filter = 'board' | 'active' | 'completed' | 'all';

export default function QuestLog() {
  const { state, dispatch, actions } = useGameState();
  const town =
    state.inInterior && state.currentPOI && isSettlement(state.currentPOI.poi?.type)
      ? state.currentPOI
      : null;
  const [filter, setFilter] = useState<Filter>(town ? 'board' : 'active');
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  // State declares quests via the lightweight game/game.ts Quest interface. Active quests
  // are Quest instances; completed ones are plain spread copies (see questReducer), so
  // progress is computed via the prototype rather than calling methods on the object.
  const activeQuests = state.activeQuests as unknown as Quest[];
  const completedQuests = state.completedQuests as unknown as Quest[];
  const progressOf = (quest: Quest) => Quest.prototype.getProgress.call(quest);
  const isCompleted = (quest: Quest) => completedQuests.includes(quest);
  const hereKey = `${state.playerPosition.col},${state.playerPosition.row}`;

  // The board regenerates from seed + town + refresh period, so it isn't stored in state.
  // Jobs already taken (or finished) are left off.
  const { mapSeed, mapData, gameTime, explorationState, discoveredPOIs, failedQuests } = state;
  const level = state.playerCharacter?.level ?? 1;
  const boardQuests = useMemo(() => {
    if (!town) return [];
    const cleared = explorationState.clearedEncounters;
    const taken = new Set(
      [...activeQuests, ...completedQuests, ...(failedQuests as unknown as Quest[])].map(q => q.id)
    );
    return generateBoardQuests({
      seed: mapSeed,
      town: { col: town.col, row: town.row, name: town.poi.name, type: town.poi.type },
      world: mapData ?? [],
      level,
      day: gameTime.day,
      cleared: new Set([...(cleared.sites ?? []), ...(cleared.overworld ?? [])]),
      discovered: discoveredPOIs,
    }).filter(q => !taken.has(q.id));
  }, [
    town,
    mapSeed,
    mapData,
    level,
    gameTime.day,
    explorationState,
    discoveredPOIs,
    activeQuests,
    completedQuests,
    failedQuests,
  ]);
  const isOnBoard = (quest: Quest) => boardQuests.includes(quest);

  const filteredQuests =
    filter === 'board'
      ? boardQuests
      : filter === 'completed'
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

  const handleAcceptQuest = (quest: Quest) => {
    dispatch({ type: actions.ACCEPT_QUEST, payload: { quest } });
    setFilter('active');
    setSelectedQuestId(quest.id);
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    ...(town ? [{ id: 'board' as const, label: 'Board', count: boardQuests.length }] : []),
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
    const offered = isOnBoard(quest);
    const done = !completed && !offered && quest.isComplete();
    const readyToTurnIn = done && quest.turnInAt === hereKey;

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
          {!offered && (
            <div className="jp-row">
              <dt>Progress</dt>
              <dd>{completed ? 'Completed' : `${progressOf(quest)}%`}</dd>
            </div>
          )}
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

        {offered && (
          <div className="jp-actions">
            <button
              type="button"
              className="jp-link jp-link--primary"
              onClick={() => handleAcceptQuest(quest)}
            >
              <PixelIcon name="check" /> Accept
            </button>
          </div>
        )}

        {done && !readyToTurnIn && (
          <p className="jp-prose jp-muted">Return to {quest.location} to collect your reward.</p>
        )}

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
          {filter === 'board'
            ? 'Nothing is posted on the board right now. Check back in a few days.'
            : `No ${filter === 'all' ? '' : `${filter} `}quests are written here yet. Read the quest board in any settlement to take up new work.`}
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
                      {isOnBoard(quest)
                        ? `level ${quest.level}`
                        : isCompleted(quest)
                          ? 'completed'
                          : `${progressOf(quest)}%`}
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
