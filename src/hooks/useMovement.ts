// @ts-nocheck -- TODO: Remove after GameStateContext → .tsx (Phase 6)
/**
 * useMovement - Custom hook for hex movement and navigation
 *
 * Extracted from OverworldScene for better testability
 */

import { useGameState } from '../contexts/GameStateContext';

type Direction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right';

export function useMovement() {
  const { state } = useGameState();

  /**
   * Get hex in a specific direction from current position
   * @param {string} direction - 'up', 'down', 'left', 'right', etc.
   * @returns {object|null} Hex object or null
   */
  const getHexInDirection = direction => {
    if (!state.mapData) return null;

    const { col, row } = state.playerPosition;
    let targetCol = col;
    let targetRow = row;

    // Hex grid movement offsets (offset coordinates)
    const isEvenRow = row % 2 === 0;

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
      case 'up-left':
        targetRow = row - 1;
        targetCol = isEvenRow ? col - 1 : col;
        break;
      case 'up-right':
        targetRow = row - 1;
        targetCol = isEvenRow ? col : col + 1;
        break;
      case 'down-left':
        targetRow = row + 1;
        targetCol = isEvenRow ? col - 1 : col;
        break;
      case 'down-right':
        targetRow = row + 1;
        targetCol = isEvenRow ? col : col + 1;
        break;
      default:
        return null;
    }

    // Use HexGrid for O(1) lookup if available
    if (state.hexGrid) {
      return state.hexGrid.get(targetCol, targetRow);
    }

    return state.mapData.find(h => h.col === targetCol && h.row === targetRow);
  };

  /**
   * Get current hex the player is standing on
   * @returns {object|null} Hex object or null
   */
  const getCurrentHex = () => {
    if (!state.mapData) return null;

    // Use HexGrid for O(1) lookup if available
    if (state.hexGrid) {
      return state.hexGrid.get(state.playerPosition.col, state.playerPosition.row);
    }

    return state.mapData.find(
      h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
    );
  };

  /**
   * Get all adjacent hexes (6 neighbors)
   * @param {number} col - Column
   * @param {number} row - Row
   * @returns {Array} Array of hex objects
   */
  const getAdjacentHexes = (col, row) => {
    // Use HexGrid spatial index if available (much faster than linear search)
    if (state.hexGrid) {
      return state.hexGrid.getNeighbors(col, row);
    }

    // Fallback to manual lookup (only used if hexGrid not initialized)
    const isEvenRow = row % 2 === 0;
    const offsets = isEvenRow
      ? [
          { dc: -1, dr: 0 }, // left
          { dc: 1, dr: 0 }, // right
          { dc: -1, dr: -1 }, // top-left
          { dc: 0, dr: -1 }, // top-right
          { dc: -1, dr: 1 }, // bottom-left
          { dc: 0, dr: 1 }, // bottom-right
        ]
      : [
          { dc: -1, dr: 0 }, // left
          { dc: 1, dr: 0 }, // right
          { dc: 0, dr: -1 }, // top-left
          { dc: 1, dr: -1 }, // top-right
          { dc: 0, dr: 1 }, // bottom-left
          { dc: 1, dr: 1 }, // bottom-right
        ];

    const adjacent = [];
    offsets.forEach(({ dc, dr }) => {
      const hex = state.mapData?.find(h => h.col === col + dc && h.row === row + dr);
      if (hex) {
        adjacent.push(hex);
      }
    });

    return adjacent;
  };

  return {
    getHexInDirection,
    getCurrentHex,
    getAdjacentHexes,
  };
}
