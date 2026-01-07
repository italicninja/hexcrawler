/**
 * QuestGiverUI.jsx - Quest Giver Dialog Component
 * Part of D&D 5e Hexcrawler - Task 4.4 (Quest Givers)
 *
 * Displays available quests from NPCs in towns
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import './QuestGiverUI.css';

function QuestGiverUI({ questGiver, availableQuests = [], onClose, onAcceptQuest }) {
  const { state } = useGameState();
  const [selectedQuest, setSelectedQuest] = useState(null);

  if (!questGiver) {
    return null;
  }

  const handleAccept = (quest) => {
    if (onAcceptQuest) {
      onAcceptQuest(quest);
      setSelectedQuest(null);
    }
  };

  const getQuestLevelColor = (questLevel, playerLevel) => {
    const diff = questLevel - playerLevel;
    if (diff <= -2) return '#666'; // Gray (trivial)
    if (diff === -1) return '#4a9eff'; // Blue (easy)
    if (diff === 0) return '#4aff4a'; // Green (appropriate)
    if (diff === 1) return '#ffff4a'; // Yellow (challenging)
    if (diff >= 2) return '#ff4a4a'; // Red (dangerous)
    return '#fff';
  };

  return (
    <div className="quest-giver-overlay">
      <div className="quest-giver-modal">
        {/* Header */}
        <div className="quest-giver-header">
          <h2>{questGiver.name || 'Quest Giver'}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* NPC Dialogue */}
        <div className="quest-giver-dialogue">
          <p>{questGiver.dialogue || getDefaultDialogue(questGiver.name)}</p>
        </div>

        {/* Quest List */}
        <div className="quest-list-container">
          <h3>Available Quests</h3>

          {availableQuests.length === 0 ? (
            <div className="no-quests">
              <p>No quests available at the moment. Check back later!</p>
            </div>
          ) : (
            <div className="quest-list">
              {availableQuests.map((quest, index) => (
                <div
                  key={quest.id || index}
                  className={`quest-card ${selectedQuest?.id === quest.id ? 'selected' : ''}`}
                  onClick={() => setSelectedQuest(quest)}
                >
                  <div className="quest-card-header">
                    <h4>{quest.title}</h4>
                    <span
                      className="quest-level-badge"
                      style={{ color: getQuestLevelColor(quest.level, state.playerCharacter?.level || 1) }}
                    >
                      Level {quest.level}
                    </span>
                  </div>

                  <p className="quest-description">{quest.description}</p>

                  {/* Objectives Preview */}
                  <div className="quest-objectives-preview">
                    <strong>Objectives:</strong>
                    <ul>
                      {quest.objectives.slice(0, 2).map((obj, i) => (
                        <li key={i}>{obj.description}</li>
                      ))}
                      {quest.objectives.length > 2 && (
                        <li>...and {quest.objectives.length - 2} more</li>
                      )}
                    </ul>
                  </div>

                  {/* Rewards Preview */}
                  <div className="quest-rewards-preview">
                    <strong>Rewards:</strong>
                    <div className="reward-items">
                      {quest.rewards.xp > 0 && (
                        <span className="reward-item xp">{quest.rewards.xp} XP</span>
                      )}
                      {quest.rewards.gold > 0 && (
                        <span className="reward-item gold">{quest.rewards.gold} Gold</span>
                      )}
                      {quest.rewards.items && quest.rewards.items.length > 0 && (
                        <span className="reward-item items">
                          {quest.rewards.items.length} Item{quest.rewards.items.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Accept Button */}
                  {selectedQuest?.id === quest.id && (
                    <button
                      className="accept-quest-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAccept(quest);
                      }}
                    >
                      Accept Quest
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="quest-giver-footer">
          <button className="close-dialogue-button" onClick={onClose}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Get default dialogue based on quest giver name
 */
function getDefaultDialogue(name) {
  const dialogues = {
    'Village Elder': 'Greetings, traveler. Our village faces many challenges. Perhaps you can help us with some tasks?',
    'Town Guard Captain': 'You look capable. We have some jobs that need doing, if you\'re interested in earning some coin.',
    'Local Merchant': 'Ah, a wandering adventurer! I have some business propositions that might interest you.',
    'Traveling Sage': 'Knowledge and adventure go hand in hand. I have several matters that require investigation.'
  };

  return dialogues[name] || 'Welcome, adventurer. I have some tasks that need attention.';
}

QuestGiverUI.propTypes = {
  questGiver: PropTypes.shape({
    name: PropTypes.string,
    dialogue: PropTypes.string
  }),
  availableQuests: PropTypes.arrayOf(PropTypes.object),
  onClose: PropTypes.func.isRequired,
  onAcceptQuest: PropTypes.func
};

export default QuestGiverUI;
