import { useState } from 'react';
import PropTypes from 'prop-types';
import { SaveManager } from '../../utils/SaveManager';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { useConfirm } from '../../hooks/useConfirm';
import { ConfirmDialog } from '../shadcn/ConfirmDialog';
import SaveSlot from './SaveSlot';
import './SaveSlotManager.css';

/**
 * SaveSlotManager - Main UI for managing save slots
 * Shows all available slots and handles load/save/delete operations
 */
function SaveSlotManager({ mode, onClose }) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const { confirm, dialogProps } = useConfirm();
  const [slots, setSlots] = useState(SaveManager.getAllSlots());

  const refreshSlots = () => {
    setSlots(SaveManager.getAllSlots());
  };

  const handleLoad = async (slotKey) => {
    try {
      const gameData = SaveManager.loadFromSlot(slotKey);
      
      if (!gameData) {
        addMessage('Failed to load save game', 'error');
        return;
      }

      // Dispatch LOAD_GAME action with the loaded data
      dispatch({ type: actions.LOAD_GAME, payload: gameData });
      dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'overworld' });
      
      addMessage('Game loaded successfully', 'system');
      
      if (onClose) onClose();
    } catch (error) {
      console.error('Error loading game:', error);
      addMessage('Failed to load game: ' + error.message, 'error');
    }
  };

  const handleSave = async (slotKey) => {
    try {
      // Confirm overwrite if slot has data
      const slotMetadata = SaveManager.getSlotMetadata(slotKey);
      if (slotMetadata) {
        const confirmed = await confirm(
          `Overwrite save slot?`,
          `This will replace your ${slotMetadata.characterName} save (Level ${slotMetadata.level}, Day ${slotMetadata.day}).`
        );
        if (!confirmed) return;
      }

      const success = SaveManager.saveToSlot(slotKey, state);
      
      if (success) {
        addMessage('Game saved successfully', 'system');
        refreshSlots();
      } else {
        addMessage('Failed to save game', 'error');
      }
    } catch (error) {
      console.error('Error saving game:', error);
      addMessage('Failed to save game: ' + error.message, 'error');
    }
  };

  const handleDelete = async (slotKey) => {
    const slotMetadata = SaveManager.getSlotMetadata(slotKey);
    if (!slotMetadata) return;

    const confirmed = await confirm(
      'Delete save slot?',
      `This will permanently delete your ${slotMetadata.characterName} save. This cannot be undone.`
    );

    if (!confirmed) return;

    SaveManager.deleteSlot(slotKey);
    addMessage('Save deleted', 'system');
    refreshSlots();
  };

  return (
    <>
      <div className="save-slot-manager">
        <div className="save-slot-manager-header">
          <h2>{mode === 'load' ? 'Load Game' : 'Save Game'}</h2>
          {onClose && (
            <button className="close-button" onClick={onClose}>×</button>
          )}
        </div>

        <div className="save-slots-container">
          {mode === 'load' && (
            <>
              <div className="slot-section">
                <h3>Auto-save</h3>
                <SaveSlot
                  slotKey={SaveManager.SAVE_SLOTS.AUTOSAVE}
                  metadata={slots.autosave}
                  isAutosave={true}
                  mode={mode}
                  onLoad={handleLoad}
                />
              </div>
              <div className="slot-divider"></div>
            </>
          )}

          <div className="slot-section">
            <h3>Manual Saves</h3>
            <SaveSlot
              slotKey={SaveManager.SAVE_SLOTS.SLOT_1}
              metadata={slots.slot1}
              slotNumber={1}
              mode={mode}
              onLoad={handleLoad}
              onSave={handleSave}
              onDelete={handleDelete}
            />
            <SaveSlot
              slotKey={SaveManager.SAVE_SLOTS.SLOT_2}
              metadata={slots.slot2}
              slotNumber={2}
              mode={mode}
              onLoad={handleLoad}
              onSave={handleSave}
              onDelete={handleDelete}
            />
            <SaveSlot
              slotKey={SaveManager.SAVE_SLOTS.SLOT_3}
              metadata={slots.slot3}
              slotNumber={3}
              mode={mode}
              onLoad={handleLoad}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          </div>
        </div>

        {mode === 'load' && (
          <div className="save-slot-manager-footer">
            <p className="save-notice">
              💡 <strong>Save version:</strong> {SaveManager.SAVE_VERSION} 
              {' '}- Older saves are not compatible
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}

SaveSlotManager.propTypes = {
  mode: PropTypes.oneOf(['load', 'save']).isRequired,
  onClose: PropTypes.func
};

export default SaveSlotManager;
