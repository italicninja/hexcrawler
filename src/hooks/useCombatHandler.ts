/**
 * useCombatHandler - Custom hook for handling combat initiation
 *
 * Extracted from OverworldScene to improve testability and reusability
 */

import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import { Enemy } from '../game/Enemy';
import { DiceRoller } from '../game/DiceRoller';

export function useCombatHandler() {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();

  /**
   * Initiate combat with a POI encounter
   * @param {object} poi - Point of interest with encounter data
   */
  const handleEngageCombat = poi => {
    addMessage(`You engage ${poi.name} in combat!`, 'encounter');

    // Get party members
    const allies = state.party.getAllMembers().filter(m => m);

    // Parse enemies from POI
    const diceRoller = new DiceRoller();
    const enemies = Enemy.parseCreatureString(poi.creatures, poi.cr, diceRoller);

    // Determine encounter type based on POI or terrain
    let encounterType = 'standard';
    if (poi.eventType === 'ambush') encounterType = 'ambush';
    if (poi.cr >= 5) encounterType = 'boss';

    // Get terrain type from current hex
    const currentHex = state.hexGrid
      ? state.hexGrid.get(state.playerPosition.col, state.playerPosition.row)
      : state.mapData?.find(
          h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
        );
    const terrainType = currentHex?.terrain?.name || 'plains';

    // Dispatch START_COMBAT
    dispatch({
      type: actions.START_COMBAT,
      payload: {
        allies,
        enemies,
        encounterName: poi.name,
        encounterType,
        terrainType,
      },
    });
  };

  /**
   * Handle event choices (fight, flee, etc.)
   * @param {string} action - Action to take
   * @param {object} poi - POI data
   */
  const handleEventChoice = (action, poi) => {
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
