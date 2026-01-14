import { useState } from 'react';
import PropTypes from 'prop-types';
import logger from '../../utils/logger.js';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { useConfirm } from '../../hooks/useConfirm';
import { ConfirmDialog } from '../shadcn/ConfirmDialog';
import { SaveManager } from '../../utils/SaveManager';
import SaveSlotManager from '../ui/SaveSlotManager';

function TitleScene() {
  const { state, dispatch, actions, hasSave, loadGame, deleteSave } = useGameState();
  const { addMessage } = useGameLog();
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const handleNewGame = () => {
    try {
      const gameSeed = seed.trim() || Date.now().toString();
      // NEW_GAME action sets mapSeed and currentScene automatically
      dispatch({ type: actions.NEW_GAME, payload: gameSeed });
    } catch (error) {
      logger.general.error('Error starting new game:', { error, message: error.message });
      addMessage('Failed to start new game: ' + error.message, 'error');
    }
  };

  const handleLoadClick = () => {
    setShowLoadMenu(true);
  };

  return (
    <>
      {showLoadMenu && (
        <div className="modal-overlay" onClick={() => setShowLoadMenu(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <SaveSlotManager mode="load" onClose={() => setShowLoadMenu(false)} />
          </div>
        </div>
      )}

      <div className="title-screen">
        <div className="title-content">
          <h1 className="title-logo">Hexcrawler</h1>
          <div className="title-subtitle">A D&D 5e hexcrawler</div>

          <div className="title-form">
            <div className="title-buttons">
              <button
                className="title-btn btn-primary"
                onClick={handleNewGame}
              >
                New Game
              </button>
              <button
                className="title-btn"
                onClick={handleLoadClick}
                disabled={!SaveManager.hasSaveData()}
              >
                Load Game
              </button>
            </div>

            <button
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
              type="button"
            >
              <span className={`dropdown-arrow ${showAdvanced ? 'expanded' : ''}`}>▼</span>
              Advanced Options
            </button>

            {showAdvanced && (
              <div className="advanced-options">
                <div className="control-group">
                  <label htmlFor="game-seed">World Seed (optional):</label>
                  <input
                    type="text"
                    id="game-seed"
                    placeholder="Leave blank for random"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                  <small className="input-hint">Use the same seed to generate identical worlds</small>
                </div>
              </div>
            )}
          </div>

          <div className="title-footer">
            <strong>Controls:</strong> Click hex to view details • Click "Move Here" or double-click to travel<br />
            Game auto-saves on rest, combat victory, quest completion, and scene changes
          </div>
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}

TitleScene.propTypes = {
  // This component doesn't receive any props, gets all data from useGameState hook
};

export default TitleScene;
