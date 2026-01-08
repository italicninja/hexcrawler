import PropTypes from 'prop-types';
import { useSettings } from '../../contexts/SettingsContext';
import KeybindingsMenu from './KeybindingsMenu';

/**
 * Settings component - displays game configuration options
 */

function Settings() {
  const { settings, set } = useSettings();

  const themes = [
    { id: 'midnight-gold', name: 'Midnight Gold', description: 'Dark theme with golden accents' },
    { id: 'teal-dark', name: 'Teal Dark', description: 'Original teal dark theme' },
    { id: 'light', name: 'Light', description: 'Light theme for daytime play' },
    { id: 'dark-blue', name: 'Dark Blue', description: 'Deep blue night theme' },
    { id: 'forest', name: 'Forest', description: 'Nature-inspired green theme' },
    { id: 'purple-night', name: 'Purple Night', description: 'Mystical purple theme' },
    { id: 'crimson', name: 'Crimson', description: 'Dark red theme' }
  ];

  return (
    <div className="config-panel">
      <h3>Settings</h3>

      <div className="config-section">
        <h4>Appearance</h4>

        <div className="config-item">
          <label htmlFor="theme-select" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-light)', fontSize: '0.875rem' }}>
            Theme
          </label>
          <select
            id="theme-select"
            value={settings.theme}
            onChange={(e) => set('theme', e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.9rem',
              background: 'var(--input-bg)',
              color: 'var(--text-color)',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
          >
            {themes.map(theme => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
          <p className="config-description">
            {themes.find(t => t.id === settings.theme)?.description}
          </p>
        </div>
      </div>

      <div className="config-section">
        <h4>Controls</h4>

        <div className="config-item">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.doubleClickMove}
              onChange={(e) => set('doubleClickMove', e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Double-click to move</span>
          </label>
          <p className="config-description">
            Enable double-clicking a hex to move there instantly
          </p>
        </div>

        <KeybindingsMenu />
      </div>
    </div>
  );
}

Settings.propTypes = {
  // This component doesn't receive any props, gets all data from useSettings hook
};

export default Settings;
