import { createContext, useContext, useReducer, useEffect, useRef, useMemo } from 'react';
import { createGameTime } from '../game/TimeManager';
import { SaveManager } from '../utils/SaveManager';
import { getHexDistance } from '../utils/hexMath';
import { GAME_DEFAULTS, COMBAT } from '../constants/gameConstants';
import { combinedReducer } from './reducers/index';
import logger from '../utils/logger';
import type { GameState, Action, GameStateContextValue } from '../types/state';
import type { POI } from '../types/game';

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export const ACTIONS = {
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
  CHANGE_FLOOR: 'CHANGE_FLOOR',
  SET_INTERIOR_FLOOR: 'SET_INTERIOR_FLOOR',
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
  CLEAR_COMBAT_ANIMATION: 'CLEAR_COMBAT_ANIMATION',
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
} as const;

// ---------------------------------------------------------------------------
// Extended context value (superset of GameStateContextValue)
// ---------------------------------------------------------------------------

interface ExtendedContextValue extends GameStateContextValue {
  isHexVisible: (col: number, row: number) => boolean;
  isPoiSearched: (col: number, row: number) => boolean;
  hasSave: () => boolean;
  loadGame: () => boolean;
  deleteSave: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: GameState = {
  playerPosition: GAME_DEFAULTS.START_POSITION,
  playerCharacter: null,
  party: null,
  mapData: null,
  mapSeed: '',
  hexGrid: null,
  regions: [],
  hexToRegion: null,
  weatherSystem: null,
  exploredHexes: new Set<string>(),
  discoveredPOIs: new Set<string>(),
  currentScene: 'title',
  newGameSeed: null,
  characterCreationSeed: null,
  hasActiveEvent: false,
  // Interior/exploration state
  interiorMaps: {},
  interiorFloors: {},
  currentFloor: 0,
  interiorMap: null,
  currentPOI: null,
  interiorPlayerPosition: null,
  inInterior: false,
  explorationState: {
    searchedPOIs: new Set<string>(),
    clearedEncounters: {},
    collectedLoot: {},
    triggeredHazards: {},
  },
  // Time tracking
  gameTime: createGameTime(),
  playtime: 0,
  // Combat state
  combatLog: [],
  combatState: {
    active: false,
    combat: null,
    battlefield: null,
    turnOrder: [],
    currentTurnIndex: 0,
    round: 1,
    encounterName: '',
    encounterType: 'standard',
    waitingForPlayerAction: false,
    movementRemaining: COMBAT.DEFAULT_MOVEMENT_FEET,
    turnState: {
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      freeObjectUsed: false,
      attacksMade: 0,
      conditions: [],
      readyAction: null,
    },
  },
  // Quest state
  activeQuests: [],
  completedQuests: [],
  failedQuests: [],
  availableQuests: [],
  townQuests: {},
  // Shop state
  currentShop: null,
  shopInventories: {},
  // Misc
  activeEvent: null,
  pendingLoot: null,
  leveledUp: false,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const GameStateContext = createContext<ExtendedContextValue | null>(null);

// ---------------------------------------------------------------------------
// Reducer wrapper
// ---------------------------------------------------------------------------

function gameStateReducer(state: GameState, action: Action): GameState {
  return combinedReducer(state, action, ACTIONS);
}

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export { getHexDistance, isHexReachable } from '../utils/hexMath';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameStateReducer, initialState);
  const playtimeStartRef = useRef<number>(Date.now());
  const playtimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playtime tracking - update every 10 seconds to reduce re-renders
  useEffect(() => {
    if (state.currentScene !== 'title' && state.playerCharacter) {
      playtimeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - playtimeStartRef.current;
        playtimeStartRef.current = Date.now();

        dispatch({
          type: ACTIONS.UPDATE_PLAYTIME,
          payload: elapsed,
        });
      }, 10000);

      return () => {
        if (playtimeIntervalRef.current) {
          clearInterval(playtimeIntervalRef.current);
        }
      };
    }
    return undefined;
  }, [state.currentScene, state.playerCharacter]);

  // Event-based auto-save
  useEffect(() => {
    if (!state.playerCharacter || state.currentScene === 'title') {
      return undefined;
    }

    const scene = state.currentScene as string;
    const shouldAutoSave = scene === 'overworld' || scene === 'exploration' || scene === 'town';

    if (shouldAutoSave) {
      const timeoutId = setTimeout(() => {
        SaveManager.saveToSlot(SaveManager.SAVE_SLOTS.AUTOSAVE, state);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [
    state.currentScene,
    state.playerCharacter,
    state.gameTime,
    state.completedQuests.length,
    state.combatState?.active,
  ]);

  // Helper functions - memoized to prevent recreating on every render
  const helpers = useMemo(
    () => ({
      isHexExplored: (col: number, row: number) => state.exploredHexes.has(`${col},${row}`),

      isHexVisible: (col: number, row: number) => {
        if (!state.playerCharacter || !state.playerPosition) return false;
        const distance = getHexDistance(
          state.playerPosition.col,
          state.playerPosition.row,
          col,
          row
        );
        return distance <= state.playerCharacter.viewDistance;
      },

      isHexReachable: (col: number, row: number) => {
        if (!state.playerCharacter || !state.playerPosition) return false;
        const distance = getHexDistance(
          state.playerPosition.col,
          state.playerPosition.row,
          col,
          row
        );
        return distance <= state.playerCharacter.moveDistance;
      },

      isPoiDiscovered: (col: number, row: number) => state.discoveredPOIs.has(`${col},${row}`),

      shouldShowPOI: (poi: POI, col: number, row: number) => {
        if (!poi) return false;
        if (poi.visibleWithoutDiscovery) return true;
        return state.discoveredPOIs.has(`${col},${row}`);
      },

      isPoiSearched: (col: number, row: number) =>
        state.explorationState.searchedPOIs.has(`${col},${row}`),

      getHexDistance,

      hasSave: () => SaveManager.hasSaveData(),

      loadGame: (): boolean => {
        try {
          const gameData = SaveManager.loadFromSlot(SaveManager.SAVE_SLOTS.AUTOSAVE);

          if (!gameData) {
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
        localStorage.removeItem('hexcrawl_save');
      },
    }),
    [state, dispatch]
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<ExtendedContextValue>(
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameState(): ExtendedContextValue {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return context;
}
