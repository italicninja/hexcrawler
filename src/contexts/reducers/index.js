/**
 * Combined Reducer - Delegates actions to specialized reducers
 * 
 * This modular approach splits the 1,400+ line monolithic reducer into
 * 7 focused, testable modules:
 * - gameReducer: Core game state, scenes, time
 * - mapReducer: Map data, exploration, POI discovery
 * - characterReducer: Character state, XP, leveling, rest
 * - inventoryReducer: Items, equipment, survival resources
 * - combatReducer: Combat state and actions
 * - questReducer: Quest management
 * - shopReducer: Shop inventory and transactions
 * - explorationReducer: Interior/dungeon exploration
 */

import { gameReducer } from './gameReducer.js';
import { mapReducer } from './mapReducer.js';
import { characterReducer } from './characterReducer.js';
import { inventoryReducer } from './inventoryReducer.js';
import { combatReducer } from './combatReducer.js';
import { questReducer } from './questReducer.js';
import { shopReducer } from './shopReducer.js';
import { explorationReducer } from './explorationReducer.js';

/**
 * Combined reducer that delegates to specialized reducers
 * @param {object} state - Current state
 * @param {object} action - Action to process
 * @param {object} ACTIONS - Action type constants
 * @returns {object} New state
 */
export function combinedReducer(state, action, ACTIONS) {
  // Try each reducer in order until one handles the action
  const reducers = [
    gameReducer,
    mapReducer,
    characterReducer,
    inventoryReducer,
    combatReducer,
    questReducer,
    shopReducer,
    explorationReducer
  ];

  for (const reducer of reducers) {
    const newState = reducer(state, action, ACTIONS);
    if (newState !== null) {
      return newState;
    }
  }

  // No reducer handled this action
  console.warn(`Unhandled action type: ${action.type}`);
  return state;
}
