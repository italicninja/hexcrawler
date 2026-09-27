import { useSettings } from '../../contexts/SettingsContext';
import KeybindingsMenu from './KeybindingsMenu';
import './Settings.css';

/**
 * Settings component - displays game configuration options
 */

function Settings() {
  const { settings, set } = useSettings();

  const themes = [
    { id: 'journal', name: 'Journal', description: 'Parchment pages and ink' },
    { id: 'runescape', name: 'RuneScape', description: 'Old School stone, parchment & gold' },
    { id: 'midnight-gold', name: 'Midnight Gold', description: 'Dark theme with golden accents' },
    { id: 'teal-dark', name: 'Teal Dark', description: 'Original teal dark theme' },
    { id: 'light', name: 'Light', description: 'Light theme for daytime play' },
    { id: 'dark-blue', name: 'Dark Blue', description: 'Deep blue night theme' },
    { id: 'forest', name: 'Forest', description: 'Nature-inspired green theme' },
    { id: 'purple-night', name: 'Purple Night', description: 'Mystical purple theme' },
    { id: 'crimson', name: 'Crimson', description: 'Dark red theme' },
  ];

  return (
    <div className="settings">
      <h4 className="jp-heading">Appearance</h4>
      <div className="jp-field">
        <label htmlFor="theme-select">Theme</label>
        <select
          id="theme-select"
          value={settings.theme}
          onChange={e => set('theme', e.target.value)}
        >
          {themes.map(theme => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
        <span className="jp-note">{themes.find(t => t.id === settings.theme)?.description}</span>
      </div>

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
