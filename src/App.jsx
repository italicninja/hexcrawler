import { useEffect } from 'react';
import { GameStateProvider, useGameState } from './contexts/GameStateContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { EventInfoBoxProvider } from './contexts/EventInfoBoxContext';
import TitleScene from './components/scenes/TitleScene';
import OverworldScene from './components/scenes/OverworldScene';
import ExplorationScene from './components/scenes/ExplorationScene';
import ErrorBoundary from './components/ErrorBoundary';
import BottomToolbar from './components/ui/BottomToolbar';
import { Toaster } from './components/shadcn/ui/sonner';
import './style.css';

function GameRouter() {
  const { state } = useGameState();
  const { settings } = useSettings();

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  return (
    <div id="app">
      {state.currentScene === 'title' && (
        <ErrorBoundary>
          <TitleScene />
        </ErrorBoundary>
      )}
      {state.currentScene === 'overworld' && (
        <ErrorBoundary>
          <OverworldScene />
        </ErrorBoundary>
      )}
      {state.currentScene === 'exploration' && (
        <ErrorBoundary>
          <ExplorationScene />
        </ErrorBoundary>
      )}
      <Toaster />
      <BottomToolbar />
    </div>
  );
}

function App() {
  return (
    <GameStateProvider>
      <SettingsProvider>
        <EventInfoBoxProvider>
          <GameRouter />
        </EventInfoBoxProvider>
      </SettingsProvider>
    </GameStateProvider>
  );
}

export default App;
