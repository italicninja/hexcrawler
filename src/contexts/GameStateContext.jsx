import { createContext, useContext, useReducer, useEffect, useRef, useMemo } from 'react';
import { Character } from '../game/Character.js';
import { Party } from '../game/Party.js';
import { createGameTime, advanceTime } from '../game/TimeManager.js';
import { SaveManager } from '../utils/SaveManager.js';
import { HexGrid } from '../utils/HexGrid';
import { getHexDistance, isHexReachable } from '../utils/hexMath';
import { GAME_DEFAULTS, TIME, COMBAT, SAVE } from '../constants/gameConstants';
import { combinedReducer } from './reducers/index';
import logger from '../utils/logger.js';

// Create context
const GameStateContext = createContext(null);

// Action types
const ACTIONS = {
  SET_PLAYER_POSITION: 'SET_PLAYER_POSITION',
  SET_PLAYER_CHARACTER: 'SET_PLAYER_CHARACTER',
  SET_PARTY: 'SET_PARTY',
  SET_MAP_DATA: 'SET_MAP_DATA',
  SET_MAP_SEED: 'SET_MAP_SEED',
  ADD_EXPLORED_HEX: 'ADD_EXPLORED_HEX',
  REVEAL_AROUND_PLAYER: 'REVEAL_AROUND_PLAYER',
  DISCOVER_POI: 'DISCOVER_POI',
  LOAD_GAME: 'LOAD_GAME',
  SET_CURRENT_SCENE: 'SET_CURRENT_SCENE',
  NEW_GAME: 'NEW_GAME',
  // Event blocking
  SET_ACTIVE_EVENT: 'SET_ACTIVE_EVENT',
  // Exploration actions
  SEARCH_POI: 'SEARCH_POI',
  SET_INTERIOR_MAP: 'SET_INTERIOR_MAP',
  SET_INTERIOR_PLAYER_POSITION: 'SET_INTERIOR_PLAYER_POSITION',
  ENTER_EXPLORATION: 'ENTER_EXPLORATION',
  EXIT_EXPLORATION: 'EXIT_EXPLORATION',
  DEFEAT_ENCOUNTER: 'DEFEAT_ENCOUNTER',
  COLLECT_LOOT: 'COLLECT_LOOT',
  TRIGGER_HAZARD: 'TRIGGER_HAZARD',
  DISCOVER_ENCOUNTER: 'DISCOVER_ENCOUNTER',
  DISCOVER_HAZARD: 'DISCOVER_HAZARD',
  DISCOVER_LOOT: 'DISCOVER_LOOT',
  UPDATE_CHARACTER: 'UPDATE_CHARACTER',
  // Time tracking
  ADVANCE_TIME: 'ADVANCE_TIME',
  UPDATE_PLAYTIME: 'UPDATE_PLAYTIME',
  // Rest actions
  SHORT_REST: 'SHORT_REST',
  LONG_REST: 'LONG_REST',
  INN_REST: 'INN_REST',
  // Inventory actions
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  EQUIP_ITEM: 'EQUIP_ITEM',
  UNEQUIP_ITEM: 'UNEQUIP_ITEM',
  // Survival actions
  CONSUME_RATIONS: 'CONSUME_RATIONS',
  CONSUME_WATER: 'CONSUME_WATER',
  FORAGE: 'FORAGE',
  FIND_WATER: 'FIND_WATER',
  APPLY_EXHAUSTION: 'APPLY_EXHAUSTION',
  // Combat actions
  START_COMBAT: 'START_COMBAT',
  RESOLVE_COMBAT: 'RESOLVE_COMBAT',
  PROCESS_COMBAT_ACTION: 'PROCESS_COMBAT_ACTION',
  PROCESS_COMBAT_MOVEMENT: 'PROCESS_COMBAT_MOVEMENT',
  ADVANCE_COMBAT_TURN: 'ADVANCE_COMBAT_TURN',
  END_COMBAT: 'END_COMBAT',
  UPDATE_COMBAT_STATE: 'UPDATE_COMBAT_STATE',
  // Combat action economy (D&D 5e)
  USE_COMBAT_ACTION: 'USE_COMBAT_ACTION',
  USE_COMBAT_BONUS_ACTION: 'USE_COMBAT_BONUS_ACTION',
  USE_COMBAT_REACTION: 'USE_COMBAT_REACTION',
  USE_COMBAT_MOVEMENT: 'USE_COMBAT_MOVEMENT',
  USE_FREE_OBJECT_INTERACTION: 'USE_FREE_OBJECT_INTERACTION',
  RESET_COMBAT_TURN_STATE: 'RESET_COMBAT_TURN_STATE',
  SET_COMBAT_TURN_STATE: 'SET_COMBAT_TURN_STATE',
  INCREMENT_ATTACK_COUNT: 'INCREMENT_ATTACK_COUNT',
  ADD_COMBAT_CONDITION: 'ADD_COMBAT_CONDITION',
  REMOVE_COMBAT_CONDITION: 'REMOVE_COMBAT_CONDITION',
  SET_READY_ACTION: 'SET_READY_ACTION',
  TRIGGER_READY_ACTION: 'TRIGGER_READY_ACTION',
  UPDATE_COMBATANT_HP: 'UPDATE_COMBATANT_HP',
  // XP and leveling actions
  AWARD_XP: 'AWARD_XP',
  LEVEL_UP_CHARACTER: 'LEVEL_UP_CHARACTER',
  // Quest actions
  ACCEPT_QUEST: 'ACCEPT_QUEST',
  UPDATE_QUEST_PROGRESS: 'UPDATE_QUEST_PROGRESS',
  COMPLETE_QUEST: 'COMPLETE_QUEST',
  FAIL_QUEST: 'FAIL_QUEST',
  GENERATE_TOWN_QUESTS: 'GENERATE_TOWN_QUESTS',
  REFRESH_QUESTS: 'REFRESH_QUESTS',
  // Shop actions
  GENERATE_SHOP_INVENTORY: 'GENERATE_SHOP_INVENTORY',
  BUY_ITEM: 'BUY_ITEM',
  SELL_ITEM: 'SELL_ITEM',
  // Town actions
  ENTER_TOWN: 'ENTER_TOWN',
  EXIT_TOWN: 'EXIT_TOWN',
};

// Initial state
const initialState = {
  playerPosition: GAME_DEFAULTS.START_POSITION,
  playerCharacter: null,
  party: null,
  mapData: null,
  mapSeed: '',
  hexGrid: null, // Spatial index for O(1) hex lookups
  regions: [], // Region data for biome clustering
  hexToRegion: null, // Map of hex coords to region IDs
  weatherSystem: null, // WeatherSystem instance for regional weather
  exploredHexes: new Set(),
  discoveredPOIs: new Set(),
  currentScene: 'title',
  newGameSeed: null,
  characterCreationSeed: null, // Store seed for character creation
  hasActiveEvent: false, // Blocks movement during active events (combat, etc.)
  // Exploration state
  interiorMaps: {},
  currentPOI: null,
  interiorPlayerPosition: null, // Player position inside POI/town
  inInterior: false, // Whether player is currently inside a POI/town
  explorationState: {
    searchedPOIs: new Set(),
    clearedEncounters: {},
    collectedLoot: {},
    triggeredHazards: {},
  },
  // Time tracking
  gameTime: createGameTime(),
  playtime: 0, // Total playtime in milliseconds
  // Combat state
  combatLog: [],
  combatState: {
    active: false,
    combat: null, // Combat instance
    battlefield: null, // {hexes, width, height}
    turnOrder: [], // Combatants with positions
    currentTurnIndex: 0,
    round: 1,
    encounterName: '',
    encounterType: 'standard',
    waitingForPlayerAction: false,
    movementRemaining: COMBAT.DEFAULT_MOVEMENT_FEET,
    // D&D 5e Action Economy
    turnState: {
      actionUsed: false, // Has main Action been used?
      bonusActionUsed: false, // Has Bonus Action been used?
      reactionUsed: false, // Has Reaction been used this round?
      movementUsed: 0, // Feet of movement used
      freeObjectUsed: false, // Has free object interaction been used?
      attacksMade: 0, // Number of attacks made (for Extra Attack)
      conditions: [], // Active conditions on current combatant [{type, duration, data}]
      readyAction: null, // Ready action waiting to trigger {actionType, trigger, data}
    },
  },
  // Quest state
  activeQuests: [],
  completedQuests: [],
  townQuests: {}, // Available quests per town, keyed by location (e.g., "10,7")
  // Shop state
  shopInventories: {}, // Keyed by POI location (e.g., "10,7" for hex coordinates)
};

// Reducer - Delegates to modular reducers
function gameStateReducer(state, action) {
  return combinedReducer(state, action, ACTIONS);
}

// Helper function - hex distance calculation
// Re-export hex math functions for backward compatibility
export { getHexDistance, isHexReachable } from '../utils/hexMath';
export function GameStateProvider({ children }) {
  const [state, dispatch] = useReducer(gameStateReducer, initialState);
  const playtimeStartRef = useRef(Date.now());
  const playtimeIntervalRef = useRef(null);

  // Playtime tracking - update every 10 seconds to reduce re-renders
  // During combat or other intensive scenes, frequent updates cause render loops
  useEffect(() => {
    if (state.currentScene !== 'title' && state.playerCharacter) {
      playtimeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - playtimeStartRef.current;
        playtimeStartRef.current = Date.now();

        dispatch({
          type: ACTIONS.UPDATE_PLAYTIME,
          payload: elapsed,
        });
      }, 10000); // Changed from 1000ms to 10000ms (10 seconds)

      return () => {
        if (playtimeIntervalRef.current) {
          clearInterval(playtimeIntervalRef.current);
        }
      };
    }
  }, [state.currentScene, state.playerCharacter]);

  // Event-based auto-save - triggers on specific state changes
  useEffect(() => {
    if (!state.playerCharacter || state.currentScene === 'title') {
      return; // Don't save on title screen or without character
    }

    // Auto-save to AUTOSAVE slot
    const shouldAutoSave =
      state.currentScene === 'overworld' ||
      state.currentScene === 'exploration' ||
      state.currentScene === 'town';

    if (shouldAutoSave) {
      // Debounce auto-save (wait 500ms after last state change)
      const timeoutId = setTimeout(() => {
        SaveManager.saveToSlot(SaveManager.SAVE_SLOTS.AUTOSAVE, state);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [
    state.currentScene,
    state.playerCharacter,
    state.gameTime, // Saves on time advancement (rest, travel)
    state.completedQuests.length, // Saves when quest completed
    state.combatState.active, // Saves when combat state changes (end of combat)
  ]);

  // Helper functions - memoized to prevent recreating on every render
  const helpers = useMemo(
    () => ({
      isHexExplored: (col, row) => state.exploredHexes.has(`${col},${row}`),

      isHexVisible: (col, row) => {
        if (!state.playerCharacter) return false;
        const distance = getHexDistance(
          state.playerPosition.col,
          state.playerPosition.row,
          col,
          row
        );
        return distance <= state.playerCharacter.viewDistance;
      },

      isHexReachable: (col, row) => {
        if (!state.playerCharacter) return false;
        const distance = getHexDistance(
          state.playerPosition.col,
          state.playerPosition.row,
          col,
          row
        );
        return distance <= state.playerCharacter.moveDistance;
      },

      isPoiDiscovered: (col, row) => state.discoveredPOIs.has(`${col},${row}`),

      shouldShowPOI: (poi, col, row) => {
        if (!poi) return false;
        // Towns are always visible
        if (poi.visibleWithoutDiscovery) return true;
        // Other POIs only visible if discovered
        return state.discoveredPOIs.has(`${col},${row}`);
      },

      isPoiSearched: (col, row) => state.explorationState.searchedPOIs.has(`${col},${row}`),

      getHexDistance,

      hasSave: () => SaveManager.hasSaveData(),

      loadGame: () => {
        // Note: This is kept for backward compatibility but SaveSlotManager handles loading now
        try {
          // Try to load from auto-save slot first
          const gameData = SaveManager.loadFromSlot(SaveManager.SAVE_SLOTS.AUTOSAVE);

          if (!gameData) {
            // Try slot 1 as fallback
            const slot1Data = SaveManager.loadFromSlot(SaveManager.SAVE_SLOTS.SLOT_1);
            if (!slot1Data) return false;

            dispatch({ type: ACTIONS.LOAD_GAME, payload: slot1Data });
            return true;
          }

          dispatch({ type: ACTIONS.LOAD_GAME, payload: gameData });
          return true;
        } catch (error) {
          logger.storage.error('Failed to load game', { error });
          return false;
        }
      },

      deleteSave: () => {
        // Delete old save format if it exists
        localStorage.removeItem('hexcrawl_save');
      },
    }),
    [state, dispatch]
  );

  // Memoize context value to prevent unnecessary re-renders
  // Only update when state actually changes, not on every provider render
  const value = useMemo(
    () => ({
      state,
      dispatch,
      actions: ACTIONS,
      ...helpers,
    }),
    [state, dispatch, helpers]
  );

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

// Custom hook to use game state
export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return context;
}

// Export ACTIONS for use in components
export { ACTIONS };
