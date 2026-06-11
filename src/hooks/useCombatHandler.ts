/**
 * useCombatHandler - Custom hook for handling combat initiation
 *
 * Extracted from OverworldScene to improve testability and reusability
 */

import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import { Enemy } from '../game/Enemy';
import { DiceRoller } from '../game/DiceRoller';

interface EncounterPOI {
  name: string;
  creatures: string;
  cr: number;
  eventType?: string;
  type?: string;
  [key: string]: unknown;
}

/** The subset of hex fields this hook reads (spans HexGrid.Hex and raw mapData). */
interface CombatHex {
  terrain?: { key?: string; name?: string; color?: string };
  elevation?: number;
  weather?: { condition?: string };
  regionBiome?: string;
}

export function useCombatHandler() {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();

  /**
   * Initiate combat with a POI encounter
   */
  const handleEngageCombat = (poi: EncounterPOI) => {
    addMessage(`You engage ${poi.name} in combat!`, 'encounter');

    // Get party members
    const allies = state.party.getAllMembers().filter((m: unknown) => m);

    // Parse enemies from POI
    const diceRoller = new DiceRoller();
    const enemies = Enemy.parseCreatureString(poi.creatures, poi.cr, diceRoller);

    // Determine encounter type based on POI or terrain
    let encounterType = 'standard';
    if (poi.eventType === 'ambush') encounterType = 'ambush';
    if (poi.cr >= 5) encounterType = 'boss';

    // Get terrain type from current hex
    const currentHex = (
      state.hexGrid
        ? state.hexGrid.get(state.playerPosition.col, state.playerPosition.row)
        : state.mapData?.find(
            (h: { col: number; row: number }) =>
              h.col === state.playerPosition.col && h.row === state.playerPosition.row
          )
    ) as CombatHex | undefined;
    const terrainType = currentHex?.terrain?.name || 'plains';

    // Build hex context for battlefield theming
    const hexContext = currentHex
      ? {
          terrainKey: currentHex.terrain?.key || 'grassland',
          terrainName: currentHex.terrain?.name || 'Grassland',
          terrainColor: currentHex.terrain?.color || '#90EE90',
          elevation: currentHex.elevation ?? 5,
          weather: currentHex.weather?.condition || 'Clear',
          poiType: poi?.type || undefined,
          regionBiome: currentHex.regionBiome || undefined,
        }
      : undefined;

    // Dispatch START_COMBAT
    dispatch({
      type: actions.START_COMBAT,
      payload: {
        allies,
        enemies,
        encounterName: poi.name,
        encounterType,
        terrainType,
        hexContext,
      },
    });
  };

  /**
   * Handle event choices (fight, flee, etc.)
   */
  const handleEventChoice = (action: string, poi: EncounterPOI) => {
    if (action === 'fight') {
      handleEngageCombat(poi);
    } else if (action === 'continue') {
      // Continue after combat results
      // No-op for now
    } else if (action === 'gameover') {
      // Transition to game over screen
      dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'gameover' });
    }
  };

  return {
    handleEngageCombat,
    handleEventChoice,
  };
}
