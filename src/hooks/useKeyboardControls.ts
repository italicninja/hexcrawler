import { useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Callbacks that can be registered for keyboard controls.
 */
export interface KeyboardCallbacks {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onInteract?: () => void;
  onSearch?: () => void;
  onRest?: () => void;
  onForage?: () => void;
  onInventory?: () => void;
  onQuests?: () => void;
  onMap?: () => void;
  onQuickSave?: () => void;
}

/**
 * useKeyboardControls - Hook for handling keyboard controls.
 * Provides keyboard navigation and actions based on user-configured keybindings.
 */
export function useKeyboardControls(callbacks: KeyboardCallbacks = {}, enabled = true): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { settings } = useSettings() as any;
  const keybindings = settings.keybindings;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = event.key.toLowerCase();

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

      if (key === keybindings.interact?.toLowerCase() || event.key === keybindings.interact) {
        event.preventDefault();
        callbacks.onInteract?.();
        return;
      }

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

      if (key === keybindings.forage?.toLowerCase()) {
        event.preventDefault();
        callbacks.onForage?.();
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

      if (event.key === 'F5') {
        event.preventDefault();
        callbacks.onQuickSave?.();
        return;
      }
    },
    [enabled, keybindings, callbacks]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export default useKeyboardControls;
