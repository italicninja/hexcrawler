/**
 * ExplorationScene - Interior exploration scene for POIs (caves, dungeons, etc.)
 * Similar layout to OverworldScene but for interior hex maps
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import CharacterStats from '../ui/CharacterStats';
import GameLog from '../ui/GameLog';
import InteriorHexCanvas from '../canvas/InteriorHexCanvas';
import InteriorHexDetails from '../ui/InteriorHexDetails';
import { DiceRoller } from '../../game/DiceRoller';
import { formatTime, getCombatDuration, TIME_COSTS } from '../../game/TimeManager';
import './ExplorationScene.css';

function ExplorationScene() {
  const { state, actions, dispatch } = useGameState();
  const { addMessage } = useGameLog();
  const [selectedHex, setSelectedHex] = useState(null);

  const { currentPOI, interiorMaps } = state;

  // Get the current interior map
  const poiKey = currentPOI ? `${currentPOI.col},${currentPOI.row}` : null;
  const interiorMap = poiKey ? interiorMaps[poiKey] : null;

  // Set player position to entrance when entering
  const [playerPosition, setPlayerPosition] = useState(interiorMap?.entrance || { col: 0, row: 0 });

  useEffect(() => {
    if (interiorMap?.entrance) {
      setPlayerPosition(interiorMap.entrance);
    }
  }, [interiorMap]);

  // Handle hex selection
  const handleHexClick = hex => {
    setSelectedHex(hex);
  };

  // Handle hex movement
  const handleHexDoubleClick = hex => {
    if (!hex.terrain.walkable) {
      addMessage('Cannot move - hex is not walkable (wall or obstacle)', 'warning');
      return;
    }

    // Check distance (1 hex move for now)
    const distance = getHexDistance(playerPosition.col, playerPosition.row, hex.col, hex.row);

    if (distance > 1) {
      addMessage(
        `Too far - hex is ${distance} away. You can only move 1 hex at a time.`,
        'warning'
      );
      return;
    }

    // Move player
    setPlayerPosition({ col: hex.col, row: hex.row });
    setSelectedHex(hex);

    // Check for encounters on entered hex
    if (hex.content === 'encounter') {
      handleEncounterTrigger(hex);
    }

    // Check for loot/chests and mark as discovered
    if (hex.content === 'loot' || hex.content === 'chest') {
      handleLootDiscovery(hex);
    }

    // Check for hazards on entered hex
    if (hex.content === 'hazard') {
      handleHazardTrigger(hex);
    }
  };

  // Handle encounter auto-trigger
  const handleEncounterTrigger = hex => {
    if (!interiorMap) return;

    if (!state.playerCharacter) {
      addMessage('No player character found', 'error');
      return;
    }

    const encounter = interiorMap.encounters.find(
      e => e.col === hex.col && e.row === hex.row && !e.defeated
    );

    if (encounter) {
      // Mark as discovered
      dispatch({
        type: actions.DISCOVER_ENCOUNTER,
        payload: {
          poiKey,
          encounterKey: `${hex.col},${hex.row}`,
        },
      });

      // Auto-resolve combat (simplified for now)
      const seed = `${state.mapSeed}-encounter-${hex.col}-${hex.row}`;
      const diceRoller = new DiceRoller(seed, addMessage);

      // TODO: Implement full combat system
      const damageReceived = diceRoller.rollDice(1, 6);
      state.playerCharacter.damage(damageReceived);

      const combatTime = getCombatDuration();

      addMessage(
        `Ambush! You were attacked by ${encounter.creatures}!\n\n` +
          `[Combat Auto-Resolved]\n` +
          `You took ${damageReceived} damage!\n` +
          `You defeated the enemies!\n\n` +
          `HP: ${state.playerCharacter.currentHP}/${state.playerCharacter.maxHP}\n` +
          `Time elapsed: ${combatTime} minutes`,
        'encounter'
      );

      // Update character
      dispatch({
        type: actions.UPDATE_CHARACTER,
        payload: state.playerCharacter,
      });

      // Advance time
      dispatch({
        type: actions.ADVANCE_TIME,
        payload: combatTime,
      });

      // Mark as defeated
      dispatch({
        type: actions.DEFEAT_ENCOUNTER,
        payload: {
          poiKey,
          encounterKey: `${hex.col},${hex.row}`,
        },
      });
    }
  };

  // Handle loot discovery
  const handleLootDiscovery = hex => {
    if (!interiorMap) return;

    const loot = interiorMap.loot.find(
      l => l.col === hex.col && l.row === hex.row && !l.discovered
    );

    if (loot) {
      dispatch({
        type: actions.DISCOVER_LOOT,
        payload: {
          poiKey,
          lootKey: `${hex.col},${hex.row}`,
        },
      });

      const lootType = loot.type === 'chest' ? 'treasure chest' : 'loot';
      addMessage(`You discovered a ${lootType}!`, 'discovery');
    }
  };

  // Handle hazard triggers
  const handleHazardTrigger = hex => {
    if (!interiorMap) return;

    // Null check for player character
    if (!state.playerCharacter) {
      addMessage('No player character found', 'error');
      return;
    }

    const hazard = interiorMap.hazards.find(
      h => h.col === hex.col && h.row === hex.row && !h.triggered
    );

    if (hazard) {
      // Mark as discovered
      dispatch({
        type: actions.DISCOVER_HAZARD,
        payload: {
          poiKey,
          hazardKey: `${hex.col},${hex.row}`,
        },
      });
      // Create dice roller with map seed for consistency
      const diceRoller = new DiceRoller();
      diceRoller.setSeed(`${state.mapSeed}-hazard-${hex.col}-${hex.row}`);

      // Roll saving throw
      const saveResult = diceRoller.savingThrow(state.playerCharacter, hazard.saveType, hazard.dc);

      if (saveResult.success) {
        // Saved!
        addMessage(
          `${hazard.saveType.toUpperCase()} ${saveResult.roll}+${saveResult.modifier}=${saveResult.total} vs DC ${hazard.dc}: Success!\n\n${hazard.description}\n\nSuccessfully dodged the ${hazard.type}!`,
          'success'
        );
      } else {
        // Failed save - take damage
        const character = state.playerCharacter;
        const damageDealt = hazard.damage;
        character.damage(damageDealt);

        addMessage(
          `${hazard.saveType.toUpperCase()} ${saveResult.roll}+${saveResult.modifier}=${saveResult.total} vs DC ${hazard.dc}: Failed!\n\n${hazard.description}\n\nTook ${damageDealt} ${hazard.damageType} damage\n\nHP: ${character.currentHP}/${character.maxHP}`,
          'encounter'
        );

        // Update character HP in state
        dispatch({
          type: actions.UPDATE_CHARACTER,
          payload: character,
        });
      }

      // Mark hazard as triggered
      dispatch({
        type: actions.TRIGGER_HAZARD,
        payload: {
          poiKey,
          hazardKey: `${hex.col},${hex.row}`,
        },
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
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: '500',
                fontFamily: 'monospace',
                padding: '0.25rem 0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '4px',
                color: '#a0a0a0',
              }}
            >
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
          onMoveToHex={hex => {
            setPlayerPosition({ col: hex.col, row: hex.row });
            setSelectedHex(hex);

            // Check for encounters on entered hex
            if (hex.content === 'encounter') {
              handleEncounterTrigger(hex);
            }

            // Check for loot/chests and mark as discovered
            if (hex.content === 'loot' || hex.content === 'chest') {
              handleLootDiscovery(hex);
            }

            // Check for hazards on entered hex
            if (hex.content === 'hazard') {
              handleHazardTrigger(hex);
            }
          }}
        />
      </div>

      {/* Bottom Panel */}
      <div className="bottom-panel">
        <GameLog />
      </div>
    </div>
  );
}

ExplorationScene.propTypes = {
  // This component doesn't receive any props, gets all data from hooks
};

export default ExplorationScene;
