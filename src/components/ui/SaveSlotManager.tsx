// @ts-nocheck
import { useState } from 'react';
import logger from '../../utils/logger';
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

  const handleLoad = async slotKey => {
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
      logger.storage.error('Error loading game:', { error, slotKey, message: error.message });
      addMessage('Failed to load game: ' + error.message, 'error');
    }
  };

  const handleSave = async slotKey => {
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
      logger.storage.error('Error saving game:', { error, slotKey, message: error.message });
      addMessage('Failed to save game: ' + error.message, 'error');
    }
  };

  const handleQuickSave = async slotKey => {
    try {
      // Quick save never asks for confirmation - just overwrites
      const success = SaveManager.saveToSlot(slotKey, state);

      if (success) {
        addMessage('Quick save successful', 'system');
        refreshSlots();
      } else {
        addMessage('Failed to quick save', 'error');
      }
    } catch (error) {
      logger.storage.error('Error quick saving:', { error, slotKey, message: error.message });
      addMessage('Failed to quick save: ' + error.message, 'error');
    }
  };

  const handleDelete = async slotKey => {
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
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          )}
        </div>

        <div className="save-slots-container">
          {/* Two-column grid: Manual Saves (left) | Quick Saves (right) */}
          <div className="save-slots-grid">
            {/* LEFT COLUMN: Manual Save Section (1, 2, 3) */}
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

            {/* RIGHT COLUMN: Quick Save Section (A, B, C) */}
            <div className="slot-section">
              <h3>Quick Saves</h3>
              <SaveSlot
                slotKey={SaveManager.SAVE_SLOTS.QUICKSAVE_A}
                metadata={slots.quicksaveA}
                slotLetter="A"
                isQuicksave={true}
                mode={mode}
                onLoad={handleLoad}
                onSave={handleQuickSave}
                onDelete={handleDelete}
              />
              <SaveSlot
                slotKey={SaveManager.SAVE_SLOTS.QUICKSAVE_B}
                metadata={slots.quicksaveB}
                slotLetter="B"
                isQuicksave={true}
                mode={mode}
                onLoad={handleLoad}
                onSave={handleQuickSave}
                onDelete={handleDelete}
              />
              <SaveSlot
                slotKey={SaveManager.SAVE_SLOTS.QUICKSAVE_C}
                metadata={slots.quicksaveC}
                slotLetter="C"
                isQuicksave={true}
                mode={mode}
                onLoad={handleLoad}
                onSave={handleQuickSave}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </div>

        {mode === 'load' && (
          <div className="save-slot-manager-footer">
            <p className="save-notice">
              💡 <strong>Save version:</strong> {SaveManager.SAVE_VERSION} - Older saves are not
              compatible
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}

export default SaveSlotManager;
