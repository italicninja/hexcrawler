import { useSettings } from '../../contexts/SettingsContext';

/**
 * Settings component - displays game configuration options
 */

function Settings() {
  const { settings, set } = useSettings();

  return (
    <div className="config-panel">
      <h3>Settings</h3>

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
      </div>
    </div>
  );
}

export default Settings;
