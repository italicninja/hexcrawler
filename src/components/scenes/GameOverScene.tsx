import { useGameState } from '../../contexts/GameStateContext';
import { SaveManager } from '../../utils/SaveManager';

function GameOverScene() {
  const { dispatch, actions } = useGameState();

  const handleReturnToTitle = () => {
    // Clear all save slots (game over = permadeath)
    SaveManager.deleteSlot(SaveManager.SAVE_SLOTS.AUTOSAVE);
    SaveManager.deleteSlot(SaveManager.SAVE_SLOTS.SLOT_1);
    SaveManager.deleteSlot(SaveManager.SAVE_SLOTS.SLOT_2);
    SaveManager.deleteSlot(SaveManager.SAVE_SLOTS.SLOT_3);
    SaveManager.deleteSlot(SaveManager.SAVE_SLOTS.QUICKSAVE_A);
    SaveManager.deleteSlot(SaveManager.SAVE_SLOTS.QUICKSAVE_B);
    SaveManager.deleteSlot(SaveManager.SAVE_SLOTS.QUICKSAVE_C);

    // Also clear old save format if it exists
    localStorage.removeItem('hexcrawl_save');

    // Return to title screen
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
