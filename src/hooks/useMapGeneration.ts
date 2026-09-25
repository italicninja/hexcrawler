import { useEffect, useRef, type RefObject } from 'react';
import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import { logRegionStats } from '../utils/regionDebug';
import logger from '../utils/logger';
import { StartingCacheGenerator } from '../game/StartingCacheGenerator';
import { STARTING_CACHE, TERRAIN } from '../constants/gameConstants';
import type { TerrainGenerator } from '../terrainGenerator';

interface PoiLike {
  name?: string;
  description?: string;
}

interface GeneratedHex {
  row: number;
  col: number;
  terrain: unknown;
  poi: PoiLike | null;
  weather: unknown;
  regionId?: number;
}

/**
 * useMapGeneration Hook
 *
 * Handles initial map generation when a new game is started.
 * Generates the map once from the seed alone, then stores it in game state.
 */
export function useMapGeneration(
  terrainGeneratorRef: RefObject<TerrainGenerator | null>
) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  // Track the seed that was last fully generated so that:
  //   - A second call with the *same* seed (e.g. StrictMode double-invoke) is skipped
  //   - A genuinely *new* seed (new game after returning to title) triggers regeneration
  const mapGeneratedSeedRef = useRef<string>('');

  useEffect(() => {
    // Guard clauses - don't generate if conditions aren't met
    if (!state.mapSeed || !terrainGeneratorRef.current) return;
    if (state.mapData) return; // Map already exists, don't regenerate
    if (mapGeneratedSeedRef.current === state.mapSeed) return; // Already generated for this seed

    const gen = terrainGeneratorRef.current;

    logger.mapgen.info('Generating map with seed:', state.mapSeed);
    mapGeneratedSeedRef.current = state.mapSeed;

    // Set seed for reproducible generation
    gen.setSeed(state.mapSeed);

    // Fixed initial size (not viewport-derived) so a seed always yields the same world;
    // infinite expansion fills in beyond it deterministically per hex.
    // Region-based generation returns { grid, regions, hexToRegion, weatherSystem }
    const generationResult = gen.generate(
      TERRAIN.MAP_INITIAL_WIDTH,
      TERRAIN.MAP_INITIAL_HEIGHT,
      0.5, // terrainVariety
      5 // poiFrequency
    );

    const terrainData = generationResult.grid;
    const regions = generationResult.regions;
    const hexToRegion = generationResult.hexToRegion;
    const weatherSystem = generationResult.weatherSystem;

    // Log region statistics for debugging
    if (hexToRegion) logRegionStats(regions, hexToRegion);

    // Convert terrain data to hex objects with col/row coordinates
    const generatedHexes: GeneratedHex[] = [];
    const mapRows = terrainData.length;
    const mapCols = terrainData[0] ? terrainData[0].length : 0;

    for (let row = 0; row < mapRows; row++) {
      for (let col = 0; col < mapCols; col++) {
        generatedHexes.push({
          row,
          col,
          terrain: terrainData[row][col].terrain,
          poi: terrainData[row][col].poi as PoiLike | null,
          weather: terrainData[row][col].weather,
          regionId: terrainData[row][col].regionId,
        });
      }
    }

    // IMPORTANT: Place the Starting Cache on the player's spawn hex.
    // The player begins the game INSIDE this POI (not on the overworld).
    // It is a tiny CR 0 shelter with starter loot and a clearly marked Exit Hex.
    const startingHex = generatedHexes.find(
      h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
    );

    if (startingHex) {
      startingHex.poi = gen.poiSystem.generateStartingCache(gen.streamFor('startingCache'));
    }

    // Store map in game state (includes regions and weather system)
    dispatch({
      type: actions.SET_MAP_DATA,
      payload: {
        hexes: generatedHexes,
        regions,
        hexToRegion,
        weatherSystem,
      },
    });

    // Auto-discover the starting cache POI
    if (startingHex && startingHex.poi) {
      dispatch({
        type: actions.DISCOVER_POI,
        payload: { col: startingHex.col, row: startingHex.row },
      });
    }

    // Reveal hexes around starting position (so the overworld is ready when the player exits)
    dispatch({
      type: actions.REVEAL_AROUND_PLAYER,
      payload: state.playerPosition,
    });

    // ── Generate the starting cache interior and enter it immediately ──────
    // The player begins the game INSIDE this POI. When they step on the Exit
    // Hex and leave, they emerge on the overworld at the spawn hex.
    if (startingHex && startingHex.poi) {
      const poiKey = `${startingHex.col},${startingHex.row}`;
      const cacheGenerator = new StartingCacheGenerator();
      cacheGenerator.setSeed(`poi-${poiKey}-${state.mapSeed}`);

      // generate() returns a typed CacheMap; loot/hazards/encounters are filled below.
      const interiorMap = cacheGenerator.generate(
        STARTING_CACHE.WIDTH,
        STARTING_CACHE.HEIGHT,
        0
      );
      interiorMap.loot = cacheGenerator.placeLoot(
        interiorMap,
        generatedHexes,
        state.playerPosition.col,
        state.playerPosition.row
      );
      interiorMap.hazards = cacheGenerator.placeHazards(interiorMap);
      interiorMap.encounters = cacheGenerator.placeEncounters(interiorMap, startingHex.poi);

      // Store interior map so ENTER_EXPLORATION can find it
      dispatch({
        type: actions.SET_INTERIOR_MAP,
        payload: { key: poiKey, map: interiorMap },
      });

      // Enter the starting cache — player spawns at the entrance tile
      dispatch({
        type: actions.ENTER_EXPLORATION,
        payload: {
          col: startingHex.col,
          row: startingHex.row,
          poi: startingHex.poi,
        },
      });

      // Flavor messages
      addMessage('Your eyes open slowly. Dust motes drift in the dim light.', 'info');
      addMessage(
        `You find yourself inside ${startingHex.poi.name}.\n\n${startingHex.poi.description}\n\nSearch the rooms for supplies before you leave. When you are ready to face what lies above, climb the ladder.`,
        'info'
      );
    } else {
      addMessage('Your journey begins...', 'info');
    }

    addMessage(`Map generated with seed: ${state.mapSeed}`, 'system');
     
  }, [state.mapSeed]);
  // NOTE: state.mapData excluded from deps - we check it in the guard clause but don't need to re-run when it changes
  // mapGeneratedSeedRef prevents duplicate generation for the same seed even if the effect re-runs,
  // while still allowing regeneration when a genuinely new seed arrives (second new game).
}
