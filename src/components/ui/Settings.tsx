import { useSettings } from '../../contexts/SettingsContext';
import KeybindingsMenu from './KeybindingsMenu';
import './Settings.css';

/**
 * Settings component - displays game configuration options
 */

function Settings() {
  const { settings, set } = useSettings();

  return (
    <div className="settings">
      <h4 className="jp-heading">Controls</h4>
      <div className="jp-field">
        <label className="settings-check">
          <input
            type="checkbox"
            checked={settings.doubleClickMove}
            onChange={e => set('doubleClickMove', e.target.checked)}
          />
          Double-click to move
        </label>
        <span className="jp-note">Enable double-clicking a hex to move there instantly</span>
      </div>

      <h4 className="jp-heading">Audio</h4>
      {(
        [
          ['musicVolume', 'Music'],
          ['sfxVolume', 'Sound effects'],
        ] as const
      ).map(([key, label]) => (
        <div className="jp-field" key={key}>
          <label htmlFor={key}>
            {label} ({Math.round(settings[key] * 100)}%)
          </label>
          <input
            id={key}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings[key]}
            onChange={e => set(key, Number(e.target.value))}
          />
        </div>
      ))}

      <KeybindingsMenu />
    </div>
  );
}

export default Settings;
