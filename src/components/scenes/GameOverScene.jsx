import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';

function GameOverScene() {
  const { dispatch, actions, deleteSave } = useGameState();

  const handleReturnToTitle = () => {
    // Clear the save and return to title screen
    deleteSave();
    dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'title' });
  };

  return (
    <div className="game-over-screen">
      <div className="title-content">
        <h1 className="game-over-logo">Game Over</h1>
        <div className="game-over-subtitle">Your party has been defeated</div>

        <div className="title-form">
          <div className="title-buttons">
            <button
              className="title-btn btn-primary"
              onClick={handleReturnToTitle}
            >
              Return to Title
            </button>
          </div>
        </div>

        <div className="title-footer">
          Your progress has been lost. Better luck next time!
        </div>
      </div>
    </div>
  );
}

GameOverScene.propTypes = {
  // This component doesn't receive any props, gets all data from useGameState hook
};

export default GameOverScene;
