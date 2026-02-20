// @ts-nocheck -- TODO: Remove after GameStateContext → .tsx and utils → .ts (Phase 5 & 6)
import { useEffect, useRef } from 'react';
import { useGameState } from '../contexts/GameStateContext';
import { generateHex } from '../utils/poiGenerationHelper';
import { CANVAS, TERRAIN } from '../constants/gameConstants';

/**
 * useInfiniteTerrainExpansion Hook
 *
 * Monitors player position and automatically expands the map in any direction
 * when the player gets close to the edge of the explored area.
 * Uses viewport-aware expansion to ensure smooth scrolling experience.
 *
 * @param {Object} terrainGeneratorRef - React ref containing TerrainGenerator instance
 * @param {Object} viewportSize - Object with { width, height } of viewport
 */
export function useInfiniteTerrainExpansion(terrainGeneratorRef, viewportSize) {
  const { state, dispatch, actions } = useGameState();
  const lastExpansionRef = useRef({ col: null, row: null, direction: null });

  useEffect(() => {
    // Guard clause - don't expand if map isn't ready
    if (!state.mapData || !state.mapData.length || !terrainGeneratorRef.current) return;

    const { col, row } = state.playerPosition;

    // Find current map boundaries - Use HexGrid for O(1) lookup if available
    let minCol, maxCol, minRow, maxRow;
    if (state.hexGrid) {
      const bounds = state.hexGrid.getBounds();
      minCol = bounds.minCol;
      maxCol = bounds.maxCol;
      minRow = bounds.minRow;
      maxRow = bounds.maxRow;
    } else {
      // Fallback to linear search if HexGrid not initialized
      maxCol = Math.max(...state.mapData.map(h => h.col));
      maxRow = Math.max(...state.mapData.map(h => h.row));
      minCol = Math.min(...state.mapData.map(h => h.col));
      minRow = Math.min(...state.mapData.map(h => h.row));
    }

    // Calculate visible viewport area in hexes
    const hexSize = CANVAS.DEFAULT_HEX_SIZE;
    const viewportWidth = viewportSize.width * TERRAIN.VIEWPORT_WIDTH_RATIO;
    const viewportHeight = viewportSize.height * TERRAIN.VIEWPORT_HEIGHT_RATIO;

    const visibleHexCols = Math.ceil(viewportWidth / (hexSize * Math.sqrt(3)));
    const visibleHexRows = Math.ceil(viewportHeight / (hexSize * 1.5));

    // Calculate required map bounds to cover viewport with a threshold
    const expansionThreshold = TERRAIN.EXPANSION_THRESHOLD;
    const requiredMinCol = col - Math.ceil(visibleHexCols / 2) - expansionThreshold;
    const requiredMaxCol = col + Math.ceil(visibleHexCols / 2) + expansionThreshold;
    const requiredMinRow = row - Math.ceil(visibleHexRows / 2) - expansionThreshold;
    const requiredMaxRow = row + Math.ceil(visibleHexRows / 2) + expansionThreshold;

    const chunkSize = TERRAIN.EXPANSION_CHUNK_SIZE;

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

    // Prevent duplicate expansions in the same direction from the same position
    const lastExp = lastExpansionRef.current;
    if (lastExp.col === col && lastExp.row === row && lastExp.direction === expandDirection) {
      return;
    }
    lastExpansionRef.current = { col, row, direction: expandDirection };

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
      payload: [...state.mapData, ...newHexes],
    });

    // Log expansion to console only (not visible to player in GameLog)
  }, [
    state.playerPosition.col,
    state.playerPosition.row,
    state.mapSeed,
    dispatch,
    actions,
    viewportSize.width,
    viewportSize.height,
  ]);
  // NOTE: state.mapData intentionally excluded from deps to prevent infinite loop
  // The effect only needs to run when player position changes, not when map expands
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
            c,
            r,
            maxCol + chunkSize + 1,
            maxRow + 1,
            0.5, // terrainVariety
            0.2 // poiChance (20%)
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
            c,
            r,
            maxCol + 1,
            maxRow + 1,
            0.5, // terrainVariety
            0.2 // poiChance (20%)
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
            c,
            r,
            maxCol + 1,
            maxRow + chunkSize + 1,
            0.5, // terrainVariety
            0.2 // poiChance (20%)
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
            c,
            r,
            maxCol + 1,
            maxRow + 1,
            0.5, // terrainVariety
            0.2 // poiChance (20%)
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
