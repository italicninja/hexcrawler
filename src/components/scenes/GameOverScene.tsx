import { useEffect } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { SaveManager } from '../../utils/SaveManager';

function GameOverScene() {
  const { dispatch, actions } = useGameState();

  // Permadeath: wipe saves as soon as this screen shows, not on the button,
  // so refreshing here can't reload the run from before the fatal fight.
  useEffect(() => SaveManager.deleteAllSlots(), []);

  const handleReturnToTitle = () => {
    dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'title' });
  };

  return (
    <div className="game-over-screen">
      <div className="title-content">
        <h1 className="game-over-logo">Game Over</h1>
        <div className="game-over-subtitle">Your party has been defeated</div>

        <div className="title-form">
          <div className="title-buttons">
            <button className="title-btn btn-primary" onClick={handleReturnToTitle}>
              Return to Title
            </button>
          </div>
        </div>

        <div className="title-footer">Your progress has been lost. Better luck next time!</div>
      </div>
    </div>
  );
}

export default GameOverScene;
