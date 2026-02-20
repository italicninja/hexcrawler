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
    map: 'm',
    quicksave: 'F5',
  },
};

// -------------------------------------------------------------------------
// Context
// -------------------------------------------------------------------------

const SettingsContext = createContext<SettingsContextValue | null>(null);

// -------------------------------------------------------------------------
// Provider
// -------------------------------------------------------------------------

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hexcrawl_settings');
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (error) {
      logger.general.error('Failed to load settings:', { error });
    }
  }, []);

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
