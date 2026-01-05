import { GameStateProvider, useGameState } from './contexts/GameStateContext';
import { SettingsProvider } from './contexts/SettingsContext';
import TitleScene from './components/scenes/TitleScene';
import OverworldScene from './components/scenes/OverworldScene';
import './style.css';

function GameRouter() {
  const { state } = useGameState();

  return (
    <div id="app">
      {state.currentScene === 'title' && <TitleScene />}
      {state.currentScene === 'overworld' && <OverworldScene />}
    </div>
  );
}

function App() {
  return (
    <GameStateProvider>
      <SettingsProvider>
        <GameRouter />
      </SettingsProvider>
    </GameStateProvider>
  );
}

export default App;
