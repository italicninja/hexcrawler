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

import { gameReducer } from './gameReducer';
import { mapReducer } from './mapReducer';
import { characterReducer } from './characterReducer';
import { inventoryReducer } from './inventoryReducer';
import { combatReducer } from './combatReducer';
import { questReducer } from './questReducer';
import { shopReducer } from './shopReducer';
import { explorationReducer } from './explorationReducer';

import type { GameState, Action } from '../../types/state';

type ReducerFunction = (state: GameState, action: Action, ACTIONS: Record<string, string>) => GameState | null;

/**
 * Combined reducer that delegates to specialized reducers
 * @param state - Current state
 * @param action - Action to process
 * @param ACTIONS - Action type constants
 * @returns New state
 */
export function combinedReducer(state: GameState, action: Action, ACTIONS: Record<string, string>): GameState {
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
