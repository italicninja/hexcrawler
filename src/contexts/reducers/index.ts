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

/**
 * Combined reducer that delegates to specialized reducers
 * @param state - Current state
 * @param action - Action to process
 * @param ACTIONS - Action type constants
 * @returns New state
 */
const dispatchHistory: Array<{ action: string; timestamp: number }> = [];
const DISPATCH_WINDOW_MS = 1000; // 1 second
const MAX_DISPATCHES_PER_WINDOW = 200; // Increased - movement dispatches 5+ actions per hex

export function combinedReducer(state: GameState, action: Action, ACTIONS: Record<string, string>): GameState {
  // Debug: Track dispatches in a time window to detect infinite loops
  const now = Date.now();
  dispatchHistory.push({ action: action.type, timestamp: now });
  
  // Remove old entries outside the time window
  while (dispatchHistory.length > 0 && dispatchHistory[0].timestamp < now - DISPATCH_WINDOW_MS) {
    dispatchHistory.shift();
  }
  
  // Check for infinite loop - detect same action repeating rapidly
  if (dispatchHistory.length > MAX_DISPATCHES_PER_WINDOW) {
    // Count how many times the same action appears in recent history
    const actionCounts: Record<string, number> = {};
    dispatchHistory.forEach(d => {
      actionCounts[d.action] = (actionCounts[d.action] || 0) + 1;
    });
    
    // Find the most frequent action
    const maxCount = Math.max(...Object.values(actionCounts));
    const mostFrequent = Object.entries(actionCounts).find(([_, count]) => count === maxCount)?.[0];
    
    // Warn about high dispatch rate (but don't throw unless it's a true loop)
    if (dispatchHistory.length > 150) {
      console.warn(`High dispatch rate: ${dispatchHistory.length} in ${DISPATCH_WINDOW_MS}ms. Top actions:`, 
        Object.entries(actionCounts).sort(([,a], [,b]) => b - a).slice(0, 5).map(([action, count]) => `${action}(${count})`).join(', ')
      );
    }
    
    // Only throw if a single action is repeating excessively (likely infinite loop)
    // Movement generates many different actions (SET_PLAYER_POSITION, ADVANCE_TIME, etc.) which is normal
    if (maxCount > 100) {
      const recentActions = dispatchHistory.slice(-10).map(d => d.action);
      console.error(`Infinite loop detected! Action "${mostFrequent}" dispatched ${maxCount} times in ${DISPATCH_WINDOW_MS}ms. Last 10:`, recentActions);
      dispatchHistory.length = 0; // Clear to avoid spam
      throw new Error(`Infinite dispatch loop detected - action "${mostFrequent}" repeating`);
    }
  }
  
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
