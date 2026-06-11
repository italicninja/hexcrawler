/**
 * TownScene - Walkable town interior with buildings and NPCs
 * Similar to ExplorationScene but for towns
 */

import { useState, useEffect } from 'react';
import logger from '../../utils/logger';
import { getHexDistance } from '../../utils/hexMath';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import CharacterStats from '../ui/CharacterStats';
import GameLog from '../ui/GameLog';
import InteriorHexCanvas from '../canvas/InteriorHexCanvas';
import { formatTime } from '../../game/TimeManager';
import './TownScene.css';

interface Coord {
  col: number;
  row: number;
}

interface SceneHex {
  col: number;
  row: number;
  terrain: { name?: string; key?: string; walkable?: boolean; isInteractive?: boolean };
  content?: string | null;
  buildingType?: string;
}

interface TownMapLocal {
  hexes: SceneHex[];
  entrance?: Coord;
  [key: string]: unknown;
}

const CLASS_ICONS: Record<string, string> = {
  fighter: '⚔️',
  wizard: '✨',
  cleric: '✝️',
  rogue: '🗡️',
  ranger: '🏹',
  barbarian: '🪓',
  paladin: '🛡️',
  druid: '🌿',
  bard: '🎵',
  sorcerer: '🔥',
  warlock: '👁️',
  monk: '👊',
};

function TownScene() {
  const { state, actions, dispatch } = useGameState();
  const { addMessage } = useGameLog();
  const [selectedHex, setSelectedHex] = useState<SceneHex | null>(null);

  const { currentPOI, interiorMaps } = state;

  // Get the current settlement interior map
  const poiKey = currentPOI ? `${currentPOI.col},${currentPOI.row}` : null;
  const interiorMap = (poiKey ? interiorMaps[poiKey] : null) as TownMapLocal | null;

  // Set player position to entrance when entering
  const [playerPosition, setPlayerPosition] = useState<Coord>(
    interiorMap?.entrance || { col: 0, row: 0 }
  );

  useEffect(() => {
    if (interiorMap?.entrance) {
      setPlayerPosition(interiorMap.entrance);
    }
  }, [interiorMap]);

  // Handle hex selection
  const handleHexClick = (hex: SceneHex) => {
    setSelectedHex(hex);
  };

  // Handle hex movement
  const handleHexDoubleClick = (hex: SceneHex) => {
    if (!hex.terrain.walkable) {
      logger.movement.debug('Cannot move to unwalkable hex', { hex });
      return;
    }

    // Check distance (1 hex move for now)
    const distance = getHexDistance(playerPosition.col, playerPosition.row, hex.col, hex.row);

    if (distance > 1) {
      logger.movement.debug('Too far to move in one turn', { distance });
      return;
    }

    // Move player
    setPlayerPosition({ col: hex.col, row: hex.row });
    setSelectedHex(hex);

    // Check for building entrance interaction
    if (hex.terrain.isInteractive && hex.buildingType) {
      handleBuildingInteraction(hex);
    }

    // Check for town gate (exit)
    if (hex.terrain.key === 'gate') {
      handleExitTown();
    }
  };

  // Handle building interactions
  const handleBuildingInteraction = (hex: SceneHex) => {
    const buildingType = hex.buildingType;

    switch (buildingType) {
      case 'inn':
        addMessage('Entered The Weary Traveler Inn - Rest options available (R key)', 'info');
        break;

      case 'shop':
        addMessage('Entered General Store - Shop interface coming soon!', 'info');
        break;

      case 'questBoard':
        addMessage('Checking Quest Board - Quest system available in Hex Details panel!', 'info');
        break;

      case 'blacksmith':
        addMessage('Entered Blacksmith - Services coming soon!', 'info');
        break;

      case 'temple':
        addMessage(
          'Entered Temple - You feel a sense of tranquility. Services coming soon!',
          'info'
        );
        break;

      case 'house':
        addMessage('Private residence - The door is locked.', 'info');
        break;

      case 'tent':
        addMessage('Entered tent - A simple shelter for travelers.', 'info');
        break;

      case 'campfire':
        addMessage('Standing by the campfire - A warm place to rest and share stories.', 'info');
        break;

      case 'supplyWagon':
        addMessage('Supply Wagon - Basic traveling goods available.', 'info');
        break;

      case 'market':
        addMessage('Entered Market - A bustling marketplace with diverse goods.', 'info');
        break;

      case 'barracks':
        addMessage('Entered Guard Barracks - City guards training and resting.', 'info');
        break;

      default:
        logger.general.warn('Unknown building type:', { buildingType });
    }
  };

  // Handle exit town
  const handleExitTown = () => {
    dispatch({ type: actions.EXIT_TOWN });
  };

  // Helper to get hex at position
  const getHexAt = (col: number, row: number): SceneHex | null => {
    if (!interiorMap) return null;
    return interiorMap.hexes.find(h => h.col === col && h.row === row) ?? null;
  };

  // Helper to get hex in direction
  const getHexInDirection = (direction: string): SceneHex | null => {
    const { col, row } = playerPosition;
    let targetCol = col;
    let targetRow = row;

    switch (direction) {
      case 'up':
        targetRow = row - 1;
        break;
      case 'down':
        targetRow = row + 1;
        break;
      case 'left':
        targetCol = col - 1;
        break;
      case 'right':
        targetCol = col + 1;
        break;
      default:
        return null;
    }

    return getHexAt(targetCol, targetRow);
  };

  // Keyboard control callbacks
  const keyboardCallbacks = {
    onMoveUp: () => {
      const targetHex = getHexInDirection('up');
      if (targetHex) {
        handleHexDoubleClick(targetHex);
      }
    },
    onMoveDown: () => {
      const targetHex = getHexInDirection('down');
      if (targetHex) {
        handleHexDoubleClick(targetHex);
      }
    },
    onMoveLeft: () => {
      const targetHex = getHexInDirection('left');
      if (targetHex) {
        handleHexDoubleClick(targetHex);
      }
    },
    onMoveRight: () => {
      const targetHex = getHexInDirection('right');
      if (targetHex) {
        handleHexDoubleClick(targetHex);
      }
    },
    onInteract: () => {
      const currentHex = getHexAt(playerPosition.col, playerPosition.row);
      if (currentHex && currentHex.terrain.isInteractive && currentHex.buildingType) {
        handleBuildingInteraction(currentHex);
      } else if (currentHex && currentHex.terrain.key === 'gate') {
        handleExitTown();
      }
    },
  };

  // Enable keyboard controls
  useKeyboardControls(keyboardCallbacks, true);

  // Error state - no settlement data
  if (!currentPOI || !interiorMap) {
    return (
      <div className="town-scene">
        <div className="error-message">
          <h2>Error: No Settlement Data</h2>
          <p>There was an error loading the settlement interior.</p>
          <button onClick={handleExitTown}>Return to Overworld</button>
        </div>
      </div>
    );
  }

  // Get selected hex details
  const getHexDetails = () => {
    if (!selectedHex) {
      return (
        <div className="town-hex-details">
          <h3>Settlement Information</h3>
          <p className="hint">Click on a hex to see details. Double-click to move.</p>
          <div className="town-info">
            <h4>{currentPOI.poi.name}</h4>
            <p>{currentPOI.poi.description}</p>
          </div>
          <div className="legend">
            <h4>Legend:</h4>
            <ul>
              <li>
                <span style={{ color: '#a89968' }}>■</span> Town Square
              </li>
              <li>
                <span style={{ color: '#8B7355' }}>■</span> Road
              </li>
              <li>
                <span style={{ color: '#654321' }}>■</span> Building Entrance
              </li>
              <li>
                <span style={{ color: '#5C4033' }}>■</span> Town Gate (Exit)
              </li>
            </ul>
          </div>
        </div>
      );
    }

    const isPlayerHere =
      playerPosition.col === selectedHex.col && playerPosition.row === selectedHex.row;
    const terrain = selectedHex.terrain;

    return (
      <div className="town-hex-details">
        <h3>{terrain.name}</h3>

        {isPlayerHere && (
          <div className="player-location">
            <span className="badge">You are here</span>
          </div>
        )}

        <div className="terrain-info">
          <p>
            <strong>Type:</strong> {terrain.key}
          </p>
          <p>
            <strong>Walkable:</strong> {terrain.walkable ? 'Yes' : 'No'}
          </p>
        </div>

        {selectedHex.buildingType && (
          <div className="building-info">
            <h4>Building: {selectedHex.buildingType}</h4>
            {terrain.isInteractive && !isPlayerHere && (
              <p className="hint">Double-click to interact</p>
            )}
            {terrain.isInteractive && isPlayerHere && (
              <p className="hint">You are at the entrance</p>
            )}
          </div>
        )}

        {terrain.key === 'gate' && (
          <div className="gate-info">
            <p className="hint">Double-click the gate to exit the town</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="town-scene">
      {/* Left Panel */}
      <div className="left-panel">
        <CharacterStats character={state.playerCharacter} />
      </div>

      {/* Center Canvas */}
      <div className="center-panel">
        <div className="town-header">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <h2>{currentPOI.poi.name || 'Unknown Settlement'}</h2>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: '500',
                fontFamily: 'monospace',
                padding: '0.25rem 0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '4px',
                color: '#d4af37',
              }}
            >
              {formatTime(state.gameTime)}
            </div>
          </div>
          <button className="exit-button" onClick={handleExitTown}>
            ← Leave Town
          </button>
        </div>
        <InteriorHexCanvas
          interiorMap={interiorMap as unknown as Parameters<typeof InteriorHexCanvas>[0]['interiorMap']}
          playerPosition={playerPosition}
          playerIcon={CLASS_ICONS[state.party?.player?.class ?? ''] ?? '🧍'}
          selectedHex={selectedHex}
          onHexClick={handleHexClick}
          onHexDoubleClick={handleHexDoubleClick}
        />
      </div>

      {/* Right Panel */}
      <div className="right-panel">{getHexDetails()}</div>

      {/* Bottom Panel */}
      <div className="bottom-panel">
        <GameLog />
      </div>
    </div>
  );
}

export default TownScene;
