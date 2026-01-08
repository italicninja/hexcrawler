import { useEffect } from 'react';
import { GameStateProvider, useGameState } from './contexts/GameStateContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { GameLogProvider } from './contexts/GameLogContext';
import TitleScene from './components/scenes/TitleScene';
import CharacterCreationScene from './components/scenes/CharacterCreationScene';
import OverworldScene from './components/scenes/OverworldScene';
import GameOverScene from './components/scenes/GameOverScene';
import ErrorBoundary from './components/ErrorBoundary';
import BottomToolbar from './components/ui/BottomToolbar';
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
      {state.currentScene === 'characterCreation' && (
        <ErrorBoundary>
          <CharacterCreationScene />
        </ErrorBoundary>
      )}
      {state.currentScene === 'overworld' && (
        <ErrorBoundary>
          <OverworldScene />
        </ErrorBoundary>
      )}
      {state.currentScene === 'gameover' && (
        <ErrorBoundary>
          <GameOverScene />
        </ErrorBoundary>
      )}
      <BottomToolbar />
    </div>
  );
}

function App() {
  return (
    <GameStateProvider>
      <SettingsProvider>
        <GameLogProvider>
          <GameRouter />
        </GameLogProvider>
      </SettingsProvider>
    </GameStateProvider>
  );
}

export default App;
