import { useEffect, useState, useRef } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useSettings } from '../../contexts/SettingsContext';
import { TerrainGenerator } from '../../terrainGenerator.js';
import GameLog from '../ui/GameLog';
import CharacterStats from '../ui/CharacterStats';
import PartyList from '../ui/PartyList';
import Equipment from '../ui/Equipment';
import HexDetails from '../ui/HexDetails';
import Settings from '../ui/Settings';
import HexGridCanvas from '../canvas/HexGridCanvas';

function OverworldScene() {
  const { state, dispatch, actions, isHexReachable } = useGameState();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState({ left: 'equipment', bottom: 'party', right: 'hexinfo' });
  const [selectedCharacter, setSelectedCharacter] = useState(state.playerCharacter);
  const [selectedHex, setSelectedHex] = useState(null);

  const terrainGeneratorRef = useRef(null);
  const gameLogRef = useRef(null);
  const mapGeneratedRef = useRef(false);

  // Initialize terrain generator
  useEffect(() => {
    if (!terrainGeneratorRef.current) {
      terrainGeneratorRef.current = new TerrainGenerator();
    }
  }, []);

  // Generate map ONCE when mapSeed is available and map hasn't been generated
  useEffect(() => {
    if (!state.mapSeed || !terrainGeneratorRef.current) return;
    if (state.mapData) return; // Map already exists, don't regenerate
    if (mapGeneratedRef.current) return; // Already generated in this session

    console.log('Generating map with seed:', state.mapSeed);
    mapGeneratedRef.current = true;

    // Set seed and generate terrain
    terrainGeneratorRef.current.setSeed(state.mapSeed);
    const terrainData = terrainGeneratorRef.current.generate(
      20,  // width
      30,  // height (extended north/south)
      0.5, // terrainVariety
      5    // poiFrequency
    );

    // Convert terrain data to hex objects with col/row coordinates
    const generatedHexes = [];
    for (let row = 0; row < 30; row++) {
      for (let col = 0; col < 20; col++) {
        generatedHexes.push({
          row,
          col,
          terrain: terrainData[row][col].terrain,
          poi: terrainData[row][col].poi,
          encounter: terrainData[row][col].encounter,
          weather: terrainData[row][col].weather
        });
      }
    }

    // Store map in context
    dispatch({
      type: actions.SET_MAP_DATA,
      payload: generatedHexes
    });

    // Reveal hexes around starting position
    dispatch({
      type: actions.REVEAL_AROUND_PLAYER,
      payload: state.playerPosition
    });

    // Log game start
    if (gameLogRef.current) {
      gameLogRef.current.addMessage('Your journey begins...', 'info');
      gameLogRef.current.addMessage(`Map generated with seed: ${state.mapSeed}`, 'system');
    }
  }, [state.mapSeed, state.mapData, dispatch, actions]);

  // Update selected character when player character changes
  useEffect(() => {
    if (state.playerCharacter) {
      setSelectedCharacter(state.playerCharacter);
    }
  }, [state.playerCharacter]);

  // Check if map needs expansion and expand if necessary
  useEffect(() => {
    if (!state.mapData || !state.mapData.length || !terrainGeneratorRef.current) return;

    const { col, row } = state.playerPosition;

    // Find map boundaries
    const maxCol = Math.max(...state.mapData.map(h => h.col));
    const maxRow = Math.max(...state.mapData.map(h => h.row));
    const minCol = Math.min(...state.mapData.map(h => h.col));
    const minRow = Math.min(...state.mapData.map(h => h.row));

    const expansionThreshold = 5; // Expand when within 5 hexes of edge
    const chunkSize = 10; // Generate 10 new rows/cols at a time

    let needsExpansion = false;
    let expandDirection = null;

    // Check each direction
    if (col >= maxCol - expansionThreshold) {
      needsExpansion = true;
      expandDirection = 'east';
    } else if (col <= minCol + expansionThreshold) {
      needsExpansion = true;
      expandDirection = 'west';
    } else if (row >= maxRow - expansionThreshold) {
      needsExpansion = true;
      expandDirection = 'south';
    } else if (row <= minRow + expansionThreshold) {
      needsExpansion = true;
      expandDirection = 'north';
    }

    if (needsExpansion && expandDirection) {
      console.log(`Expanding map to the ${expandDirection}...`);

      // Keep same seed for consistent generation
      terrainGeneratorRef.current.setSeed(state.mapSeed);

      const newHexes = [];

      if (expandDirection === 'east') {
        // Add columns to the east
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = maxCol + 1; c <= maxCol + chunkSize; c++) {
            const terrainType = terrainGeneratorRef.current.generateTerrain(c, r, maxCol + chunkSize + 1, maxRow + 1, 0.5);
            newHexes.push({
              row: r,
              col: c,
              terrain: terrainType,
              poi: terrainGeneratorRef.current.generatePOI(5),
              encounter: terrainGeneratorRef.current.encounterManager.getEncounter(terrainType, () => terrainGeneratorRef.current.random()),
              weather: terrainGeneratorRef.current.generateWeather(terrainType)
            });
          }
        }
      } else if (expandDirection === 'west') {
        // Add columns to the west
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol - chunkSize; c < minCol; c++) {
            const terrainType = terrainGeneratorRef.current.generateTerrain(c, r, maxCol + 1, maxRow + 1, 0.5);
            newHexes.push({
              row: r,
              col: c,
              terrain: terrainType,
              poi: terrainGeneratorRef.current.generatePOI(5),
              encounter: terrainGeneratorRef.current.encounterManager.getEncounter(terrainType, () => terrainGeneratorRef.current.random()),
              weather: terrainGeneratorRef.current.generateWeather(terrainType)
            });
          }
        }
      } else if (expandDirection === 'south') {
        // Add rows to the south
        for (let r = maxRow + 1; r <= maxRow + chunkSize; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const terrainType = terrainGeneratorRef.current.generateTerrain(c, r, maxCol + 1, maxRow + chunkSize + 1, 0.5);
            newHexes.push({
              row: r,
              col: c,
              terrain: terrainType,
              poi: terrainGeneratorRef.current.generatePOI(5),
              encounter: terrainGeneratorRef.current.encounterManager.getEncounter(terrainType, () => terrainGeneratorRef.current.random()),
              weather: terrainGeneratorRef.current.generateWeather(terrainType)
            });
          }
        }
      } else if (expandDirection === 'north') {
        // Add rows to the north
        for (let r = minRow - chunkSize; r < minRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const terrainType = terrainGeneratorRef.current.generateTerrain(c, r, maxCol + 1, maxRow + 1, 0.5);
            newHexes.push({
              row: r,
              col: c,
              terrain: terrainType,
              poi: terrainGeneratorRef.current.generatePOI(5),
              encounter: terrainGeneratorRef.current.encounterManager.getEncounter(terrainType, () => terrainGeneratorRef.current.random()),
              weather: terrainGeneratorRef.current.generateWeather(terrainType)
            });
          }
        }
      }

      // Update map data with new hexes
      dispatch({
        type: actions.SET_MAP_DATA,
        payload: [...state.mapData, ...newHexes]
      });

      if (gameLogRef.current) {
        gameLogRef.current.addMessage(`Explored new territory to the ${expandDirection}!`, 'info');
      }
    }
  }, [state.playerPosition, state.mapData, state.mapSeed, dispatch, actions]);

  const handlePartyMemberSelect = (member, index) => {
    setSelectedCharacter(member);
  };

  const handleHexClick = (hex) => {
    setSelectedHex(hex);
  };

  const handleHexDoubleClick = (hex) => {
    if (!settings.doubleClickMove) return;

    // Check if hex is reachable
    if (isHexReachable(hex.col, hex.row)) {
      handleMoveToHex(hex);
    } else if (gameLogRef.current) {
      gameLogRef.current.addMessage('That hex is too far away!', 'warning');
    }
  };

  const handleMoveToHex = (hex) => {
    if (!hex || !isHexReachable(hex.col, hex.row)) return;

    // Update player position
    dispatch({
      type: actions.SET_PLAYER_POSITION,
      payload: { col: hex.col, row: hex.row }
    });

    // Reveal hexes around new position
    dispatch({
      type: actions.REVEAL_AROUND_PLAYER,
      payload: { col: hex.col, row: hex.row }
    });

    // Log movement
    if (gameLogRef.current) {
      gameLogRef.current.addMessage(
        `Moved to hex (${hex.col}, ${hex.row}) - ${hex.terrain.name}`,
        'action'
      );

      // Log POI if present
      if (hex.poi) {
        gameLogRef.current.addMessage(
          `You discover a ${hex.poi.name}!`,
          'discovery'
        );
      }

      // Log encounter if present
      if (hex.encounter) {
        gameLogRef.current.addMessage(
          `Encounter: ${hex.encounter.name} (CR ${hex.encounter.cr})`,
          'encounter'
        );
      }
    }
  };

  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="container" style={{ display: 'flex', flex: 1 }}>
        {/* Left Column */}
        <div className="left-column">
          <aside className="controls">
            <div className="tabs">
              <button
                className={`tab-button ${activeTab.left === 'equipment' ? 'active' : ''}`}
                onClick={() => setActiveTab(prev => ({ ...prev, left: 'equipment' }))}
              >
                Equipment
              </button>
            </div>

            <div className="tab-content active">
              <Equipment character={selectedCharacter} />
            </div>
          </aside>

          <aside className="controls controls-bottom">
            <div className="tabs">
              <button
                className={`tab-button ${activeTab.bottom === 'party' ? 'active' : ''}`}
                onClick={() => setActiveTab(prev => ({ ...prev, bottom: 'party' }))}
              >
                Party
              </button>
              <button
                className={`tab-button ${activeTab.bottom === 'character' ? 'active' : ''}`}
                onClick={() => setActiveTab(prev => ({ ...prev, bottom: 'character' }))}
              >
                Character
              </button>
            </div>

            <div className={`tab-content ${activeTab.bottom === 'party' ? 'active' : ''}`}>
              <PartyList
                party={state.party}
                onMemberSelect={handlePartyMemberSelect}
              />
            </div>

            <div className={`tab-content ${activeTab.bottom === 'character' ? 'active' : ''}`}>
              <CharacterStats character={state.playerCharacter} />
            </div>
          </aside>
        </div>

        {/* Canvas Container */}
        <main className="canvas-container">
          {state.mapData && state.mapData.length > 0 ? (
            <HexGridCanvas
              hexes={state.mapData}
              onHexClick={handleHexClick}
              onHexDoubleClick={handleHexDoubleClick}
            />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-color)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h2>Generating Map...</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  Seed: {state.mapSeed || 'Not set'}
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Column */}
        <aside className="hex-detail-panel">
          <div className="tabs">
            <button
              className={`tab-button ${activeTab.right === 'hexinfo' ? 'active' : ''}`}
              onClick={() => setActiveTab(prev => ({ ...prev, right: 'hexinfo' }))}
            >
              Hex Info
            </button>
            <button
              className={`tab-button ${activeTab.right === 'config' ? 'active' : ''}`}
              onClick={() => setActiveTab(prev => ({ ...prev, right: 'config' }))}
            >
              Config
            </button>
          </div>

          <div className={`tab-content ${activeTab.right === 'hexinfo' ? 'active' : ''}`}>
            <HexDetails
              hex={selectedHex}
              terrainGenerator={terrainGeneratorRef.current}
              onMoveClick={handleMoveToHex}
            />
          </div>

          <div className={`tab-content ${activeTab.right === 'config' ? 'active' : ''}`}>
            <Settings />
          </div>
        </aside>
      </div>

      {/* Game Log */}
      <div className="game-log-container" style={{ display: 'flex' }}>
        <GameLog ref={gameLogRef} />
      </div>
    </div>
  );
}

export default OverworldScene;
