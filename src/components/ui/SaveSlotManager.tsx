import { useState } from 'react';
import logger from '../../utils/logger';
import { SaveManager } from '../../utils/SaveManager';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { useConfirm } from '../../hooks/useConfirm';
import { ConfirmDialog } from '../shadcn/ConfirmDialog';
import SaveSlot from './SaveSlot';
import { ModalTitle } from './Modal';
import './SaveSlotManager.css';
import PixelIcon from './PixelIcon';

/**
 * SaveSlotManager - Main UI for managing save slots
 * Shows all available slots and handles load/save/delete operations
 */
interface SaveSlotManagerProps {
  mode: string;
  onClose?: () => void;
  /** Rendered inside a journal page that supplies its own title and close link. */
  embedded?: boolean;
}

function SaveSlotManager({ mode, onClose, embedded = false }: SaveSlotManagerProps) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const { confirm, dialogProps } = useConfirm();
  const [slots, setSlots] = useState(SaveManager.getAllSlots());

  const refreshSlots = () => {
    setSlots(SaveManager.getAllSlots());
  };

  const handleLoad = async (slotKey: string) => {
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
      const message = error instanceof Error ? error.message : String(error);
      logger.storage.error('Error loading game:', { error, slotKey, message });
      addMessage('Failed to load game: ' + message, 'error');
    }
  };

  const handleSave = async (slotKey: string) => {
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
      const message = error instanceof Error ? error.message : String(error);
      logger.storage.error('Error saving game:', { error, slotKey, message });
      addMessage('Failed to save game: ' + message, 'error');
    }
  };

  const handleQuickSave = async (slotKey: string) => {
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
      const message = error instanceof Error ? error.message : String(error);
      logger.storage.error('Error quick saving:', { error, slotKey, message });
      addMessage('Failed to quick save: ' + message, 'error');
    }
  };

  const handleDelete = async (slotKey: string) => {
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

  const { SAVE_SLOTS } = SaveManager;
  const manualSlots = [
    [SAVE_SLOTS.SLOT_1, slots.slot1],
    [SAVE_SLOTS.SLOT_2, slots.slot2],
    [SAVE_SLOTS.SLOT_3, slots.slot3],
  ] as const;
  const quickSlots = [
    [SAVE_SLOTS.QUICKSAVE_A, slots.quicksaveA],
    [SAVE_SLOTS.QUICKSAVE_B, slots.quicksaveB],
    [SAVE_SLOTS.QUICKSAVE_C, slots.quicksaveC],
  ] as const;

  return (
    <>
      <div className={`save-slot-manager${embedded ? ' is-embedded' : ''}`}>
        {!embedded && (
          <div className="save-slot-manager-header">
            <ModalTitle className="save-slot-manager-title">
              {mode === 'load' ? 'Load Game' : 'Save Game'}
            </ModalTitle>
            {onClose && (
              <button type="button" className="jp-link" onClick={onClose} aria-label="Close">
                <PixelIcon name="close" /> Close
              </button>
            )}
          </div>
        )}

        <div className="save-slots-grid">
          <section className="slot-section">
            <h3 className="jp-heading">Manual Saves</h3>
            {manualSlots.map(([slotKey, metadata], i) => (
              <SaveSlot
                key={slotKey}
                slotKey={slotKey}
                metadata={metadata}
                slotNumber={i + 1}
                mode={mode}
                onLoad={handleLoad}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </section>

          <section className="slot-section">
            <h3 className="jp-heading">Quick Saves</h3>
            {quickSlots.map(([slotKey, metadata], i) => (
              <SaveSlot
                key={slotKey}
                slotKey={slotKey}
                metadata={metadata}
                slotLetter={'ABC'[i]}
                isQuicksave={true}
                mode={mode}
                onLoad={handleLoad}
                onSave={handleQuickSave}
                onDelete={handleDelete}
              />
            ))}
          </section>
        </div>

        {mode === 'load' && (
          <p className="jp-note save-notice">
            <PixelIcon name="bulb" /> Save version {SaveManager.SAVE_VERSION}. Older saves are not
            compatible.
          </p>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}

export default SaveSlotManager;
