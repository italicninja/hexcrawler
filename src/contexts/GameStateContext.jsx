import { createContext, useContext, useReducer, useEffect } from 'react';
import { Character } from '../game/Character.js';
import { Party } from '../game/Party.js';

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
  LOAD_GAME: 'LOAD_GAME',
  SET_CURRENT_SCENE: 'SET_CURRENT_SCENE',
  NEW_GAME: 'NEW_GAME'
};

// Initial state
const initialState = {
  playerPosition: { col: 10, row: 7 },
  playerCharacter: null,
  party: null,
  mapData: null,
  mapSeed: '',
  exploredHexes: new Set(),
  currentScene: 'title',
  newGameSeed: null
};

// Reducer
function gameStateReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_PLAYER_POSITION:
      return {
        ...state,
        playerPosition: action.payload,
        exploredHexes: new Set([
          ...state.exploredHexes,
          `${action.payload.col},${action.payload.row}`
        ])
      };

    case ACTIONS.SET_PLAYER_CHARACTER:
      return { ...state, playerCharacter: action.payload };

    case ACTIONS.SET_PARTY:
      return { ...state, party: action.payload };

    case ACTIONS.SET_MAP_DATA:
      return { ...state, mapData: action.payload };

    case ACTIONS.SET_MAP_SEED:
      return { ...state, mapSeed: action.payload };

    case ACTIONS.ADD_EXPLORED_HEX:
      return {
        ...state,
        exploredHexes: new Set([...state.exploredHexes, action.payload])
      };

    case ACTIONS.REVEAL_AROUND_PLAYER: {
      const { col, row } = action.payload;
      const radius = 2; // View range
      const newExplored = new Set(state.exploredHexes);

      for (let r = row - radius; r <= row + radius; r++) {
        for (let c = col - radius; c <= col + radius; c++) {
          const distance = getHexDistance(col, row, c, r);
          if (distance <= radius) {
            newExplored.add(`${c},${r}`);
          }
        }
      }

      return { ...state, exploredHexes: newExplored };
    }

    case ACTIONS.LOAD_GAME:
      return {
        ...state,
        ...action.payload,
        exploredHexes: new Set(action.payload.exploredHexes || [])
      };

    case ACTIONS.SET_CURRENT_SCENE:
      return { ...state, currentScene: action.payload };

    case ACTIONS.NEW_GAME:
      return {
        ...initialState,
        mapSeed: action.payload,
        currentScene: 'overworld',
        playerCharacter: new Character('Hero', 'paladin'),
        party: (() => {
          const party = new Party();
          party.setPlayer(new Character('Hero', 'paladin'));
          party.createPlaceholderNPCs();
          return party;
        })()
      };

    default:
      return state;
  }
}

// Helper function - hex distance calculation
function getHexDistance(col1, row1, col2, row2) {
  const x1 = col1 - Math.floor(row1 / 2);
  const z1 = row1;
  const y1 = -x1 - z1;

  const x2 = col2 - Math.floor(row2 / 2);
  const z2 = row2;
  const y2 = -x2 - z2;

  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

// Provider component
export function GameStateProvider({ children }) {
  const [state, dispatch] = useReducer(gameStateReducer, initialState);

  // Auto-save to localStorage on state changes
  useEffect(() => {
    if (state.currentScene === 'overworld' && state.playerCharacter) {
      const saveData = {
        version: '2.0',
        timestamp: Date.now(),
        playerPosition: state.playerPosition,
        playerCharacter: state.playerCharacter?.toJSON(),
        party: state.party?.toJSON(),
        currentScene: state.currentScene,
        mapSeed: state.mapSeed,
        exploredHexes: Array.from(state.exploredHexes),
        mapData: state.mapData
      };

      try {
        localStorage.setItem('hexcrawl_save', JSON.stringify(saveData));
      } catch (error) {
        console.error('Failed to save game:', error);
      }
    }
  }, [state]);

  // Helper functions
  const helpers = {
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

    getHexDistance,

    hasSave: () => localStorage.getItem('hexcrawl_save') !== null,

    loadGame: () => {
      try {
        const saveDataStr = localStorage.getItem('hexcrawl_save');
        if (!saveDataStr) return false;

        const saveData = JSON.parse(saveDataStr);

        // Reconstruct Character and Party from JSON
        const playerCharacter = saveData.playerCharacter
          ? Character.fromJSON(saveData.playerCharacter)
          : null;

        const party = saveData.party
          ? Party.fromJSON(saveData.party)
          : null;

        dispatch({
          type: ACTIONS.LOAD_GAME,
          payload: {
            ...saveData,
            playerCharacter,
            party
          }
        });

        return true;
      } catch (error) {
        console.error('Failed to load game:', error);
        return false;
      }
    },

    deleteSave: () => {
      localStorage.removeItem('hexcrawl_save');
    }
  };

  const value = {
    state,
    dispatch,
    actions: ACTIONS,
    ...helpers
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

// Custom hook to use game state
export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return context;
}
