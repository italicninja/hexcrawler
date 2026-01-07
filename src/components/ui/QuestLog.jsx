/**
 * QuestLog.jsx
 * Quest tracking UI component - displays active and completed quests
 */

import { useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';

export default function QuestLog() {
  const { state, dispatch, actions } = useGameState();
  const [filter, setFilter] = useState('active'); // 'active', 'completed', 'all'
  const [selectedQuestId, setSelectedQuestId] = useState(null);

  const { activeQuests, completedQuests } = state;

  // Filter quests based on selected filter
  const getFilteredQuests = () => {
    switch (filter) {
      case 'active':
        return activeQuests;
      case 'completed':
        return completedQuests;
      case 'all':
        return [...activeQuests, ...completedQuests];
      default:
        return activeQuests;
    }
  };

  const filteredQuests = getFilteredQuests();
  const selectedQuest = filteredQuests.find(q => q.id === selectedQuestId) || filteredQuests[0];

  // Auto-select first quest if none selected
  if (!selectedQuest && filteredQuests.length > 0 && selectedQuestId !== filteredQuests[0]?.id) {
    setSelectedQuestId(filteredQuests[0].id);
  }

  // Handle quest completion check
  const handleCompleteQuest = (questId) => {
    const quest = activeQuests.find(q => q.id === questId);
    if (quest && quest.isComplete()) {
      dispatch({
        type: actions.COMPLETE_QUEST,
        payload: { questId }
      });
    }
  };

  // Render quest objective with progress
  const renderObjective = (objective) => {
    const percentage = Math.min((objective.current / objective.required) * 100, 100);
    const isComplete = objective.current >= objective.required;

    return (
      <div key={objective.description} className="quest-objective">
        <div className="objective-text">
          {isComplete && <span className="checkmark">✓ </span>}
          {objective.description}
        </div>
        <div className="objective-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="progress-text">
            {objective.current} / {objective.required}
          </span>
        </div>
      </div>
    );
  };

  // Render quest details
  const renderQuestDetails = (quest) => {
    if (!quest) {
      return (
        <div className="quest-details-empty">
          <p>No quests available</p>
          <p className="hint">Complete exploration activities to unlock quests!</p>
        </div>
      );
    }

    const progress = quest.getProgress();
    const isComplete = quest.isComplete();
    const isActive = quest.status === 'active';

    return (
      <div className="quest-details">
        <div className="quest-header">
          <h3>{quest.title}</h3>
          <span className={`quest-status status-${quest.status}`}>
            {quest.status.toUpperCase()}
          </span>
        </div>

        <div className="quest-info">
          <p className="quest-description">{quest.description}</p>

          <div className="quest-meta">
            <div className="meta-item">
              <strong>Quest Giver:</strong> {quest.questGiver}
            </div>
            <div className="meta-item">
              <strong>Location:</strong> {quest.location}
            </div>
          </div>
        </div>

        <div className="quest-objectives">
          <h4>Objectives</h4>
          {quest.objectives.map(renderObjective)}

          <div className="quest-progress-total">
            <strong>Overall Progress:</strong> {progress}%
          </div>
        </div>

        <div className="quest-rewards">
          <h4>Rewards</h4>
          <div className="rewards-list">
            {quest.rewards.xp > 0 && (
              <div className="reward-item">
                <span className="reward-icon">⭐</span>
                <span>{quest.rewards.xp} XP</span>
              </div>
            )}
            {quest.rewards.gold > 0 && (
              <div className="reward-item">
                <span className="reward-icon">💰</span>
                <span>{quest.rewards.gold} Gold</span>
              </div>
            )}
            {quest.rewards.items && quest.rewards.items.length > 0 && (
              quest.rewards.items.map((item, idx) => (
                <div key={idx} className="reward-item">
                  <span className="reward-icon">🎁</span>
                  <span>{item.name || item}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {isActive && isComplete && (
          <button
            className="complete-quest-button"
            onClick={() => handleCompleteQuest(quest.id)}
          >
            Complete Quest
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="quest-log" style={{ background: 'transparent', padding: 0 }}>
      <div className="quest-log-header" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 1rem 0' }}>Quest Log</h2>

        <div className="quest-filters">
          <button
            className={`filter-button ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active ({activeQuests.length})
          </button>
          <button
            className={`filter-button ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed ({completedQuests.length})
          </button>
          <button
            className={`filter-button ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({activeQuests.length + completedQuests.length})
          </button>
        </div>
      </div>

      <div className="quest-log-body">
        <div className="quest-list">
          {filteredQuests.length === 0 ? (
            <div className="quest-list-empty">
              <p>No {filter} quests</p>
            </div>
          ) : (
            filteredQuests.map(quest => (
              <div
                key={quest.id}
                className={`quest-list-item ${selectedQuestId === quest.id ? 'selected' : ''}`}
                onClick={() => setSelectedQuestId(quest.id)}
              >
                <div className="quest-list-title">{quest.title}</div>
                <div className="quest-list-meta">
                  <span className={`status-badge status-${quest.status}`}>
                    {quest.status}
                  </span>
                  <span className="progress-badge">
                    {quest.getProgress()}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="quest-details-panel">
          {renderQuestDetails(selectedQuest)}
        </div>
      </div>

      <style>{`
        .quest-log {
          display: flex;
          flex-direction: column;
          min-height: 500px;
          color: var(--text-color);
        }

        .quest-log-header {
          margin-bottom: 1rem;
        }

        .quest-log-header h2 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
          color: var(--accent-color);
        }

        .quest-filters {
          display: flex;
          gap: 0.5rem;
        }

        .filter-button {
          padding: 0.5rem 1rem;
          background: var(--bg-lighter);
          border: 1px solid var(--border-color);
          color: var(--text-color);
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 4px;
        }

        .filter-button:hover {
          background: var(--bg-light);
        }

        .filter-button.active {
          background: var(--primary-color);
          border-color: var(--accent-color);
          color: var(--text-color);
        }

        .quest-log-body {
          display: flex;
          gap: 1rem;
          flex: 1;
          overflow: hidden;
        }

        .quest-list {
          flex: 0 0 250px;
          overflow-y: auto;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 0.5rem;
        }

        .quest-list-empty {
          padding: 2rem 1rem;
          text-align: center;
          color: var(--text-muted);
        }

        .quest-list-item {
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: var(--bg-lighter);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quest-list-item:hover {
          background: var(--bg-light);
          border-color: var(--text-muted);
        }

        .quest-list-item.selected {
          background: var(--primary-color);
          border-color: var(--accent-color);
        }

        .quest-list-title {
          font-weight: bold;
          margin-bottom: 0.25rem;
          color: var(--text-color);
        }

        .quest-list-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
        }

        .status-badge {
          padding: 0.125rem 0.5rem;
          border-radius: 3px;
          text-transform: uppercase;
          font-size: 0.7rem;
          font-weight: bold;
        }

        .status-badge.status-active {
          background: rgba(100, 200, 100, 0.3);
          color: #90ee90;
        }

        .status-badge.status-completed {
          background: rgba(100, 100, 200, 0.3);
          color: #87ceeb;
        }

        .status-badge.status-failed {
          background: rgba(200, 100, 100, 0.3);
          color: #ff6b6b;
        }

        .progress-badge {
          color: #ffd700;
        }

        .quest-details-panel {
          flex: 1;
          overflow-y: auto;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 1rem;
        }

        .quest-details-empty {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--text-muted);
        }

        .quest-details-empty .hint {
          font-size: 0.9rem;
          margin-top: 0.5rem;
          font-style: italic;
        }

        .quest-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-color);
        }

        .quest-header h3 {
          margin: 0;
          color: var(--accent-color);
          font-size: 1.3rem;
        }

        .quest-status {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: bold;
        }

        .quest-status.status-active {
          background: rgba(100, 200, 100, 0.3);
          color: #90ee90;
        }

        .quest-status.status-completed {
          background: rgba(100, 100, 200, 0.3);
          color: #87ceeb;
        }

        .quest-status.status-failed {
          background: rgba(200, 100, 100, 0.3);
          color: #ff6b6b;
        }

        .quest-info {
          margin-bottom: 1.5rem;
        }

        .quest-description {
          margin-bottom: 1rem;
          line-height: 1.5;
          color: var(--text-light);
        }

        .quest-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.9rem;
          color: var(--text-muted);
        }

        .meta-item strong {
          color: var(--accent-color);
        }

        .quest-objectives {
          margin-bottom: 1.5rem;
        }

        .quest-objectives h4 {
          margin: 0 0 0.75rem 0;
          color: var(--accent-color);
          font-size: 1.1rem;
        }

        .quest-objective {
          margin-bottom: 0.75rem;
          padding: 0.5rem;
          background: var(--bg-lighter);
          border-radius: 4px;
        }

        .objective-text {
          margin-bottom: 0.5rem;
          color: var(--text-light);
        }

        .checkmark {
          color: #90ee90;
          font-weight: bold;
        }

        .objective-progress {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .progress-bar {
          flex: 1;
          height: 12px;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.85rem;
          color: var(--text-muted);
          min-width: 60px;
          text-align: right;
        }

        .quest-progress-total {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-color);
          color: var(--accent-color);
          font-size: 0.95rem;
        }

        .quest-rewards {
          margin-bottom: 1.5rem;
        }

        .quest-rewards h4 {
          margin: 0 0 0.75rem 0;
          color: var(--accent-color);
          font-size: 1.1rem;
        }

        .rewards-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .reward-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--bg-lighter);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-color);
        }

        .reward-icon {
          font-size: 1.2rem;
        }

        .complete-quest-button {
          width: 100%;
          padding: 0.75rem;
          background: linear-gradient(135deg, #4CAF50, #45a049);
          border: none;
          color: white;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .complete-quest-button:hover {
          background: linear-gradient(135deg, #45a049, #3d8b40);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }

        .complete-quest-button:active {
          transform: translateY(0);
        }

        /* Scrollbar styling */
        .quest-list::-webkit-scrollbar,
        .quest-details-panel::-webkit-scrollbar {
          width: 8px;
        }

        .quest-list::-webkit-scrollbar-track,
        .quest-details-panel::-webkit-scrollbar-track {
          background: var(--bg-color);
          border-radius: 4px;
        }

        .quest-list::-webkit-scrollbar-thumb,
        .quest-details-panel::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 4px;
        }

        .quest-list::-webkit-scrollbar-thumb:hover,
        .quest-details-panel::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
