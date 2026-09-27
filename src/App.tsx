import { useEffect, lazy, Suspense } from 'react';
import { GameStateProvider, useGameState } from './contexts/GameStateContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { GameLogProvider } from './contexts/GameLogContext';
import ErrorBoundary from './components/ErrorBoundary';
import BottomToolbar from './components/ui/BottomToolbar';
import { playMusic, setVolumes, unlockAudio } from './utils/audio';
import './style.css';

// Lazy load scene components for code splitting
const TitleScene = lazy(() => import('./components/scenes/TitleScene'));
const CharacterCreationScene = lazy(() => import('./components/scenes/CharacterCreationScene'));
const OverworldScene = lazy(() => import('./components/scenes/OverworldScene'));
const GameOverScene = lazy(() => import('./components/scenes/GameOverScene'));

// Loading fallback component
function LoadingScene() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontSize: '1.2rem',
      }}
    >
      Loading...
    </div>
  );
}

function GameRouter() {
  const { state } = useGameState();
  const { settings } = useSettings();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    setVolumes(settings.musicVolume, settings.sfxVolume);
  }, [settings.musicVolume, settings.sfxVolume]);

  // Browsers keep audio suspended until a user gesture.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const inCombat = !!state.combatState?.battlefield;
  useEffect(() => {
    const scene = state.currentScene;
    if (scene === 'title' || scene === 'characterCreation') playMusic('title');
    else if (scene === 'overworld') playMusic(inCombat ? 'combat' : 'overworld');
    else if (scene === 'gameover') playMusic('gameover');
    else playMusic(null);
  }, [state.currentScene, inCombat]);

  return (
    <div id="app">
      <Suspense fallback={<LoadingScene />}>
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
      </Suspense>
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
