import { useState } from 'react';
import { useSettings, type Keybindings } from '../../contexts/SettingsContext';
import './KeybindingsMenu.css';

/**
 * KeybindingsMenu - Component for customizing keyboard controls
 */
function KeybindingsMenu() {
  const { settings, set } = useSettings();
  const [editing, setEditing] = useState<string | null>(null);
  const [listeningFor, setListeningFor] = useState<string | null>(null);

  const keybindingLabels: Record<string, string> = {
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    moveLeft: 'Move Left',
    moveRight: 'Move Right',
    interact: 'Interact',
    search: 'Search',
    rest: 'Rest Menu',
    forage: 'Forage',
    inventory: 'Inventory',
    quests: 'Quest Log',
    map: 'Map View',
  };

  const formatKey = (key: string) => {
    if (key === ' ') return 'Space';
    if (key === 'Shift') return 'Shift';
    if (key === 'Control') return 'Ctrl';
    if (key === 'Alt') return 'Alt';
    return key.toUpperCase();
  };

  const startListening = (action: string) => {
    setEditing(action);
    setListeningFor(action);

    // Add global keydown listener
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const newKey = e.key;
      const newKeybindings: Keybindings = {
        ...settings.keybindings,
        [action]: newKey,
      };

      set('keybindings', newKeybindings);
      setEditing(null);
      setListeningFor(null);

      // Remove listener
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    // Auto-cancel after 5 seconds
    setTimeout(() => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (listeningFor === action) {
        setEditing(null);
        setListeningFor(null);
      }
    }, 5000);
  };

  const resetToDefaults = () => {
    const defaultKeybindings: Keybindings = {
      moveUp: 'w',
      moveDown: 's',
      moveLeft: 'a',
      moveRight: 'd',
      interact: ' ',
      search: 'Shift',
      rest: 'r',
      forage: 'f',
      inventory: 'i',
      quests: 'q',
      map: 'm',
      quicksave: 'F5',
    };

    set('keybindings', defaultKeybindings);
  };

  return (
    <div className="keybindings-menu">
      <h4 className="jp-heading">Keyboard Controls</h4>
      <ul className="jp-rows">
        {Object.entries(keybindingLabels).map(([action, label]) => (
          <li key={action} className="jp-row">
            <span>{label}</span>
            <button
              type="button"
              className={`keybindings-key ${editing === action ? 'is-editing' : ''}`}
              onClick={() => startListening(action)}
              disabled={!!editing && editing !== action}
              aria-label={`Rebind ${label}`}
            >
              {editing === action ? (
                <em>Press any key...</em>
              ) : (
                <kbd>{formatKey(settings.keybindings[action as keyof Keybindings])}</kbd>
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="jp-note">
        Click a key and press any other to rebind. Some keys may be reserved by your browser.
      </p>
      <div className="jp-actions">
        <button type="button" className="jp-link" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

export default KeybindingsMenu;
