/**
 * Core Game Type Definitions
 *
 * These types define the fundamental data structures used throughout the game.
 */

// ============================================================================
// D&D 5e Core Types
// ============================================================================

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export type AbilityName = keyof AbilityScores;

export interface Skills {
  athletics: number;
  acrobatics: number;
  sleightOfHand: number;
  stealth: number;
  arcana: number;
  history: number;
  investigation: number;
  nature: number;
  religion: number;
  animalHandling: number;
  insight: number;
  medicine: number;
  perception: number;
  survival: number;
  deception: number;
  intimidation: number;
  performance: number;
  persuasion: number;
}

export type SkillName = keyof Skills;

export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'poison'
  | 'acid'
  | 'thunder'
  | 'force'
  | 'necrotic'
  | 'radiant'
  | 'psychic';

export type CharacterClass =
  | 'fighter'
  | 'wizard'
  | 'cleric'
  | 'rogue'
  | 'ranger'
  | 'barbarian'
  | 'paladin'
  | 'druid'
  | 'bard'
  | 'sorcerer'
  | 'warlock'
  | 'monk';

// ============================================================================
// Hex & Map Types
// ============================================================================

export interface HexCoordinates {
  col: number;
  row: number;
}

export interface TerrainType {
  key: string;
  name: string;
  color: string;
  difficulty: number;
  traversable: boolean;
  richness?: number; // For foraging
}

export interface Hex extends HexCoordinates {
  terrain: TerrainType;
  poi?: POI;
  explored?: boolean;
  discovered?: boolean;
}

export interface MapBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

// ============================================================================
// POI (Point of Interest) Types
// ============================================================================

export type POIType =
  | 'town'
  | 'village'
  | 'camp'
  | 'dungeon'
  | 'cave'
  | 'ruins'
  | 'tower'
  | 'shrine'
  | 'lair'
  | 'starting_cache';

export type EventType = 'passive' | 'active' | 'ambush';

export interface POI {
  type: POIType;
  name: string;
  cr: number; // Challenge Rating
  creatures?: string;
  loot?: string;
  eventType: EventType;
  visibleWithoutDiscovery: boolean;
  terrainType?: string;
}

// ============================================================================
// Time Types
// ============================================================================

export interface GameTime {
  day: number;
  hour: number;
  minute: number;
}

// ============================================================================
// Item Types
// ============================================================================

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary';

export type ItemSlot =
  | 'head'
  | 'chest'
  | 'legs'
  | 'feet'
  | 'hands'
  | 'mainHand'
  | 'offHand'
  | 'ring'
  | 'neck'
  | 'back';

export interface Item {
  id: string;
  name: string;
  type: string;
  rarity: ItemRarity;
  value: number;
  weight: number;
  description?: string;
  slot?: ItemSlot;
  properties?: Record<string, any>;
}

// ============================================================================
// Combat Types
// ============================================================================

export interface CombatHex extends HexCoordinates {
  terrain: string;
  difficult?: boolean;
  blocking?: boolean;
}

export interface HexContext {
  terrainKey: string; // overworld terrain key: 'grassland' | 'forest' | 'hills' | 'mountains' | 'desert' | 'swamp' | 'tundra' | 'water' | 'river'
  terrainName: string; // human-readable name e.g. 'Forest'
  terrainColor: string; // base hex color e.g. '#228B22'
  elevation: number; // 0–10, Perlin-derived, influences obstacle density
  weather: string; // weather condition string e.g. 'Clear', 'Rain', 'Snow', 'Fog'
  poiType?: string; // optional POI type e.g. 'dungeon', 'village', 'ruins', 'temple', 'cave', 'camp'
  regionBiome?: string; // optional region biome e.g. 'TROPICAL_JUNGLE', 'ARCTIC_TUNDRA'
}

export interface Combatant {
  id: string;
  name: string;
  hp: number;
  maxHP: number;
  ac: number;
  initiative: number;
  isPlayer: boolean;
  position?: HexCoordinates;
  movementRemaining?: number;
  actionUsed?: boolean;
  bonusActionUsed?: boolean;
}

export type EncounterType = 'standard' | 'ambush' | 'boss';

// ============================================================================
// Quest Types
// ============================================================================

export type QuestType = 'kill' | 'fetch' | 'explore' | 'escort' | 'deliver';
export type QuestStatus = 'available' | 'active' | 'completed' | 'failed';

export interface QuestRewards {
  gold?: number;
  xp?: number;
  items?: Item[];
}

export interface Quest {
  id: string;
  type: QuestType;
  name: string;
  description: string;
  objectives: string[];
  rewards: QuestRewards;
  status: QuestStatus;
  progress: number;
  location?: HexCoordinates;
  completedAt?: number;
  failedAt?: number;
}

// ============================================================================
// Save/Load Types
// ============================================================================

export interface SaveMetadata {
  slotId: number;
  characterName: string;
  characterLevel: number;
  characterClass: CharacterClass;
  location: string;
  day: number;
  playtime: number;
  timestamp: number;
  version: string;
}

export interface SaveSlot {
  metadata: SaveMetadata | null;
  data: any | null; // Full game state
}

// ============================================================================
// Game Log Types
// ============================================================================

export type LogMessageType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'action'
  | 'discovery'
  | 'encounter'
  | 'system'
  | 'poi-interaction';

export interface LogMessage {
  id: string;
  text: string;
  type: LogMessageType;
  timestamp: number;
}
