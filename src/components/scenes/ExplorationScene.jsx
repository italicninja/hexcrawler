/**
 * ExplorationScene - Interior exploration scene for POIs (caves, dungeons, etc.)
 * Similar layout to OverworldScene but for interior hex maps
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import { useEventInfoBox } from '../../contexts/EventInfoBoxContext';
import CharacterStats from '../ui/CharacterStats';
import GameLog from '../ui/GameLog';
import InteriorHexCanvas from '../canvas/InteriorHexCanvas';
import InteriorHexDetails from '../ui/InteriorHexDetails';
import EventInfoBox from '../ui/EventInfoBox';
import { DiceRoller } from '../../game/DiceRoller';
import { formatTime } from '../../game/TimeManager';
import './ExplorationScene.css';

function ExplorationScene() {
  const { state, actions, dispatch } = useGameState();
  const { showMessage } = useEventInfoBox();
  const [selectedHex, setSelectedHex] = useState(null);

  const { currentPOI, interiorMaps } = state;

  // Get the current interior map
  const poiKey = currentPOI ? `${currentPOI.col},${currentPOI.row}` : null;
  const interiorMap = poiKey ? interiorMaps[poiKey] : null;

  // Set player position to entrance when entering
  const [playerPosition, setPlayerPosition] = useState(
    interiorMap?.entrance || { col: 0, row: 0 }
  );

  useEffect(() => {
    if (interiorMap?.entrance) {
      setPlayerPosition(interiorMap.entrance);
    }
  }, [interiorMap]);

  // Handle hex selection
  const handleHexClick = (hex) => {
    setSelectedHex(hex);
  };

  // Handle hex movement
  const handleHexDoubleClick = (hex) => {
    if (!hex.terrain.walkable) {
      console.log('Cannot move to unwalkable hex');
      return;
    }

    // Check distance (1 hex move for now)
    const distance = getHexDistance(
      playerPosition.col,
      playerPosition.row,
      hex.col,
      hex.row
    );

    if (distance > 1) {
      console.log('Too far to move in one turn');
      return;
    }

    // Move player
    setPlayerPosition({ col: hex.col, row: hex.row });
    setSelectedHex(hex);

    // Check for hazards on entered hex
    if (hex.content === 'hazard') {
      handleHazardTrigger(hex);
    }
  };

  // Handle hazard triggers
  const handleHazardTrigger = (hex) => {
    if (!interiorMap) return;

    // Null check for player character
    if (!state.playerCharacter) {
      showMessage('Error', 'No player character found', 'info', true);
      return;
    }

    const hazard = interiorMap.hazards.find(
      h => h.col === hex.col && h.row === hex.row && !h.triggered
    );

    if (hazard) {
      // Create dice roller with map seed for consistency
      const diceRoller = new DiceRoller();
      diceRoller.setSeed(`${state.mapSeed}-hazard-${hex.col}-${hex.row}`);

      // Roll saving throw
      const saveResult = diceRoller.savingThrow(
        state.playerCharacter,
        hazard.saveType,
        hazard.dc
      );

      if (saveResult.success) {
        // Saved!
        showMessage(
          '⚡ Hazard Avoided!',
          `${hazard.description}\n\nYou rolled ${saveResult.total} (needed ${hazard.dc}).\nYou successfully dodge the ${hazard.type}!`,
          'info',
          true
        );
      } else {
        // Failed save - take damage
        const character = state.playerCharacter;
        character.damage(hazard.damage);

        showMessage(
          '💥 Hazard Triggered!',
          `${hazard.description}\n\nYou rolled ${saveResult.total} (needed ${hazard.dc}).\nYou take ${hazard.damage} ${hazard.damageType} damage!\n\nHP: ${character.currentHP}/${character.maxHP}`,
          'active',
          true
        );

        // Update character HP in state
        dispatch({
          type: actions.UPDATE_CHARACTER,
          payload: character
        });
      }

      // Mark hazard as triggered
      dispatch({
        type: actions.TRIGGER_HAZARD,
        payload: {
          poiKey,
          hazardKey: `${hex.col},${hex.row}`
        }
      });
    }
  };

  // Calculate hex distance (cube coordinates)
  const getHexDistance = (col1, row1, col2, row2) => {
    const x1 = col1 - Math.floor(row1 / 2);
    const z1 = row1;
    const y1 = -x1 - z1;

    const x2 = col2 - Math.floor(row2 / 2);
    const z2 = row2;
    const y2 = -x2 - z2;

    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
  };

  // Handle exit exploration
  const handleExitExploration = () => {
    dispatch({ type: actions.EXIT_EXPLORATION });
  };

  if (!interiorMap) {
    return (
      <div className="exploration-scene">
        <div className="error-message">
          <h2>Error: No interior map found</h2>
          <button onClick={handleExitExploration}>Return to Overworld</button>
        </div>
      </div>
    );
  }

  return (
    <div className="exploration-scene">
      {/* Left Panel */}
      <div className="left-panel">
        <CharacterStats />
        <div className="equipment-panel">
          <h3>Equipment</h3>
          <p className="stub-message">Equipment system coming soon...</p>
        </div>
      </div>

      {/* Center Canvas */}
      <div className="center-panel">
        <div className="interior-header">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <h2>{currentPOI.poi.name || 'Unknown Location'}</h2>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '500',
              fontFamily: 'monospace',
              padding: '0.25rem 0.5rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              color: '#a0a0a0'
            }}>
              {formatTime(state.gameTime)}
            </div>
          </div>
          <button className="exit-button" onClick={handleExitExploration}>
            ← Exit to Overworld
          </button>
        </div>
        <InteriorHexCanvas
          interiorMap={interiorMap}
          playerPosition={playerPosition}
          selectedHex={selectedHex}
          onHexClick={handleHexClick}
          onHexDoubleClick={handleHexDoubleClick}
        />
      </div>

      {/* Right Panel */}
      <div className="right-panel">
        <InteriorHexDetails
          hex={selectedHex}
          playerPosition={playerPosition}
          interiorMap={interiorMap}
          poiKey={poiKey}
        />
      </div>

      {/* Bottom Panel */}
      <div className="bottom-panel">
        <GameLog />
      </div>

      {/* Event Info Box */}
      <EventInfoBox />
    </div>
  );
}

ExplorationScene.propTypes = {
  // This component doesn't receive any props, gets all data from hooks
};

export default ExplorationScene;
