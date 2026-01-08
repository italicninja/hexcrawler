import { useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';

/**
 * useKeyboardControls - Hook for handling keyboard controls
 * Provides keyboard navigation and actions based on user-configured keybindings
 * 
 * @param {object} callbacks - Object containing callback functions
 * @param {function} callbacks.onMoveUp - Called when move up key is pressed
 * @param {function} callbacks.onMoveDown - Called when move down key is pressed
 * @param {function} callbacks.onMoveLeft - Called when move left key is pressed
 * @param {function} callbacks.onMoveRight - Called when move right key is pressed
 * @param {function} callbacks.onInteract - Called when interact key is pressed
 * @param {function} callbacks.onSearch - Called when search key is pressed
 * @param {function} callbacks.onRest - Called when rest key is pressed
 * @param {function} callbacks.onInventory - Called when inventory key is pressed
 * @param {function} callbacks.onQuests - Called when quests key is pressed
 * @param {function} callbacks.onMap - Called when map key is pressed
 * @param {boolean} enabled - Whether keyboard controls are enabled
 */
export function useKeyboardControls(callbacks = {}, enabled = true) {
  const { settings } = useSettings();
  const keybindings = settings.keybindings;

  const handleKeyDown = useCallback((event) => {
    // Don't handle if disabled
    if (!enabled) return;

    // Don't handle if typing in an input/textarea
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable) {
      return;
    }

    const key = event.key.toLowerCase();

    // Check movement keys
    if (key === keybindings.moveUp?.toLowerCase()) {
      event.preventDefault();
      callbacks.onMoveUp?.();
      return;
    }

    if (key === keybindings.moveDown?.toLowerCase()) {
      event.preventDefault();
      callbacks.onMoveDown?.();
      return;
    }

    if (key === keybindings.moveLeft?.toLowerCase()) {
      event.preventDefault();
      callbacks.onMoveLeft?.();
      return;
    }

    if (key === keybindings.moveRight?.toLowerCase()) {
      event.preventDefault();
      callbacks.onMoveRight?.();
      return;
    }

    // Check action keys
    if (key === keybindings.interact?.toLowerCase() || event.key === keybindings.interact) {
      event.preventDefault();
      callbacks.onInteract?.();
      return;
    }

    // Check for Shift key (search)
    if (event.key === 'Shift' && keybindings.search === 'Shift') {
      event.preventDefault();
      callbacks.onSearch?.();
      return;
    }

    if (key === keybindings.rest?.toLowerCase()) {
      event.preventDefault();
      callbacks.onRest?.();
      return;
    }

    if (key === keybindings.inventory?.toLowerCase()) {
      event.preventDefault();
      callbacks.onInventory?.();
      return;
    }

    if (key === keybindings.quests?.toLowerCase()) {
      event.preventDefault();
      callbacks.onQuests?.();
      return;
    }

    if (key === keybindings.map?.toLowerCase()) {
      event.preventDefault();
      callbacks.onMap?.();
      return;
    }
  }, [enabled, keybindings, callbacks]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export default useKeyboardControls;
