import { createGameTime } from '../game/TimeManager';
import { GAME_DEFAULTS, COMBAT } from '../constants/gameConstants';
import type { GameState } from '../types/state';

/**
 * Fresh initial game state. A function (not a shared object) so every caller —
 * the provider and NEW_GAME — gets its own Sets and game clock.
 */
export function createInitialState(): GameState {
  return {
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
}
