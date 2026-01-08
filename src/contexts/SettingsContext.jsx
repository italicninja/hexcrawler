import { createContext, useContext, useState, useEffect } from 'react';

// Create context
const SettingsContext = createContext(null);

// Default settings
const defaultSettings = {
  doubleClickMove: true,
  theme: 'midnight-gold', // midnight-gold, teal-dark, light, dark-blue, forest
  keybindings: {
    moveUp: 'w',
    moveDown: 's',
    moveLeft: 'a',
    moveRight: 'd',
    interact: ' ', // Space bar
    search: 'Shift',
    rest: 'r',
    forage: 'f',
    inventory: 'i',
    quests: 'q',
    map: 'm'
  }
};

// Provider component
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hexcrawl_settings');
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem('hexcrawl_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings]);

  // Helper functions
  const get = (key) => settings[key];

  const set = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setSettings(defaultSettings);
  };

  const value = {
    settings,
    get,
    set,
    reset
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// Custom hook to use settings
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
