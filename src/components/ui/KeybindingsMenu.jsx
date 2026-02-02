import { useState } from 'react';
import PropTypes from 'prop-types';
import { useSettings } from '../../contexts/SettingsContext';
import './KeybindingsMenu.css';

/**
 * KeybindingsMenu - Component for customizing keyboard controls
 */
function KeybindingsMenu() {
  const { settings, set } = useSettings();
  const [editing, setEditing] = useState(null);
  const [listeningFor, setListeningFor] = useState(null);

  const keybindingLabels = {
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

  const formatKey = key => {
    if (key === ' ') return 'Space';
    if (key === 'Shift') return 'Shift';
    if (key === 'Control') return 'Ctrl';
    if (key === 'Alt') return 'Alt';
    return key.toUpperCase();
  };

  const handleKeyPress = (e, action) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier keys by themselves
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    const newKey = e.key;

    // Update keybinding
    const newKeybindings = {
      ...settings.keybindings,
      [action]: newKey,
    };

    set('keybindings', newKeybindings);
    setEditing(null);
    setListeningFor(null);
  };

  const startListening = action => {
    setEditing(action);
    setListeningFor(action);

    // Add global keydown listener
    const handleGlobalKeyDown = e => {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const newKey = e.key;
      const newKeybindings = {
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
    const defaultKeybindings = {
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
              disabled={editing && editing !== action}
            >
              {editing === action ? (
                <span className="listening">Press any key...</span>
              ) : (
                <span className="key-display">{formatKey(settings.keybindings[action])}</span>
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

KeybindingsMenu.propTypes = {
  // No props - uses useSettings hook
};

export default KeybindingsMenu;
