import { useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';

function TitleScene() {
  const { state, dispatch, actions, hasSave, loadGame, deleteSave } = useGameState();
  const [seed, setSeed] = useState('');

  const handleNewGame = () => {
    if (hasSave()) {
      if (!window.confirm('Starting a new game will overwrite your current save. Continue?')) {
        return;
      }
      deleteSave();
    }

    const gameSeed = seed.trim() || Date.now().toString();
    // NEW_GAME action sets mapSeed and currentScene automatically
    dispatch({ type: actions.NEW_GAME, payload: gameSeed });
  };

  const handleContinue = () => {
    if (loadGame()) {
      dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'overworld' });
    } else {
      alert('Failed to load save game.');
    }
  };

  return (
    <div className="title-screen">
      <div className="title-content">
        <h1 className="title-logo">Hexcrawl Adventures</h1>
        <div className="title-subtitle">An RPG Journey</div>

        <div className="title-form">
          <div className="control-group">
            <label htmlFor="game-seed">World Seed (optional):</label>
            <input
              type="text"
              id="game-seed"
              placeholder="Leave blank for random"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </div>

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
        </div>

        <div className="title-footer">
          <strong>Controls:</strong> Click hex to view details • Click "Move Here" or double-click to travel<br />
          <strong>Shift+S</strong> to manually save • Configure settings in Config tab
        </div>
      </div>
    </div>
  );
}

export default TitleScene;
