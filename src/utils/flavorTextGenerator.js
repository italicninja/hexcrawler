/**
 * flavorTextGenerator.js
 *
 * Generates atmospheric flavor text for game events.
 * All messages are 1-line, second person ("You..."), and contextual.
 */

// ============================================================================
// DATA TABLES
// ============================================================================

/**
 * Character creation welcome messages (by class)
 * Format: "You begin your journey as {name} the {Class} - {flavor}"
 */
const CLASS_INTROS = {
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
 * Used for hex entry (15% chance)
 */
const TERRAIN_FLAVOR = {
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
 * Shown when entering hex with extreme weather
 */
const EXTREME_WEATHER = {
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
 * Shown when crossing dawn/dusk/night thresholds
 */
const TIME_TRANSITIONS = {
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
 * Adds atmospheric description to POI discoveries
 */
const POI_FLAVOR = {
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
const SETTLEMENT_FLAVOR = {
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
const REST_FLAVOR = {
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
const COMBAT_INTROS = {
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
function randomChoice(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get CR tier for POI flavor scaling
 * @param {number} cr - Challenge rating
 * @returns {'low'|'medium'|'high'}
 */
function getCRTier(cr) {
  if (cr <= 3) return 'low';
  if (cr <= 7) return 'medium';
  return 'high';
}

// ============================================================================
// PUBLIC GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate character creation welcome message
 * @param {string} characterName - Character's name
 * @param {string} characterClass - Character's class (lowercase)
 * @returns {string} Welcome message
 */
export function generateCharacterWelcome(characterName, characterClass) {
  const classKey = characterClass.toLowerCase();
  const flavor = CLASS_INTROS[classKey] || 'adventure awaits in the unknown';

  const className = characterClass.charAt(0).toUpperCase() + characterClass.slice(1);

  return `You begin your journey as ${characterName} the ${className} - ${flavor}`;
}

/**
 * Generate hex entry atmospheric flavor
 * @param {string} terrainKey - Terrain type key (lowercase)
 * @returns {string|null} Flavor text or null
 */
export function generateHexEntryFlavor(terrainKey) {
  const flavorPool = TERRAIN_FLAVOR[terrainKey];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate weather warning for extreme conditions
 * @param {string} weatherCondition - Weather condition string
 * @returns {string|null} Warning text or null
 */
export function generateWeatherFlavor(weatherCondition) {
  if (!weatherCondition) return null;

  return EXTREME_WEATHER[weatherCondition] || null;
}

/**
 * Generate time of day transition message
 * @param {string} timeOfDay - 'dawn', 'dusk', or 'night'
 * @returns {string|null} Transition message or null
 */
export function generateTimeTransitionFlavor(timeOfDay) {
  const flavorPool = TIME_TRANSITIONS[timeOfDay];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate POI discovery enhancement
 * @param {string} poiType - POI type (dungeon, ruins, cave, tower, shrine, encounter)
 * @param {number} cr - Challenge rating
 * @returns {string|null} Flavor text or null
 */
export function generatePOIFlavor(poiType, cr = 1) {
  const typePool = POI_FLAVOR[poiType];
  if (!typePool) return null;

  const tier = getCRTier(cr);
  const flavorPool = typePool[tier];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate settlement entry flavor
 * @param {string} settlementType - Settlement type (camp, village, town, city, metropolis)
 * @returns {string|null} Flavor text or null
 */
export function generateSettlementFlavor(settlementType) {
  const flavorPool = SETTLEMENT_FLAVOR[settlementType];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate rest atmosphere flavor
 * @param {string} restType - 'short', 'long', or 'inn'
 * @param {boolean} interrupted - Whether long rest was interrupted
 * @returns {string|null} Flavor text or null
 */
export function generateRestFlavor(restType, interrupted = false) {
  let flavorKey = restType;

  if (restType === 'long') {
    flavorKey = interrupted ? 'long_interrupted' : 'long_peaceful';
  }

  const flavorPool = REST_FLAVOR[flavorKey];
  if (!flavorPool) return null;

  return randomChoice(flavorPool);
}

/**
 * Generate combat encounter intro
 * @param {string} poiType - POI type that triggered combat (or 'generic')
 * @returns {string} Combat intro message
 */
export function generateCombatIntro(poiType = 'generic') {
  const flavorPool = COMBAT_INTROS[poiType] || COMBAT_INTROS.generic;

  return randomChoice(flavorPool) || 'Combat begins!';
}
