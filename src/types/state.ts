/**
 * Game State Type Definitions
 */

import type { Character } from '../game/Character';
import type { Party } from '../game/Party';
import type { Combat } from '../game/Combat';
import type { Shop } from '../game/Shop';
import type { HexGrid } from '../utils/HexGrid';
import type { Hex, HexCoordinates, GameTime, Quest, POI, CombatHex } from './game';

export type SceneType =
  | 'title'
  | 'character-creation'
  | 'overworld'
  | 'exploration'
  | 'combat'
  | 'gameover';

export interface GameState {
  // Core state
  currentScene: SceneType;
  playerPosition: HexCoordinates;
  playerCharacter: Character | null;
  party: Party | null;

  // Map state
  mapData: Hex[] | null;
  mapSeed: string;
  hexGrid: HexGrid | null;
  exploredHexes: Set<string>; // hexKey (col,row)
  discoveredPOIs: Set<string>; // hexKey

  // Time
  gameTime: GameTime;
  playtime: number; // milliseconds

  // Interior/exploration state
  inInterior: boolean;
  currentPOI: { poi: POI; col: number; row: number } | null;
  interiorMap: any | null; // TODO: Type interior map structure
  interiorPlayerPosition: HexCoordinates | null;

  // Combat state
  inCombat: boolean;
  combat: Combat | null;
  battlefield: CombatHex[][] | null;
  combatPositions: Map<string, HexCoordinates> | null;

  // Quest state
  activeQuests: Quest[];
  completedQuests: Quest[];
  failedQuests: Quest[];
  availableQuests: Quest[];
  townQuests: Record<string, Quest[]>; // hexKey -> quests

  // Shop state
  currentShop: Shop | null;
  shopInventories: Record<string, any>; // hexKey -> shop data

  // Misc
  newGameSeed: string | null;
  activeEvent: any | null; // TODO: Type active event
  pendingLoot: any | null; // TODO: Type loot structure
  leveledUp: boolean;
}

// Action type definitions
export interface Action<T = any> {
  type: string;
  payload?: T;
}

// Context value type
export interface GameStateContextValue {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  actions: Record<string, string>; // Action constants
  isHexReachable: (col: number, row: number) => boolean;
  isHexExplored: (col: number, row: number) => boolean;
  isPoiDiscovered: (col: number, row: number) => boolean;
  shouldShowPOI: (poi: POI, col: number, row: number) => boolean;
  getHexDistance: (col1: number, row1: number, col2: number, row2: number) => number;
}
