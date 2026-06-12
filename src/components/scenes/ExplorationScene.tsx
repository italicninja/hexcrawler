/**
 * ExplorationScene - Interior exploration scene for POIs (caves, dungeons, etc.)
 * Similar layout to OverworldScene but for interior hex maps
 */

import { useState, useEffect } from 'react';
import { getHexDistance } from '../../utils/hexMath';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import CharacterStats from '../ui/CharacterStats';
import GameLog from '../ui/GameLog';
import InteriorHexCanvas from '../canvas/InteriorHexCanvas';
import InteriorHexDetails from '../ui/InteriorHexDetails';
import { DiceRoller } from '../../game/DiceRoller';
import { formatTime, getCombatDuration } from '../../game/TimeManager';
import './ExplorationScene.css';

interface Coord {
  col: number;
  row: number;
}

interface SceneHex {
  col: number;
  row: number;
  terrain: { name?: string; key?: string; walkable?: boolean };
  content?: string | null;
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

function ExplorationScene() {
  const { state, actions, dispatch } = useGameState();
  const { addMessage } = useGameLog();
  const [selectedHex, setSelectedHex] = useState<SceneHex | null>(null);

  const { currentPOI, interiorMaps } = state;

  // Get the current interior map
  const poiKey = currentPOI ? `${currentPOI.col},${currentPOI.row}` : null;
  const interiorMap = poiKey ? interiorMaps[poiKey] : null;

  // Set player position to entrance when entering
  const [playerPosition, setPlayerPosition] = useState<Coord>(
    interiorMap?.entrance || { col: 0, row: 0 }
  );

  // True once the player has stepped onto the Exit Hex — enables the exit button
  const [exitReady, setExitReady] = useState(false);

  // Towns can exit freely; non-settlements require reaching the Exit Hex first
  const isTown = ['town', 'village', 'city', 'metropolis', 'camp'].includes(
    currentPOI?.poi?.type ?? ''
  );
  const canExitFreely = isTown;

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

    // Exit Hex — return to overworld
    // Towns exit freely via button; dungeons/caves/ruins/towers/starting_cache
    // require the player to reach this tile first.
    if (hex.terrain?.key === 'exit' || hex.content === 'exit') {
      handleExitViaExitHex();
    }
  };

  // Handle encounter auto-trigger
  const handleEncounterTrigger = (hex: SceneHex) => {
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
      const updatedCharacter = state.playerCharacter.clone();
      updatedCharacter.damage(damageReceived);

      const combatTime = getCombatDuration();

      addMessage(
        `Ambush! You were attacked by ${encounter.creatures}!\n\n` +
          `[Combat Auto-Resolved]\n` +
          `You took ${damageReceived} damage!\n` +
          `You defeated the enemies!\n\n` +
          `HP: ${updatedCharacter.currentHP}/${updatedCharacter.maxHP}\n` +
          `Time elapsed: ${combatTime} minutes`,
        'encounter'
      );

      // Update character
      dispatch({
        type: actions.UPDATE_CHARACTER,
        payload: updatedCharacter,
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
  const handleLootDiscovery = (hex: SceneHex) => {
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
  const handleHazardTrigger = (hex: SceneHex) => {
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
      const diceRoller = new DiceRoller(`${state.mapSeed}-hazard-${hex.col}-${hex.row}`);

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
        const damageDealt = hazard.damage;
        const updatedCharacter = state.playerCharacter.clone();
        updatedCharacter.damage(damageDealt);

        addMessage(
          `${hazard.saveType.toUpperCase()} ${saveResult.roll}+${saveResult.modifier}=${saveResult.total} vs DC ${hazard.dc}: Failed!\n\n${hazard.description}\n\nTook ${damageDealt} ${hazard.damageType} damage\n\nHP: ${updatedCharacter.currentHP}/${updatedCharacter.maxHP}`,
          'encounter'
        );

        // Update character HP in state
        dispatch({
          type: actions.UPDATE_CHARACTER,
          payload: updatedCharacter,
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

  /**
   * Handle stepping onto an Exit Hex inside a non-town POI.
   *
   * This is the only way to leave dungeons, caves, ruins, towers, and the
   * starting cache. Towns use the "← Exit to Overworld" button freely.
   * A confirmation prompt prevents accidental exits.
   */
  const handleExitViaExitHex = () => {
    const poiName = currentPOI?.poi?.name || 'this location';
    addMessage(
      `You reach the exit of ${poiName}. Step outside? (Click "← Exit to Overworld" to leave.)`,
      'info'
    );
    // Surface the exit button visually — set a flag so the button pulses
    setExitReady(true);
  };

  // Handle exit exploration
  const handleExitExploration = () => {
    dispatch({ type: actions.EXIT_EXPLORATION });
    setExitReady(false);
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
        <CharacterStats character={state.playerCharacter} />
        <div className="equipment-panel">
          <h3>Equipment</h3>
          <p className="stub-message">Equipment system coming soon...</p>
        </div>
      </div>

      {/* Center Canvas */}
      <div className="center-panel">
        <div className="interior-header">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <h2>{currentPOI?.poi?.name || 'Unknown Location'}</h2>
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
          <button
            className={`exit-button${exitReady || canExitFreely ? ' exit-button--ready' : ' exit-button--locked'}`}
            onClick={canExitFreely || exitReady ? handleExitExploration : undefined}
            title={
              canExitFreely || exitReady
                ? 'Return to the overworld'
                : 'Find the ladder to climb out'
            }
            style={{
              opacity: canExitFreely || exitReady ? 1 : 0.45,
              cursor: canExitFreely || exitReady ? 'pointer' : 'not-allowed',
            }}
          >
            {canExitFreely || exitReady ? '← Exit to Overworld' : '🔒 Find the Exit Hex'}
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
      <div className="right-panel">
        <InteriorHexDetails
          hex={selectedHex}
          playerPosition={playerPosition}
          interiorMap={interiorMap}
          poiKey={poiKey ?? ''}
          onMoveToHex={(hex: SceneHex) => {
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

            // Exit Hex — unlock the exit button
            if (hex.terrain?.key === 'exit' || hex.content === 'exit') {
              handleExitViaExitHex();
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

export default ExplorationScene;
