/**
 * Game State Type Definitions
 */

import type { HexGrid } from '../utils/HexGrid';
import type { Hex, HexCoordinates, GameTime, Quest, POI, CombatHex } from './game';

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export type SceneType =
  | 'title'
  | 'character-creation'
  | 'characterCreation'
  | 'overworld'
  | 'exploration'
  | 'combat'
  | 'gameover';

// ---------------------------------------------------------------------------
// Loosely-typed class stubs (will be replaced when game/ files are converted)
// ---------------------------------------------------------------------------

/** @todo Replace with real Character class type when Character.js → .ts */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CharacterInstance = any;

/** @todo Replace with real Party class type when Party.js → .ts */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PartyInstance = any;

/** @todo Replace with real Combat class type when Combat.js → .ts */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CombatInstance = any;

/** @todo Replace with real Shop class type when Shop.js → .ts */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ShopInstance = any;

/** @todo Replace with real WeatherSystem type when WeatherSystem.js → .ts */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WeatherSystemInstance = any;

// ---------------------------------------------------------------------------
// Region
// ---------------------------------------------------------------------------

export interface Region {
  id: string | number;
  biome: string;
  climate: string;
  elevation: number;
  moisture: number;
  temperature: number;
  boundaries: Set<string>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Exploration state
// ---------------------------------------------------------------------------

export interface ExplorationState {
  searchedPOIs: Set<string>;
  clearedEncounters: Record<string, Set<string>>;
  collectedLoot: Record<string, Set<string>>;
  triggeredHazards: Record<string, Set<string>>;
}

// ---------------------------------------------------------------------------
// Combat state (the new tactical system)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CombatTurnEntry {
  id: string;
  name: string;
  currentHP: number;
  maxHP: number;
  isAlly: boolean;
  isEnemy?: boolean;
  position: HexCoordinates | null;
  character?: any;
  enemy?: any;
  characterClass?: string;
  initiative?: number;
  statusEffects?: any[];
  aiConfig?: unknown;
  attackRange?: number;
  conditions?: any[];
  hp?: number;
  [key: string]: unknown;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TurnState {
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  freeObjectUsed: boolean;
  movementUsed: number;
  attacksMade: number;
  readyAction: unknown | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditions: any[];
  [key: string]: unknown;
}

export interface CombatStateData {
  active: boolean;
  combat: CombatInstance | null;
  battlefield: CombatHex[][] | null;
  turnOrder: CombatTurnEntry[];
  currentTurnIndex: number;
  round: number;
  encounterName: string;
  encounterType: string;
  waitingForPlayerAction: boolean;
  movementRemaining: number;
  turnState: TurnState;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Interior map
// ---------------------------------------------------------------------------

export interface InteriorMap {
  entrance: HexCoordinates;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encounters: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hazards: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loot: any[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// GameState
// ---------------------------------------------------------------------------

export interface GameState {
  // Core state
  currentScene: SceneType;
  playerPosition: HexCoordinates;
  playerCharacter: CharacterInstance | null;
  party: PartyInstance | null;

  // Map state
  mapData: Hex[] | null;
  mapSeed: string;
  hexGrid: HexGrid | null;
  exploredHexes: Set<string>; // hexKey "col,row"
  discoveredPOIs: Set<string>; // hexKey

  // Region / biome state
  regions: Region[];
  hexToRegion: Map<string, string | number> | null;
  weatherSystem: WeatherSystemInstance | null;

  // Time
  gameTime: GameTime;
  playtime: number; // milliseconds

  // Interior/exploration state
  inInterior: boolean;
  currentPOI: { poi: POI; col: number; row: number } | null;
  interiorMap: InteriorMap | null; // legacy field
  interiorMaps: Record<string, InteriorMap>; // poiKey → map  (single-floor POIs)
  interiorFloors: Record<string, InteriorMap>; // floorKey "col,row:N" → floor map
  currentFloor: number; // active floor index (0 = ground)
  interiorPlayerPosition: HexCoordinates | null;
  explorationState: ExplorationState;

  // Combat state (new tactical system)
  combatState: CombatStateData | null;
  combatLog: string[];

  // Legacy combat fields (kept for backward compat)
  inCombat: boolean;
  combat: CombatInstance | null;
  battlefield: CombatHex[][] | null;
  combatPositions: Map<string, HexCoordinates> | null;

  // Quest state
  activeQuests: Quest[];
  completedQuests: Quest[];
  failedQuests: Quest[];
  availableQuests: Quest[];
  townQuests: Record<string, Quest[]>; // hexKey → quests

  // Shop state
  currentShop: ShopInstance | null;
  shopInventories: Record<string, ShopInstance>; // hexKey → shop

  // Misc
  newGameSeed: string | null;
  characterCreationSeed: string | null;
  activeEvent: unknown | null;
  pendingLoot: unknown | null;
  leveledUp: boolean;
  hasActiveEvent: boolean;

  // Allow extra fields from legacy code
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Action<T = any> {
  type: string;
  payload?: T;
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

export interface GameStateContextValue {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  actions: Record<string, string>;
  isHexReachable: (col: number, row: number) => boolean;
  isHexExplored: (col: number, row: number) => boolean;
  isPoiDiscovered: (col: number, row: number) => boolean;
  shouldShowPOI: (poi: POI, col: number, row: number) => boolean;
  getHexDistance: (col1: number, row1: number, col2: number, row2: number) => number;
}
