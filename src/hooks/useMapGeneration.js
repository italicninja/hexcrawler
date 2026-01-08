import { useEffect, useRef } from 'react';
import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';

/**
 * useMapGeneration Hook
 *
 * Handles initial map generation when a new game is started.
 * Generates the map once based on seed and viewport size, then stores it in game state.
 *
 * @param {Object} terrainGeneratorRef - React ref containing TerrainGenerator instance
 * @param {Object} viewportSize - Object with { width, height } of viewport
 */
export function useMapGeneration(terrainGeneratorRef, viewportSize) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const mapGeneratedRef = useRef(false);

  useEffect(() => {
    // Guard clauses - don't generate if conditions aren't met
    if (!state.mapSeed || !terrainGeneratorRef.current) return;
    if (state.mapData) return; // Map already exists, don't regenerate
    if (mapGeneratedRef.current) return; // Already generated in this session

    console.log('Generating map with seed:', state.mapSeed);
    mapGeneratedRef.current = true;

    // Set seed for reproducible generation
    terrainGeneratorRef.current.setSeed(state.mapSeed);

    // Calculate initial map size based on viewport to ensure full coverage
    const hexSize = 30;
    const initialCols = Math.ceil((viewportSize.width * 0.6) / (hexSize * Math.sqrt(3))) + 30; // +30 buffer (increased from 20)
    const initialRows = Math.ceil((viewportSize.height * 0.8) / (hexSize * 1.5)) + 30; // +30 buffer (increased from 20)

    // Generate terrain data - always start from (0, 0) for deterministic terrain
    const terrainData = terrainGeneratorRef.current.generate(
      Math.max(initialCols, 60),  // Minimum 60 cols (increased from 40)
      Math.max(initialRows, 60),  // Minimum 60 rows (increased from 50)
      0.5, // terrainVariety
      5    // poiFrequency
    );

    // Convert terrain data to hex objects with col/row coordinates
    const generatedHexes = [];
    const mapRows = terrainData.length;
    const mapCols = terrainData[0] ? terrainData[0].length : 0;

    for (let row = 0; row < mapRows; row++) {
      for (let col = 0; col < mapCols; col++) {
        generatedHexes.push({
          row,
          col,
          terrain: terrainData[row][col].terrain,
          poi: terrainData[row][col].poi,
          weather: terrainData[row][col].weather
        });
      }
    }

    // IMPORTANT: Add a starting town on the player's spawn hex for safety
    const startingHex = generatedHexes.find(
      h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
    );

    if (startingHex) {
      // Save current seed state
      const savedSeed = terrainGeneratorRef.current.seed;
      
      // Reset to a deterministic seed for starting town generation
      // Use a hash of the original seed to ensure consistency
      const startingTownSeed = parseInt(state.mapSeed) + 999999;
      terrainGeneratorRef.current.seed = startingTownSeed;
      
      // Generate a safe starting town using the POI system
      const startingTown = terrainGeneratorRef.current.poiSystem.generateTown(
        terrainGeneratorRef.current.random.bind(terrainGeneratorRef.current)
      );
      startingHex.poi = startingTown;
      
      // Restore seed state (not that it matters after generation, but for cleanliness)
      terrainGeneratorRef.current.seed = savedSeed;
    }

    // Store map in game state
    dispatch({
      type: actions.SET_MAP_DATA,
      payload: generatedHexes
    });

    // Auto-discover the starting town
    if (startingHex && startingHex.poi) {
      dispatch({
        type: actions.DISCOVER_POI,
        payload: { col: startingHex.col, row: startingHex.row }
      });
    }

    // Reveal hexes around starting position
    dispatch({
      type: actions.REVEAL_AROUND_PLAYER,
      payload: state.playerPosition
    });

    // Log game start
    addMessage('Your journey begins...', 'info');
    if (startingHex && startingHex.poi) {
      addMessage(`You start your adventure in ${startingHex.poi.name}, a safe haven.`, 'info');
    }
    addMessage(`Map generated with seed: ${state.mapSeed}`, 'system');
  }, [state.mapSeed, state.mapData, state.playerPosition, dispatch, actions, viewportSize, terrainGeneratorRef, addMessage]);
}
