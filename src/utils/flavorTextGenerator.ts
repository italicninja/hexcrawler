/**
 * flavorTextGenerator.ts
 *
 * Generates atmospheric flavor text for game events.
 * All messages are 1-line, second person ("You..."), and contextual.
 */

// ============================================================================
// DATA TABLES
// ============================================================================

type ClassKey =
  | 'barbarian'
  | 'bard'
  | 'cleric'
  | 'druid'
  | 'fighter'
  | 'monk'
  | 'paladin'
  | 'ranger'
  | 'rogue'
  | 'sorcerer'
  | 'warlock'
  | 'wizard';

type TerrainKey =
  | 'forest'
  | 'grassland'
  | 'hills'
  | 'mountains'
  | 'swamp'
  | 'desert'
  | 'tundra'
  | 'river'
  | 'water';

type TimeOfDay = 'dawn' | 'dusk' | 'night';
type POIType = 'dungeon' | 'ruins' | 'cave' | 'tower' | 'shrine' | 'encounter';
type CRTier = 'low' | 'medium' | 'high';
type SettlementType = 'camp' | 'village' | 'town' | 'city' | 'metropolis';
type RestType = 'short' | 'long' | 'inn';

/**
 * Character creation welcome messages (by class)
 */
const CLASS_INTROS: Record<ClassKey, string> = {
  barbarian: 'the wild calls to your primal spirit',
  bard: 'tales of glory await your telling',
  cleric: 'divine purpose guides your path',
  druid: "nature's balance must be preserved",
  fighter: 'steel and courage are your companions',
  monk: 'discipline and focus sharpen your path',
  paladin: 'your oath binds you to justice',
  ranger: 'the wilderness holds no secrets from you',
  rogue: 'fortune favors the bold and cunning',
  sorcerer: 'raw magic flows through your veins',
  warlock: 'dark bargains grant you power',
  wizard: 'arcane knowledge is your greatest weapon',
};

/**
 * Terrain-specific atmospheric descriptions
 */
const TERRAIN_FLAVOR: Record<TerrainKey, string[]> = {
  forest: [
    'You enter dense forest where shadows dance between ancient trees',
    'The forest canopy closes overhead, filtering sunlight to dim green',
    'You push through tangled undergrowth into darker woods',
    'Towering trees surround you as the forest grows thick',
  ],
  grassland: [
    'Open grassland stretches endlessly before you',
    'Wind sweeps across rolling plains beneath vast skies',
    'You traverse sun-drenched meadows swaying in the breeze',
    'The grassland opens wide with unobstructed horizons',
  ],
  hills: [
    'You climb into rugged hills with sweeping vistas',
    'Rocky slopes rise around you as elevation increases',
    'The terrain grows uneven as hills dominate the landscape',
    'You ascend rolling hills that break the flatlands',
  ],
  mountains: [
    'Towering peaks loom overhead as you ascend rocky paths',
    'The air grows thin and cold at this altitude',
    'Jagged mountain faces surround you on all sides',
    'You climb into the mountains where stone giants sleep',
  ],
  swamp: [
    'You wade into fetid swampland thick with mist',
    'Murky water and twisted roots make every step treacherous',
    'The swamp closes around you - humid air reeks of decay',
    'You enter the swamp where stagnant pools and moss reign',
  ],
  desert: [
    'Endless dunes of sand stretch to the horizon',
    'The desert heat beats down mercilessly',
    'You trudge through scorching wasteland under brutal sun',
    'Sand and stone dominate the barren desert landscape',
  ],
  tundra: [
    'Frozen tundra extends in all directions - bitter cold seeps through everything',
    'Ice and snow blanket the desolate landscape',
    'You cross windswept tundra where nothing grows',
    'The tundra stretches endlessly, white and lifeless',
  ],
  river: [
    'You reach a flowing river cutting through the land',
    'Water rushes past along the riverbank',
    "The river's current looks swift and dangerous",
    "You arrive at the river's edge where water flows deep",
  ],
  water: [
    'Open water surrounds you completely',
    'Waves lap against your vessel on the open sea',
    'You navigate across deep water far from shore',
    'The ocean extends endlessly in every direction',
  ],
};

/**
 * Extreme weather warnings (only dangerous conditions)
 */
const EXTREME_WEATHER: Record<string, string> = {
  Blizzard: 'Blizzard conditions reduce visibility to near zero',
  Hurricane: 'Hurricane-force winds threaten to capsize your vessel',
  'Dust storm': 'A massive dust storm chokes the air',
  Thunderstorm: 'Lightning splits the sky as thunder crashes around you',
  'Scorching heat': 'The heat is almost unbearable - shade offers no relief',
  'Avalanche risk': 'Distant rumbles suggest avalanche danger lurks nearby',
  'Heavy rain': 'Torrential rain makes the terrain nearly impassable',
  Storm: 'A violent storm rages with deadly intensity',
};

/**
 * Time of day transition messages
 */
const TIME_TRANSITIONS: Record<TimeOfDay, string[]> = {
  dawn: [
    'Dawn breaks across the horizon',
    'First light touches the landscape',
    'Morning arrives with pale sunlight',
  ],
  dusk: [
    'Dusk settles as shadows lengthen',
    'Evening falls and darkness approaches',
    'Twilight dims the world around you',
  ],
  night: [
    'Night falls - visibility drops significantly',
    'Darkness cloaks the land completely',
    'The world disappears into moonlit shadows',
  ],
};

/**
 * POI discovery enhancement (50% chance, CR-scaled)
 */
const POI_FLAVOR: Record<POIType, Record<CRTier, string[]>> = {
  dungeon: {
    low: [
      'A small dungeon entrance lies before you',
      'Ancient stonework marks a forgotten passage',
    ],
    medium: [
      'Dark corridors descend into dangerous depths',
      'The dungeon entrance emanates menace',
    ],
    high: [
      'A vast dungeon complex yawns before you - death surely lurks within',
      'This legendary dungeon has claimed countless adventurers',
    ],
  },
  ruins: {
    low: [
      'Crumbling stones mark what was once a structure',
      'Weathered ruins hint at past civilization',
    ],
    medium: [
      'Ancient ruins stand partially intact amid decay',
      'These ruins hold secrets from ages past',
    ],
    high: [
      'Massive ruins tower overhead - monuments to a fallen empire',
      'The scale of these ruins suggests immense power once dwelt here',
    ],
  },
  cave: {
    low: ['A shallow cave opening beckons', 'Natural rock formations create a small cavern'],
    medium: [
      'A dark cave entrance exhales cold stale air',
      'The cave mouth disappears into blackness',
    ],
    high: [
      'An enormous cavern system extends deep underground',
      'This massive cave network feels ancient and hostile',
    ],
  },
  tower: {
    low: [
      'A modest tower rises above the landscape',
      'The tower shows signs of magical construction',
    ],
    medium: [
      'An imposing tower crackles with arcane energy',
      "The wizard's tower hums with barely-contained power",
    ],
    high: [
      'A magnificent spire pierces the sky - legendary magic radiates from within',
      'This tower belongs to an archmage of terrible renown',
    ],
  },
  shrine: {
    low: ['A humble shrine stands peacefully', 'Simple offerings mark this sacred place'],
    medium: [
      'An ancient shrine radiates divine presence',
      'Holy symbols adorn this weathered shrine',
    ],
    high: [
      'A grand temple complex inspires awe and reverence',
      'This sacred site pulses with divine power',
    ],
  },
  encounter: {
    low: [
      'Movement ahead - something watches from nearby',
      'Hostile creatures have noticed your presence',
    ],
    medium: ['Dangerous enemies block your path ahead', 'A hostile force prepares to engage you'],
    high: [
      'Deadly foes emerge from hiding - this will be brutal',
      'A fearsome warband stands ready for battle',
    ],
  },
};

/**
 * Settlement entry flavor (50% chance, varies by size)
 */
const SETTLEMENT_FLAVOR: Record<SettlementType, string[]> = {
  camp: [
    'You arrive at a simple camp - travelers gather around fires',
    'The camp offers basic shelter and rest',
    'Rough tents and cookfires mark this temporary settlement',
  ],
  village: [
    'You enter a quiet village where locals eye you curiously',
    'The small village shows simple homes and farmland',
    'Village life continues at a peaceful pace around you',
  ],
  town: [
    'You arrive in a bustling town full of activity',
    "The town's streets are busy with merchants and travelers",
    'You enter the town as residents go about their business',
  ],
  city: [
    "The city's walls rise impressively before you",
    'You pass through the gates into a thriving urban center',
    'Crowds fill the city streets as commerce flows endlessly',
  ],
  metropolis: [
    'A magnificent metropolis sprawls before you - countless thousands live here',
    'You enter the grand city - wealth and power radiate from every district',
    'The metropolis is overwhelming in scale and grandeur',
  ],
};

/**
 * Rest atmosphere (30% chance)
 */
const REST_FLAVOR: Record<string, string[]> = {
  short: [
    'You catch your breath and tend minor wounds',
    'Your party takes a brief respite',
    'A short rest restores some vigor',
  ],
  long_peaceful: [
    'You make camp as evening falls - the night passes quietly',
    'Your party rests through the night without incident',
    "A peaceful night's sleep refreshes you completely",
  ],
  long_interrupted: [
    'Your rest is shattered - enemies attack in the darkness!',
    'Something stirs nearby - combat is imminent!',
    'Hostile forces strike your camp during the night!',
  ],
  inn: [
    'You rest comfortably at the inn',
    'Warm beds and hot food restore you fully',
    'The innkeeper provides excellent hospitality',
  ],
};

/**
 * Combat encounter intros (100% when combat triggers)
 */
const COMBAT_INTROS: Record<string, string[]> = {
  dungeon: [
    'Monsters emerge from the dungeon shadows - prepare for battle!',
    "The dungeon's guardians attack!",
    "You've disturbed something deadly in these depths!",
  ],
  ruins: [
    'Ancient defenders animate to protect the ruins!',
    'Creatures lurking in the ruins attack!',
    "The ruins' inhabitants emerge to fight!",
  ],
  cave: [
    'Cave dwellers rush forward to attack!',
    'Something hostile has made this cave its lair!',
    'The cave echoes with hostile roars - combat begins!',
  ],
  tower: [
    'Magical constructs move to defend the tower!',
    "The tower's guardian challenges you!",
    'Arcane defenses activate - prepare for battle!',
  ],
  encounter: [
    'Hostile creatures attack!',
    'Enemies charge forward - defend yourselves!',
    "You're ambushed - fight for your lives!",
  ],
  shrine: [
    'Sacred guardians rise to defend the shrine!',
    'Divine protectors emerge!',
    "The shrine's defenders attack!",
  ],
  generic: ['Combat begins!', 'Enemies engage - ready your weapons!', 'Battle is joined!'],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Select random item from array
 */
function randomChoice<T>(array: T[] | null | undefined): T | null {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get CR tier for POI flavor scaling
 */
function getCRTier(cr: number): CRTier {
  if (cr <= 3) return 'low';
  if (cr <= 7) return 'medium';
  return 'high';
}

// ============================================================================
// PUBLIC GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate character creation welcome message
 */
export function generateCharacterWelcome(characterName: string, characterClass: string): string {
  const classKey = characterClass.toLowerCase() as ClassKey;
  const flavor = CLASS_INTROS[classKey] || 'adventure awaits in the unknown';

  const className = characterClass.charAt(0).toUpperCase() + characterClass.slice(1);

  return `You begin your journey as ${characterName} the ${className} - ${flavor}`;
}

/**
 * Generate hex entry atmospheric flavor
 */
export function generateHexEntryFlavor(terrainKey: string): string | null {
  const flavorPool = TERRAIN_FLAVOR[terrainKey as TerrainKey];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate weather warning for extreme conditions
 */
export function generateWeatherFlavor(weatherCondition: string | null): string | null {
  if (!weatherCondition) return null;

  return EXTREME_WEATHER[weatherCondition] || null;
}

/**
 * Generate time of day transition message
 */
export function generateTimeTransitionFlavor(timeOfDay: string): string | null {
  const flavorPool = TIME_TRANSITIONS[timeOfDay as TimeOfDay];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate POI discovery enhancement
 */
export function generatePOIFlavor(poiType: string, cr: number = 1): string | null {
  const typePool = POI_FLAVOR[poiType as POIType];
  if (!typePool) return null;

  const tier = getCRTier(cr);
  const flavorPool = typePool[tier];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate settlement entry flavor
 */
export function generateSettlementFlavor(settlementType: string): string | null {
  const flavorPool = SETTLEMENT_FLAVOR[settlementType as SettlementType];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate rest atmosphere flavor
 */
export function generateRestFlavor(
  restType: RestType,
  interrupted: boolean = false
): string | null {
  let flavorKey: string = restType;

  if (restType === 'long') {
    flavorKey = interrupted ? 'long_interrupted' : 'long_peaceful';
  }

  const flavorPool = REST_FLAVOR[flavorKey];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate combat encounter intro
 */
export function generateCombatIntro(poiType: string = 'generic'): string {
  const flavorPool = COMBAT_INTROS[poiType] || COMBAT_INTROS.generic;

  return randomChoice(flavorPool) || 'Combat begins!';
}
