/**
 * Game Constants - Centralized configuration values
 *
 * Extracted from hardcoded magic numbers across the codebase
 * for better maintainability and clarity
 */

// ===================
// FEATURE FLAGS
// ===================
export const FEATURES = {
  /**
   * Survival mechanics: ration consumption on movement, foraging, starvation
   * exhaustion from hunger, and the Survival menu / HUD indicators.
   * Set to true to re-enable when the system is ready.
   */
  SURVIVAL_ENABLED: false,
};

// ===================
// GAME DEFAULTS
// ===================
export const GAME_DEFAULTS = {
  START_POSITION: { col: 10, row: 7 },
  ABILITY_SCORE: 10,
  BASE_HP: 10,
  BASE_AC: 10,
  VIEW_RADIUS: 2,
  MOVE_DISTANCE: 6,
  PROFICIENCY_BONUS: 2,
  /** The POI type placed on the spawn hex — player begins the game inside this */
  START_POI_TYPE: 'starting_cache' as const,
};

// ===================
// STARTING CACHE
// ===================
/**
 * The Waylaid Traveler's Cache — a tiny CR 0 POI where the player wakes up.
 * It contains starter loot, no real combat, and a clearly marked Exit Hex.
 */
export const STARTING_CACHE = {
  CR: 0,
  /** Interior grid dimensions — wide enough for 3 rooms of at least 4 tiles each */
  WIDTH: 22,
  HEIGHT: 9,
  /** Names drawn randomly on generation */
  NAMES: [
    "Waylaid Traveler's Cache",
    'The Collapsed Watchtower Cellar',
    "Smuggler's Hollow",
    "The Old Hermit's Burrow",
    'Mossy Stone Grotto',
    "Bandit's Forgotten Stash",
    'Crumbled Roadside Shrine',
    "Pilgrim's Rest Cave",
  ],
  DESCRIPTIONS: [
    'A small shelter where you find yourself after losing consciousness on the road. Dusty, but safe — for now.',
    'A collapsed watchtower cellar. Whoever used this place left in a hurry.',
    "A smuggler's hollow carved into the hillside. Someone clearly lived here once.",
    "A hermit's burrow. The old occupant is long gone, but their provisions remain.",
    'A mossy grotto barely large enough to stand in. A trickle of water runs along one wall.',
  ],
  /** Starter loot tables */
  STARTER_GOLD_MIN: 8,
  STARTER_GOLD_MAX: 30,
  /** Misc gear — each entry is an Item config object */
  STARTER_ITEMS: [
    {
      name: 'Bedroll',
      type: 'misc',
      rarity: 'common',
      description: 'A rolled-up sleeping mat.',
      weight: 7,
      value: 1,
    },
    {
      name: 'Tinderbox',
      type: 'misc',
      rarity: 'common',
      description: 'Flint, steel, and tinder for starting fires.',
      weight: 1,
      value: 5,
    },
    {
      name: 'Torches (3)',
      type: 'misc',
      rarity: 'common',
      description: 'Three torches. Each burns for about an hour.',
      weight: 3,
      value: 1,
    },
    {
      name: 'Waterskin',
      type: 'misc',
      rarity: 'common',
      description: 'A leather waterskin, full.',
      weight: 5,
      value: 2,
    },
    {
      name: 'Trail Rations (3 days)',
      type: 'consumable',
      rarity: 'common',
      description: 'Dried meat, hardtack, and nuts. Enough for three days.',
      weight: 6,
      value: 5,
      consumable: true,
    },
    {
      name: 'Rope (50 ft)',
      type: 'misc',
      rarity: 'common',
      description: 'Fifty feet of hempen rope.',
      weight: 10,
      value: 1,
    },
    {
      name: 'Hooded Lantern',
      type: 'misc',
      rarity: 'common',
      description: 'A lantern that can be shuttered to hide its light.',
      weight: 2,
      value: 5,
    },
    {
      name: "Healer's Kit",
      type: 'consumable',
      rarity: 'common',
      description: 'Bandages, salves, and splints. Stabilise a dying creature.',
      weight: 3,
      value: 5,
      consumable: false,
    },
  ],
  /** Starter weapons — each entry is an Item config object */
  STARTER_WEAPONS: [
    {
      name: 'Handaxe',
      type: 'weapon',
      rarity: 'common',
      description: 'A light axe, good for throwing or chopping.',
      slot: 'mainHand',
      damage: '1d6',
      damageType: 'slashing',
      weight: 2,
      value: 5,
    },
    {
      name: 'Shortsword',
      type: 'weapon',
      rarity: 'common',
      description: 'A short, nimble blade.',
      slot: 'mainHand',
      damage: '1d6',
      damageType: 'piercing',
      weight: 2,
      value: 10,
    },
    {
      name: 'Dagger',
      type: 'weapon',
      rarity: 'common',
      description: 'A simple dagger. Better than nothing.',
      slot: 'mainHand',
      damage: '1d4',
      damageType: 'piercing',
      weight: 1,
      value: 2,
    },
    {
      name: 'Club',
      type: 'weapon',
      rarity: 'common',
      description: 'A stout wooden club.',
      slot: 'mainHand',
      damage: '1d4',
      damageType: 'bludgeoning',
      weight: 2,
      value: 1,
    },
    {
      name: 'Quarterstaff',
      type: 'weapon',
      rarity: 'common',
      description: 'A sturdy wooden staff.',
      slot: 'mainHand',
      damage: '1d6',
      damageType: 'bludgeoning',
      weight: 4,
      value: 2,
      twoHanded: true,
    },
    {
      name: 'Spear',
      type: 'weapon',
      rarity: 'common',
      description: 'A wooden shaft tipped with iron.',
      slot: 'mainHand',
      damage: '1d6',
      damageType: 'piercing',
      weight: 3,
      value: 1,
    },
    {
      name: 'Mace',
      type: 'weapon',
      rarity: 'common',
      description: 'A heavy iron mace.',
      slot: 'mainHand',
      damage: '1d6',
      damageType: 'bludgeoning',
      weight: 4,
      value: 5,
    },
    {
      name: 'Hand Crossbow',
      type: 'weapon',
      rarity: 'common',
      description: 'A compact crossbow, one-handed.',
      slot: 'mainHand',
      damage: '1d6',
      damageType: 'piercing',
      weight: 3,
      value: 75,
    },
  ],
  /** Number of starter items to give (random between min/max) */
  ITEM_COUNT_MIN: 2,
  ITEM_COUNT_MAX: 4,
  /** Always get exactly 1 starter weapon */
  WEAPON_COUNT: 1,
  /** Optional flavor notes found inside — conveys lore */
  NOTES: [
    "A scrawled note reads: \"If you're reading this, you survived the ambush. Head east — there's a town called Riverdale two days' walk. Stay off the main road.\"",
    'A torn journal page: "Day 12. Food running low. I\'ve left what I could spare for whoever finds this place. Gods willing they\'ll need it less than I did."',
    'A faded map pinned to the wall — hand-drawn, showing the local terrain. Several locations are circled but have no labels.',
    'Scratched into the stone wall: "Beware the TOWER to the NORTH. Do NOT enter alone."',
    'A merchant\'s ledger, entries trailing off mid-sentence. The last line reads: "...they came from the forest without warning—"',
  ],
};

// ===================
// TIME CONSTANTS
// ===================
export const TIME = {
  SHORT_REST_MINUTES: 60,
  LONG_REST_MINUTES: 480, // 8 hours
  INN_REST_MINUTES: 480, // 8 hours
  COMBAT_ROUND_SECONDS: 6,
  TRAVEL_TIME_PER_HEX_MINUTES: 30,
  FORAGE_TIME_MINUTES: 60,
  SEARCH_TIME_MINUTES: 30,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
};

// ===================
// DISTANCE & MEASUREMENT
// ===================
export const DISTANCE = {
  HEX_TO_FEET: 5,
  FEET_PER_SQUARE: 5,
  VISION_RANGE_FEET: 60,
  SHORT_RANGE_FEET: 30,
  LONG_RANGE_FEET: 120,
};

// ===================
// D&D 5E MECHANICS
// ===================
export const DND = {
  NATURAL_20: 20,
  NATURAL_1: 1,
  ABILITY_SCORE_MAX: 20,
  ABILITY_SCORE_MIN: 1,
  // Proficiency bonus by level (index 0 = level 1)
  PROFICIENCY_BONUS: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6],
  DEATH_SAVE_SUCCESS_THRESHOLD: 10,
  DEATH_SAVE_FAILURE_THRESHOLD: 10,
  DEATH_SAVES_TO_STABILIZE: 3,
  DEATH_SAVES_TO_DIE: 3,
  EXHAUSTION_LEVELS: 6,
  ADVANTAGE_MULTIPLIER: 2, // Roll twice, take higher
  DISADVANTAGE_MULTIPLIER: 2, // Roll twice, take lower
  CRITICAL_HIT_MULTIPLIER: 2,
};

// ===================
// XP & PROGRESSION
// ===================
export const XP_TABLE = [
  0, // Level 1
  300, // Level 2
  900, // Level 3
  2700, // Level 4
  6500, // Level 5
  14000, // Level 6
  23000, // Level 7
  34000, // Level 8
  48000, // Level 9
  64000, // Level 10
  85000, // Level 11
  100000, // Level 12
  120000, // Level 13
  140000, // Level 14
  165000, // Level 15
  195000, // Level 16
  225000, // Level 17
  265000, // Level 18
  305000, // Level 19
  355000, // Level 20
];

// ===================
// POI SPAWN RATES
// ===================
export const POI_SPAWN = {
  TOWN: 0.1, // 10% chance
  VILLAGE: 0.08, // 8% chance
  CAMP: 0.05, // 5% chance
  DUNGEON: 0.05, // 5% chance
  CAVE: 0.04, // 4% chance
  RUINS: 0.025, // 2.5% chance
  TOWER: 0.02, // 2% chance
  SHRINE: 0.03, // 3% chance
  LAIR: 0.02, // 2% chance
};

// ===================
// SETTLEMENT SIZES
// ===================
export const SETTLEMENT = {
  CAMP_MIN_NPCS: 5,
  CAMP_MAX_NPCS: 15,
  VILLAGE_MIN_NPCS: 20,
  VILLAGE_MAX_NPCS: 100,
  TOWN_MIN_NPCS: 100,
  TOWN_MAX_NPCS: 1000,
  CITY_MIN_NPCS: 1000,
  CITY_MAX_NPCS: 10000,
  METROPOLIS_MIN_NPCS: 10000,

  CAMP_WIDTH: 10,
  CAMP_HEIGHT: 10,
  VILLAGE_WIDTH: 15,
  VILLAGE_HEIGHT: 15,
  TOWN_WIDTH: 20,
  TOWN_HEIGHT: 20,
  CITY_WIDTH: 30,
  CITY_HEIGHT: 30,
  METROPOLIS_WIDTH: 40,
  METROPOLIS_HEIGHT: 40,
};

// ===================
// CANVAS RENDERING
// ===================
export const CANVAS = {
  DEFAULT_HEX_SIZE: 30,
  PLAYER_MARKER_RATIO: 0.4,
  POI_STAR_POINTS: 5,
  POI_STAR_INNER_RATIO: 0.4,
  POI_STAR_OUTER_RATIO: 0.6,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 2.0,
  ZOOM_STEP: 0.1,
  PAN_SPEED: 10,
  ANIMATION_FPS: 60,
};

// ===================
// COMBAT
// ===================
export const COMBAT = {
  MAX_PLACEMENT_ATTEMPTS: 100,
  FLEE_DC: 15,
  SURPRISE_CHANCE: 0.1,
  BATTLEFIELD_WIDTH: 20,
  BATTLEFIELD_HEIGHT: 15,
  INITIATIVE_DIE: 20,
  DEFAULT_MOVEMENT_FEET: 30,
  DIFFICULT_TERRAIN_MULTIPLIER: 2,
  OPPORTUNITY_ATTACK_RANGE_FEET: 5,
};

// ===================
// SURVIVAL
// ===================
export const SURVIVAL = {
  RATIONS_PER_DAY: 1,
  WATER_PER_DAY: 1,
  STARVATION_DAMAGE_PER_DAY: 1,
  DEHYDRATION_DAMAGE_PER_DAY: 2,
  FORAGE_BASE_DC: 15,
  FORAGE_COOLDOWN_DAYS: 3,
  RATIONS_PER_FORAGE_SUCCESS: 3,
  WATER_PER_FIND_SUCCESS: 3,
  RICH_TERRAIN_BONUS: 2, // Extra rations in forests, grasslands
  BARREN_TERRAIN_PENALTY: -5, // DC penalty in deserts, mountains
};

// ===================
// TERRAIN
// ===================
export const TERRAIN = {
  MAP_INITIAL_WIDTH: 30,
  MAP_INITIAL_HEIGHT: 20,
  EXPANSION_CHUNK_SIZE: 10,
  EXPANSION_THRESHOLD: 5, // Hexes from edge before expanding
  VIEWPORT_WIDTH_RATIO: 0.6, // Approximate canvas width relative to viewport
  VIEWPORT_HEIGHT_RATIO: 0.8, // Approximate canvas height relative to viewport
  RIVER_MIN_COUNT: 2,
  RIVER_MAX_COUNT: 5,
  RIVER_DENSITY_DIVISOR: 100,
  RIVER_WIDTH_MIN: 1,
  RIVER_WIDTH_MAX: 3,
  ELEVATION_RANGE: 100,
  TEMPERATURE_RANGE: 100,
  MOISTURE_RANGE: 100,
};

// ===================
// DUNGEON/INTERIOR GENERATION
// ===================
export const DUNGEON = {
  MIN_ROOMS: 4,
  MAX_ROOMS: 10,
  MIN_ROOM_SIZE: 3,
  MAX_ROOM_SIZE: 8,
  CORRIDOR_WIDTH: 1,
  ENCOUNTER_CHANCE: 0.3, // 30% per room
  LOOT_CHANCE: 0.4, // 40% per room
  HAZARD_CHANCE: 0.2, // 20% per room
  BOSS_ROOM_INDEX: -1, // Last room
};

// ===================
// SHOP & ECONOMY
// ===================
export const SHOP = {
  BASE_MARKUP: 1.5, // 50% markup on items
  SELL_MULTIPLIER: 0.5, // Sell for 50% of value
  COMMON_ITEM_CHANCE: 0.6,
  UNCOMMON_ITEM_CHANCE: 0.3,
  RARE_ITEM_CHANCE: 0.08,
  VERY_RARE_ITEM_CHANCE: 0.02,
  LEGENDARY_ITEM_CHANCE: 0.001,
  STOCK_REFRESH_DAYS: 7,
};

// ===================
// QUEST GENERATION
// ===================
export const QUEST_COUNTS_BY_SIZE: Record<string, { min: number; max: number }> = {
  camp: { min: 0, max: 1 },
  village: { min: 1, max: 2 },
  town: { min: 2, max: 3 },
  city: { min: 2, max: 4 },
  metropolis: { min: 3, max: 5 },
};

export const QUEST = {
  CAMP_QUEST_COUNT: 1,
  VILLAGE_QUEST_COUNT: 2,
  TOWN_QUEST_COUNT: 3,
  CITY_QUEST_COUNT: 5,
  METROPOLIS_QUEST_COUNT: 7,
  QUEST_REFRESH_DAYS: 7,
  BASE_XP_REWARD: 100,
  BASE_GOLD_REWARD: 50,
  REWARD_MULTIPLIER_PER_CR: 1.5,
};

// ===================
// SAVE SYSTEM
// ===================
export const SAVE = {
  VERSION: '5.0',
  AUTO_SAVE_DEBOUNCE_MS: 500,
  MAX_SAVE_SLOTS: 3,
  PLAYTIME_UPDATE_INTERVAL_MS: 1000,
};

// ===================
// UI
// ===================
export const UI = {
  GAME_LOG_MAX_MESSAGES: 100,
  TOAST_DURATION_MS: 3000,
  MODAL_ANIMATION_MS: 200,
  TOOLTIP_DELAY_MS: 500,
};
