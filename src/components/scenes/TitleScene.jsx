import { useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'sonner';
import { useGameState } from '../../contexts/GameStateContext';
import { useConfirm } from '../../hooks/useConfirm';
import { ConfirmDialog } from '../shadcn/ConfirmDialog';

function TitleScene() {
  const { state, dispatch, actions, hasSave, loadGame, deleteSave } = useGameState();
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const handleNewGame = async () => {
    try {
      if (hasSave()) {
        const confirmed = await confirm(
          'Starting a new game will overwrite your current save. Continue?',
          'This action cannot be undone.'
        );
        if (!confirmed) {
          return;
        }
        deleteSave();
      }

      const gameSeed = seed.trim() || Date.now().toString();
      // NEW_GAME action sets mapSeed and currentScene automatically
      dispatch({ type: actions.NEW_GAME, payload: gameSeed });
    } catch (error) {
      console.error('Error starting new game:', error);
      toast.error('Failed to start new game: ' + error.message);
    }
  };

  const handleContinue = () => {
    if (loadGame()) {
      dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'overworld' });
    } else {
      toast.error('Failed to load save game.');
    }
  };

  return (
    <>
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
                onClick={handleContinue}
                disabled={!hasSave()}
              >
                Continue
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
            <strong>Shift+S</strong> to manually save • Configure settings in Config tab
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
