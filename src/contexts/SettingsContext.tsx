import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import logger from '../utils/logger';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface Keybindings {
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  interact: string;
  search: string;
  rest: string;
  forage: string;
  inventory: string;
  quests: string;
  map: string;
  quicksave: string;
}

export interface Settings {
  doubleClickMove: boolean;
  theme: string;
  keybindings: Keybindings;
}

interface SettingsContextValue {
  settings: Settings;
  get: <K extends keyof Settings>(key: K) => Settings[K];
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

// -------------------------------------------------------------------------
// Default settings
// -------------------------------------------------------------------------

const defaultSettings: Settings = {
  doubleClickMove: true,
  theme: 'runescape', // runescape, midnight-gold, teal-dark, light, dark-blue, forest
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
    map: 'm',
    quicksave: 'F5',
  },
};

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem('hexcrawl_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultSettings,
        ...parsed,
        // keep defaults for keybindings added after the settings were stored
        keybindings: { ...defaultSettings.keybindings, ...parsed.keybindings },
      };
    }
  } catch (error) {
    logger.general.error('Failed to load settings:', { error });
  }
  return defaultSettings;
}

// -------------------------------------------------------------------------
// Context
// -------------------------------------------------------------------------

const SettingsContext = createContext<SettingsContextValue | null>(null);

// -------------------------------------------------------------------------
// Provider
// -------------------------------------------------------------------------

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Read stored settings synchronously in the initializer: loading in an effect let the
  // save effect below write the defaults over the stored settings on first render.
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem('hexcrawl_settings', JSON.stringify(settings));
    } catch (error) {
      logger.general.error('Failed to save settings:', { error });
    }
  }, [settings]);

  // Helper functions - memoized to prevent recreation
  const get = useCallback(
    <K extends keyof Settings>(key: K): Settings[K] => settings[key],
    [settings]
  );

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      get,
      set,
      reset,
    }),
    [settings, get, set, reset]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// -------------------------------------------------------------------------
// Hook
// -------------------------------------------------------------------------

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
