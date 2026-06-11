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
      <div className="keybindings-header">
        <h4>Keyboard Controls</h4>
        <button className="reset-button" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>

      <div className="keybindings-list">
        {Object.entries(keybindingLabels).map(([action, label]) => (
          <div key={action} className="keybinding-row">
            <span className="keybinding-label">{label}</span>
            <button
              className={`keybinding-button ${editing === action ? 'editing' : ''}`}
              onClick={() => startListening(action)}
              disabled={!!editing && editing !== action}
            >
              {editing === action ? (
                <span className="listening">Press any key...</span>
              ) : (
                <span className="key-display">
                  {formatKey(settings.keybindings[action as keyof Keybindings])}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="keybindings-note">
        <p>
          Click a button and press any key to rebind. Some keys may be reserved by your browser.
        </p>
      </div>
    </div>
  );
}

export default KeybindingsMenu;
