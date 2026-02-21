/**
 * Game Reducer - Handles core game state, scenes, time, and save/load
 *
 * Actions handled:
 * - SET_CURRENT_SCENE
 * - NEW_GAME
 * - LOAD_GAME
 * - ADVANCE_TIME
 * - UPDATE_PLAYTIME
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Character } from '../../game/Character';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Party } from '../../game/Party';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Quest } from '../../game/Quest';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Shop } from '../../game/Shop';
import { createGameTime, advanceTime } from '../../game/TimeManager';
import { GAME_DEFAULTS, COMBAT } from '../../constants/gameConstants';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { WeatherSystem } from '../../WeatherSystem';
import type { GameState, Action } from '../../types/state';
import logger from '../../utils/logger';

export function gameReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): GameState | null {
  switch (action.type) {
    case ACTIONS.SET_CURRENT_SCENE:
      return {
        ...state,
        currentScene: action.payload,
      };

    case ACTIONS.NEW_GAME: {
      const mapSeed = action.payload;

      // Transition to character creation scene instead of creating default character
      // This matches the expected flow: Title -> CharacterCreation -> Overworld
      return {
        ...state,
        playerPosition: GAME_DEFAULTS.START_POSITION,
        playerCharacter: null,
        party: null,
        mapData: null,
        mapSeed,
        hexGrid: null,
        regions: [],
        hexToRegion: null,
        weatherSystem: null,
        exploredHexes: new Set(),
        discoveredPOIs: new Set(),
        currentScene: 'characterCreation',
        characterCreationSeed: mapSeed,
        hasActiveEvent: false,
        interiorMaps: {},
        currentPOI: null,
        interiorPlayerPosition: null,
        inInterior: false,
        explorationState: {
          searchedPOIs: new Set(),
          clearedEncounters: {},
          collectedLoot: {},
          triggeredHazards: {},
        },
        gameTime: createGameTime(),
        playtime: 0,
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
        },
        activeQuests: [],
        completedQuests: [],
        townQuests: {},
        shopInventories: {},
      };
    }

    case ACTIONS.LOAD_GAME: {
      const loadedState = action.payload;

      // Reconstruct class instances
      let playerCharacter = null;
      if (loadedState.playerCharacter) {
        playerCharacter = Character.fromJSON(loadedState.playerCharacter);
      }

      let party = null;
      if (loadedState.party) {
        party = Party.fromJSON(loadedState.party);
      }

      // Reconstruct Sets
      const exploredHexes = new Set(loadedState.exploredHexes || []);
      const discoveredPOIs = new Set(loadedState.discoveredPOIs || []);

      // Reconstruct regions (convert boundaries back to Sets)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let regions: any[] = [];
      if (loadedState.regions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        regions = (loadedState.regions as any[]).map((region: any) => ({
          ...region,
          boundaries: new Set(region.boundaries || []),
        }));
      }

      // Reconstruct hexToRegion Map
      let hexToRegion = null;
      if (loadedState.hexToRegion) {
        hexToRegion = new Map(Object.entries(loadedState.hexToRegion));
      }

      // Reconstruct weather system
      let weatherSystem = null;
      if (loadedState.weatherSystem && regions.length > 0) {
        try {
          weatherSystem = WeatherSystem.fromJSON(loadedState.weatherSystem, regions);
        } catch (error) {
          logger.state.error('Failed to restore weather system, will regenerate', error);
          weatherSystem = null;
        }
      }

      // Reconstruct explorationState Sets
      const clearedEncounters: Record<string, Set<string>> = {};
      const collectedLoot: Record<string, Set<string>> = {};
      const triggeredHazards: Record<string, Set<string>> = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const es = loadedState.explorationState as any;
      Object.keys(es?.clearedEncounters || {}).forEach(key => {
        clearedEncounters[key] = new Set(es.clearedEncounters[key]);
      });
      Object.keys(es?.collectedLoot || {}).forEach(key => {
        collectedLoot[key] = new Set(es.collectedLoot[key]);
      });
      Object.keys(es?.triggeredHazards || {}).forEach(key => {
        triggeredHazards[key] = new Set(es.triggeredHazards[key]);
      });

      const explorationState = {
        searchedPOIs: new Set<string>(es?.searchedPOIs || []),
        clearedEncounters,
        collectedLoot,
        triggeredHazards,
      };

      // Reconstruct Quest instances
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeQuests = ((loadedState.activeQuests as any[]) || []).map((q: any) =>
        Quest.fromJSON(q)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completedQuests = ((loadedState.completedQuests as any[]) || []).map((q: any) =>
        Quest.fromJSON(q)
      );

      // Reconstruct Shop instances
      const shopInventories: Record<string, unknown> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.entries((loadedState.shopInventories as any) || {}).forEach(([key, shopData]) => {
        shopInventories[key] = Shop.fromJSON(shopData);
      });

      return {
        ...state,
        ...loadedState,
        playerCharacter,
        party,
        exploredHexes,
        discoveredPOIs,
        regions,
        hexToRegion,
        weatherSystem,
        explorationState,
        activeQuests,
        completedQuests,
        shopInventories,
        // Don't restore combat state
        inCombat: false,
        combat: null,
        battlefield: null,
        combatPositions: null,
      };
    }

    case ACTIONS.ADVANCE_TIME:
      return {
        ...state,
        gameTime: advanceTime(state.gameTime, action.payload),
      };

    case ACTIONS.UPDATE_PLAYTIME:
      return {
        ...state,
        playtime: (state.playtime || 0) + action.payload,
      };

    default:
      return null; // Action not handled by this reducer
  }
}
