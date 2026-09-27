/**
 * useOverworldInput — unified keyboard controls extracted from
 * OverworldScene (TODO #3). Routes movement/interact/search keys to either
 * the overworld or interior handlers depending on where the player is, and
 * binds them via useKeyboardControls.
 */
import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import { useKeyboardControls } from './useKeyboardControls';
import { useHexInteraction } from './useHexInteraction';
import { isSettlement } from '../constants/gameConstants';
import type { OverworldActions } from './useOverworldActions';
import type { InteriorNavigation } from './useInteriorNavigation';

interface OverworldInputOptions {
  overworld: OverworldActions;
  interior: InteriorNavigation;
  /** Open a scene panel by id (e.g. 'rest', 'equipment', 'quests'). */
  openPanel: (panelId: string) => void;
  /** When false (e.g. during combat) keyboard controls are disabled. */
  enabled: boolean;
}

export function useOverworldInput({ overworld, interior, openPanel, enabled }: OverworldInputOptions) {
  const { state, dispatch, actions, isHexReachable, isPoiDiscovered } = useGameState();
  const { addMessage } = useGameLog();

  // Get hex interaction handlers for current hex
  const currentHex = overworld.getCurrentHex();
  const { handleInteract, handleSearch } = useHexInteraction(currentHex ?? null);

  // Shared movement routing: interior moves one walkable hex, overworld moves
  // one reachable hex.
  const moveInDirection = (direction: string) => {
    if (state.inInterior) {
      const targetHex = interior.getInteriorHexInDirection(direction);
      if (targetHex && targetHex.terrain?.walkable) {
        interior.handleInteriorHexDoubleClick(targetHex);
      }
    } else {
      const targetHex = overworld.getHexInDirection(direction);
      if (targetHex && isHexReachable(targetHex.col, targetHex.row)) {
        overworld.handleMoveToHex(targetHex);
      }
    }
  };

  // Unified keyboard control callbacks (works for both overworld and interior)
  const keyboardCallbacks = {
    onMoveUp: () => moveInDirection('up'),
    onMoveDown: () => moveInDirection('down'),
    onMoveLeft: () => moveInDirection('left'),
    onMoveRight: () => moveInDirection('right'),
    onInteract: () => {
      if (state.inInterior) {
        const currentHex = interior.getInteriorHexAt(
          state.interiorPlayerPosition?.col ?? 0,
          state.interiorPlayerPosition?.row ?? 0
        );

        if (currentHex && currentHex.terrain?.isInteractive && currentHex.buildingType) {
          interior.handleBuildingInteraction(currentHex);
        } else if (
          currentHex &&
          (currentHex.content === 'exit' ||
            currentHex.terrain?.key === 'exit' ||
            currentHex.terrain?.key === 'gate')
        ) {
          // Player is on the exit tile — leave the interior
          if (isSettlement(state.currentPOI?.poi?.type)) {
            dispatch({ type: actions.EXIT_TOWN });
          } else {
            interior.markExitReady();
            dispatch({ type: actions.EXIT_EXPLORATION });
          }
        } else if (
          currentHex &&
          currentHex.content === 'entrance' &&
          isSettlement(state.currentPOI?.poi?.type)
        ) {
          // Entrance tile only exits for towns (legacy behaviour)
          dispatch({ type: actions.EXIT_TOWN });
        } else if (
          currentHex &&
          (currentHex.content === 'loot' || currentHex.content === 'chest')
        ) {
          // Space bar on a loot tile — same as double-clicking it
          const poiKey = state.currentPOI
            ? `${state.currentPOI.col},${state.currentPOI.row}`
            : null;
          const currentInteriorMap = poiKey ? state.interiorMaps[poiKey] : null;
          const lootItem = currentInteriorMap?.loot?.find(
            l => l.col === currentHex.col && l.row === currentHex.row
          );
          if (lootItem && !lootItem.collected) {
            dispatch({
              type: actions.COLLECT_LOOT,
              payload: { items: lootItem.items || [], gold: lootItem.gold || 0 },
            });
            dispatch({
              type: actions.DISCOVER_LOOT,
              payload: { poiKey, lootKey: `${currentHex.col},${currentHex.row}`, collected: true },
            });
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
      } else {
        const hex = overworld.getCurrentHex();
        if (hex && hex.poi) {
          // Check if POI is discovered first
          const discovered = isPoiDiscovered(hex.col, hex.row);

          // Directly trigger the appropriate action based on POI type
          if (isSettlement(hex.poi.type)) {
            if (discovered || hex.poi.visibleWithoutDiscovery) {
              // Enter settlement - use handleInteract which will route to the correct handler
              handleInteract();
            }
          } else if (['cave', 'ruins', 'tower', 'dungeon'].includes(hex.poi.type)) {
            handleInteract();
          }
          // Note: shrines now use buttons in HexDetails panel
          // No spacebar action for them - player uses buttons
        }
      }
    },
    onSearch: () => {
      if (!state.inInterior) {
        const hex = overworld.getCurrentHex();
        if (hex && hex.poi) {
          handleSearch();
        }
      }
    },
    onRest: () => {
      openPanel('rest');
    },
    onForage: () => {
      if (!state.inInterior) {
        overworld.handleForage();
      }
    },
    onInventory: () => {
      openPanel('equipment');
    },
    onQuests: () => {
      openPanel('quests');
    },
    onMap: () => {
      addMessage('Map view not yet implemented', 'info');
    },
  };

  // Enable keyboard controls (works for both overworld and interior)
  useKeyboardControls(keyboardCallbacks, enabled);
}
