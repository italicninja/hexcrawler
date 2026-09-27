/**
 * Shared loosely-typed shapes used by the scene components
 * (OverworldScene, CombatSceneWrapper, and the scene-level hooks).
 */

export interface Coord {
  col: number;
  row: number;
}

export interface ScenePoi {
  type?: string;
  name?: string;
  cr?: number;
  creatures?: string;
  eventType?: string;
  description?: string;
  isBoss?: boolean;
}

/** Where a fight came from, so END_COMBAT can mark it cleared. */
export type EncounterSource =
  | { kind: 'poi'; col: number; row: number }
  | { kind: 'interior'; mapKey: string; floorKey: string; col: number; row: number };

export interface SceneInteriorMap {
  hexes: SceneHex[];
  entrance?: Coord;
  encounters?: unknown[];
  loot?: unknown[];
  hazards?: unknown[];
  [key: string]: unknown;
}

/** Loosely-typed hex used across the overworld/interior UI. */
export interface SceneHex {
  col: number;
  row: number;
  terrain?: {
    name?: string;
    key?: string;
    walkable?: boolean;
    isInteractive?: boolean;
    difficulty?: number;
  };
  content?: string | null;
  poi?: ScenePoi | null;
  weather?: { condition?: string } | null;
  buildingType?: string;
  buildingName?: string;
  connectedFloor?: number;
}

export interface CombatUIState {
  selectedAction: string | null;
  selectedTarget: unknown;
  hoveredHex: Coord | null;
  cameraOffset: { x: number; y: number };
  cameraZoom: number;
  attacksUsedThisTurn: number;
}
