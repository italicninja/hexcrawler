/**
 * useInteriorNavigation — interior (town/dungeon/cave/tower) exploration logic
 * extracted from OverworldScene (TODO #3): the active interior map, hex
 * selection, movement (including lazy floor generation and stair transitions),
 * loot collection, and building interactions.
 */
import { useState } from 'react';
import logger from '../utils/logger';
import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import type { SceneHex, SceneInteriorMap } from '../types/scene';

interface InteriorNavigationOptions {
  /** Open a scene panel by id (e.g. 'rest', 'quests') — used by building interactions. */
  openPanel: (panelId: string) => void;
}

export function useInteriorNavigation({ openPanel }: InteriorNavigationOptions) {
  const { state, dispatch, actions, getHexDistance } = useGameState();
  const { addMessage } = useGameLog();

  const [selectedInteriorHex, setSelectedInteriorHex] = useState<SceneHex | null>(null);
  // True once the player has stepped onto an Exit Hex inside a non-town POI
  const [, setInteriorExitReady] = useState(false);

  // Get interior map if in interior — use optional chaining so undefined currentPOI
  // never crashes during a React batch render where inInterior flips before currentPOI is set
  const interiorMap = (
    state.inInterior && state.currentPOI?.col !== undefined
      ? (state.interiorMaps[`${state.currentPOI.col},${state.currentPOI.row}`] ?? null)
      : null
  ) as SceneInteriorMap | null;

  // Helper to get interior hex at position
  const getInteriorHexAt = (col: number, row: number): SceneHex | null => {
    if (!interiorMap) return null;
    return interiorMap.hexes.find(h => h.col === col && h.row === row) ?? null;
  };

  // Helper to get interior hex in direction
  const getInteriorHexInDirection = (direction: string): SceneHex | null => {
    if (!state.interiorPlayerPosition || !interiorMap) return null;

    const { col, row } = state.interiorPlayerPosition;
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

    return getInteriorHexAt(targetCol, targetRow);
  };

  const markExitReady = () => setInteriorExitReady(true);

  // Interior handlers
  const handleInteriorHexClick = (hex: SceneHex) => {
    setSelectedInteriorHex(hex);
  };

  const handleInteriorHexDoubleClick = async (hex: SceneHex) => {
    logger.movement.debug('Interior hex double click', {
      hex,
      playerPosition: state.interiorPlayerPosition,
    });

    if (!hex.terrain?.walkable) {
      addMessage('Cannot move to unwalkable terrain', 'warning');
      return;
    }

    if (!state.interiorPlayerPosition) {
      logger.movement.error('No interior player position set!');
      return;
    }

    // Check distance (1 hex move at a time)
    const distance = getHexDistance(
      state.interiorPlayerPosition.col,
      state.interiorPlayerPosition.row,
      hex.col,
      hex.row
    );

    logger.movement.debug('Distance check', { distance });

    if (distance > 1) {
      addMessage('Too far to move in one turn', 'warning');
      return;
    }

    // Update interior player position
    dispatch({
      type: actions.SET_INTERIOR_PLAYER_POSITION,
      payload: { col: hex.col, row: hex.row },
    });

    setSelectedInteriorHex(hex);

    // Check for building interactions (towns)
    if (hex.terrain?.isInteractive && hex.buildingType) {
      handleBuildingInteraction(hex);
    }

    // Check for town gate exit
    if (hex.terrain?.key === 'gate') {
      if (state.currentPOI?.poi.type === 'town') {
        dispatch({ type: actions.EXIT_TOWN });
      }
    }

    // Check for Exit Hex (non-town POIs) — unlock the exit button
    if (hex.terrain?.key === 'exit' || hex.content === 'exit') {
      setInteriorExitReady(true);
      addMessage(
        `You reach the entrance of ${state.currentPOI?.poi?.name || 'this location'}. Click "← Exit Interior" to leave.`,
        'info'
      );
      return; // Don't process loot/other content on exit tile
    }

    // ── Stair transitions ────────────────────────────────────────────────────
    if (hex.content === 'stairsUp' || hex.content === 'stairsDown') {
      const targetFloor = hex.connectedFloor;
      const poiKey = state.currentPOI ? `${state.currentPOI.col},${state.currentPOI.row}` : null;
      if (poiKey == null || targetFloor == null) return;

      // Use a consistent "floor{N}" key format for all floors, including floor 0
      const floorKey = `${poiKey}:floor${targetFloor}`;
      let targetMap = state.interiorFloors?.[floorKey];

      // Before leaving the current floor, cache it if not already cached so we
      // can return to it later without regenerating (floor 0 lives in interiorMaps[poiKey]
      // initially, upper floors are generated lazily).
      const currentFloorIndex = state.currentFloor ?? 0;
      const currentFloorKey = `${poiKey}:floor${currentFloorIndex}`;
      if (!state.interiorFloors?.[currentFloorKey]) {
        const currentFloorMap = state.interiorMaps[poiKey];
        if (currentFloorMap) {
          dispatch({
            type: actions.SET_INTERIOR_FLOOR,
            payload: { key: currentFloorKey, map: currentFloorMap },
          });
        }
      }

      if (!targetMap) {
        // Lazily generate this floor
        const poi = state.currentPOI?.poi;
        const currentMap = state.interiorMaps[poiKey] as
          | { cr?: number; width?: number; height?: number; floorCount?: number }
          | undefined;
        const cr = currentMap?.cr || poi?.cr || 1;
        const width = currentMap?.width || 20;
        const height = currentMap?.height || 15;

        try {
          if (poi?.type === 'tower') {
            const { TowerGenerator } = await import('../game/TowerGenerator');
            const gen = new TowerGenerator();
            gen.setSeed(`${poiKey}:floor${targetFloor}-${state.mapSeed}`);
            targetMap = gen.generateFloor(
              width,
              height,
              cr,
              targetFloor,
              currentMap?.floorCount || 6
            );
          } else if (poi?.type === 'dungeon') {
            const { DungeonGenerator } = await import('../game/DungeonGenerator');
            const gen = new DungeonGenerator();
            gen.setSeed(`${poiKey}:boss-${state.mapSeed}`);
            targetMap = gen.generateBossFloor(width, height, cr);
          }

          if (targetMap) {
            dispatch({
              type: actions.SET_INTERIOR_FLOOR,
              payload: { key: floorKey, map: targetMap },
            });
          }
        } catch (_err) {
          addMessage('Could not generate next floor.', 'error');
          return;
        }
      }

      if (!targetMap) return;

      // Determine spawn position on the target floor.
      // Going UP   → player arrives at stairsDown (came from below).
      // Going DOWN → player arrives at stairsUp   (came from above).
      const goingUp = hex.content === 'stairsUp';
      const spawnPos = goingUp
        ? targetMap.spawnUp || targetMap.entrance
        : targetMap.spawnDown || targetMap.entrance;

      addMessage(
        goingUp
          ? `You ascend to floor ${targetFloor + 1}...`
          : `You descend to floor ${targetFloor + 1}...`,
        'info'
      );

      dispatch({
        type: actions.CHANGE_FLOOR,
        payload: { floor: targetFloor, spawnPosition: spawnPos },
      });

      // Swap which interior map is "active" so the canvas renders the new floor.
      // interiorMaps[poiKey] is the "live" map the renderer reads from;
      // we temporarily overwrite it with the target floor map.
      dispatch({
        type: actions.SET_INTERIOR_MAP,
        payload: { key: poiKey, map: targetMap },
      });

      return;
    }

    // Check for loot / chest — collect it
    if (hex.content === 'loot' || hex.content === 'chest') {
      const poiKey = state.currentPOI ? `${state.currentPOI.col},${state.currentPOI.row}` : null;
      const currentInteriorMap = poiKey ? state.interiorMaps[poiKey] : null;
      const lootItem = currentInteriorMap?.loot?.find(l => l.col === hex.col && l.row === hex.row);

      if (lootItem && !lootItem.collected) {
        // Collect the loot
        dispatch({
          type: actions.COLLECT_LOOT,
          payload: {
            items: lootItem.items || [],
            gold: lootItem.gold || 0,
          },
        });

        // Mark as collected in the interior map (grays out the chest icon)
        dispatch({
          type: actions.DISCOVER_LOOT,
          payload: {
            poiKey,
            lootKey: `${hex.col},${hex.row}`,
            collected: true,
          },
        });

        // Feedback message
        const parts = [];
        if (lootItem.gold > 0) parts.push(`${lootItem.gold} gold`);
        if (lootItem.items?.length > 0) {
          const itemNames = lootItem.items
            .map((it: { name?: string }) => it.name || it)
            .join(', ');
          parts.push(itemNames);
        }
        addMessage(
          lootItem.label
            ? `${lootItem.label}: ${lootItem.description || parts.join(' and ')}`
            : `You find ${parts.join(' and ')}.`,
          'info'
        );
      }
    }
  };

  // Handle building interactions in towns
  const handleBuildingInteraction = (hex: SceneHex) => {
    const buildingType = hex.buildingType;

    switch (buildingType) {
      case 'inn':
        openPanel('rest');
        break;
      case 'shop':
        addMessage('Shop interface coming soon!', 'info');
        break;
      case 'questBoard':
        openPanel('quests');
        break;
      case 'blacksmith':
      case 'temple':
      case 'house':
        addMessage(`${buildingType} services coming soon!`, 'info');
        break;
    }
  };

  return {
    interiorMap,
    selectedInteriorHex,
    getInteriorHexAt,
    getInteriorHexInDirection,
    markExitReady,
    handleInteriorHexClick,
    handleInteriorHexDoubleClick,
    handleBuildingInteraction,
  };
}

export type InteriorNavigation = ReturnType<typeof useInteriorNavigation>;
