import { useEffect } from 'react';
import { useGameState } from '../contexts/GameStateContext';
import { generateHex } from '../utils/poiGenerationHelper';

/**
 * useInfiniteTerrainExpansion Hook
 *
 * Monitors player position and automatically expands the map in any direction
 * when the player gets close to the edge of the explored area.
 * Uses viewport-aware expansion to ensure smooth scrolling experience.
 *
 * @param {Object} terrainGeneratorRef - React ref containing TerrainGenerator instance
 * @param {Object} gameLogRef - React ref containing GameLog component
 * @param {Object} viewportSize - Object with { width, height } of viewport
 */
export function useInfiniteTerrainExpansion(terrainGeneratorRef, gameLogRef, viewportSize) {
  const { state, dispatch, actions } = useGameState();

  useEffect(() => {
    // Guard clause - don't expand if map isn't ready
    if (!state.mapData || !state.mapData.length || !terrainGeneratorRef.current) return;

    const { col, row } = state.playerPosition;

    // Find current map boundaries
    const maxCol = Math.max(...state.mapData.map(h => h.col));
    const maxRow = Math.max(...state.mapData.map(h => h.row));
    const minCol = Math.min(...state.mapData.map(h => h.col));
    const minRow = Math.min(...state.mapData.map(h => h.row));

    // Calculate visible viewport area in hexes
    const hexSize = 30;
    const viewportWidth = viewportSize.width * 0.6; // Approximate canvas width
    const viewportHeight = viewportSize.height * 0.8; // Approximate canvas height

    const visibleHexCols = Math.ceil(viewportWidth / (hexSize * Math.sqrt(3)));
    const visibleHexRows = Math.ceil(viewportHeight / (hexSize * 1.5));

    // Calculate required map bounds to cover viewport with a threshold
    // Only expand when player is within 5 hexes of edge
    const expansionThreshold = 5;
    const requiredMinCol = col - Math.ceil(visibleHexCols / 2) - expansionThreshold;
    const requiredMaxCol = col + Math.ceil(visibleHexCols / 2) + expansionThreshold;
    const requiredMinRow = row - Math.ceil(visibleHexRows / 2) - expansionThreshold;
    const requiredMaxRow = row + Math.ceil(visibleHexRows / 2) + expansionThreshold;

    const chunkSize = 10; // Generate 10 new rows/cols at a time

    // Determine if expansion is needed and in which direction
    // Player must be close to edge to trigger expansion
    let needsExpansion = false;
    let expandDirection = null;

    if (maxCol < requiredMaxCol) {
      needsExpansion = true;
      expandDirection = 'east';
    } else if (minCol > requiredMinCol) {
      needsExpansion = true;
      expandDirection = 'west';
    } else if (maxRow < requiredMaxRow) {
      needsExpansion = true;
      expandDirection = 'south';
    } else if (minRow > requiredMinRow) {
      needsExpansion = true;
      expandDirection = 'north';
    }

    if (!needsExpansion || !expandDirection) return;

    console.log(`Expanding map to the ${expandDirection}...`);

    // Keep same seed for consistent generation
    terrainGeneratorRef.current.setSeed(state.mapSeed);

    // Generate new hexes based on direction
    const newHexes = generateExpansionHexes(
      terrainGeneratorRef.current,
      expandDirection,
      { minCol, maxCol, minRow, maxRow },
      chunkSize
    );

    // Update map data with new hexes
    dispatch({
      type: actions.SET_MAP_DATA,
      payload: [...state.mapData, ...newHexes]
    });

    // Log expansion
    if (gameLogRef.current) {
      gameLogRef.current.addMessage(`Explored new territory to the ${expandDirection}!`, 'info');
    }
  }, [state.playerPosition, state.mapData, state.mapSeed, dispatch, actions, viewportSize, terrainGeneratorRef, gameLogRef]);
}

/**
 * Generates hexes for map expansion in a specific direction
 *
 * @param {Object} terrainGenerator - TerrainGenerator instance
 * @param {string} direction - Direction to expand ('north', 'south', 'east', 'west')
 * @param {Object} boundaries - Current map boundaries { minCol, maxCol, minRow, maxRow }
 * @param {number} chunkSize - Number of rows/columns to add
 * @returns {Array} Array of new hex objects
 */
function generateExpansionHexes(terrainGenerator, direction, boundaries, chunkSize) {
  const { minCol, maxCol, minRow, maxRow } = boundaries;
  const newHexes = [];

  switch (direction) {
    case 'east':
      // Add columns to the east
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = maxCol + 1; c <= maxCol + chunkSize; c++) {
          const hex = generateHex(
            terrainGenerator,
            c, r,
            maxCol + chunkSize + 1,
            maxRow + 1,
            0.5, // terrainVariety
            0.2  // poiChance (20%)
          );
          newHexes.push(hex);
        }
      }
      break;

    case 'west':
      // Add columns to the west
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol - chunkSize; c < minCol; c++) {
          const hex = generateHex(
            terrainGenerator,
            c, r,
            maxCol + 1,
            maxRow + 1,
            0.5, // terrainVariety
            0.2  // poiChance (20%)
          );
          newHexes.push(hex);
        }
      }
      break;

    case 'south':
      // Add rows to the south
      for (let r = maxRow + 1; r <= maxRow + chunkSize; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const hex = generateHex(
            terrainGenerator,
            c, r,
            maxCol + 1,
            maxRow + chunkSize + 1,
            0.5, // terrainVariety
            0.2  // poiChance (20%)
          );
          newHexes.push(hex);
        }
      }
      break;

    case 'north':
      // Add rows to the north
      for (let r = minRow - chunkSize; r < minRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const hex = generateHex(
            terrainGenerator,
            c, r,
            maxCol + 1,
            maxRow + 1,
            0.5, // terrainVariety
            0.2  // poiChance (20%)
          );
          newHexes.push(hex);
        }
      }
      break;

    default:
      console.error(`Invalid expansion direction: ${direction}`);
  }

  return newHexes;
}
