import { Character } from './Character';

/**
 * NPCGenerator - generates random NPCs with stats, personalities, and backgrounds
 */

interface AbilityStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

interface AbilityEntry {
  name: string;
  uses: number;
  maxUses: number;
}

interface ClassConfig {
  hitDie: string;
  primaryStat: string;
  secondaryStat: string;
  stats: AbilityStats;
  armorClass: number;
  proficiencies: string[];
  abilities: AbilityEntry[];
}

interface GeneratedName {
  fullName: string;
  firstName: string;
  surname: string;
  gender: string;
}

// Name tables
const MALE_NAMES = [
  'Aldric',
  'Brom',
  'Cedric',
  'Gareth',
  'Theron',
  'Valen',
  'Darius',
  'Kael',
  'Finn',
  'Rowan',
  'Marcus',
  'Brennan',
  'Alaric',
  'Torvan',
  'Silas',
  'Garrett',
  'Magnus',
  'Dorian',
  'Caspian',
  'Lucian',
  'Thaddeus',
  'Viktor',
  'Remy',
  'Asher',
];

const FEMALE_NAMES = [
  'Aria',
  'Brienne',
  'Elara',
  'Lyra',
  'Seraphina',
  'Isolde',
  'Mira',
  'Cassia',
  'Faye',
  'Rowena',
  'Astrid',
  'Elowen',
  'Nessa',
  'Thalia',
  'Ember',
  'Sable',
  'Aurelia',
  'Callista',
  'Zara',
  'Nova',
  'Rhea',
  'Vera',
  'Celeste',
  'Iris',
];

const SURNAMES = [
  'Ironforge',
  'Stormwind',
  'Blackwood',
  'Brightblade',
  'Shadowmere',
  'Thornheart',
  'Silverbrook',
  'Ashwood',
  'Ravenclaw',
  'Goldenleaf',
  'Stonehelm',
  'Fireborn',
  'Frostbane',
  'Nightshade',
  'Dawnbringer',
  'Wildrose',
  'Steelgard',
  'Moonshadow',
];

// Personality traits
const PERSONALITIES = [
  'brave',
  'cautious',
  'greedy',
  'loyal',
  'reckless',
  'wise',
  'grumpy',
  'cheerful',
  'sarcastic',
  'curious',
  'stoic',
  'compassionate',
  'ambitious',
  'humble',
  'cynical',
  'optimistic',
  'paranoid',
  'trusting',
];

// Background stories
const BACKGROUNDS = [
  'former soldier seeking redemption',
  'merchant hoping to make a fortune',
  'scholar searching for lost knowledge',
  'street urchin who learned to survive',
  'noble who lost their inheritance',
  'acolyte on a spiritual quest',
  'criminal trying to escape their past',
  'folk hero protecting the common people',
  'outlander exploring civilization',
  'sailor seeking adventure on land',
  'entertainer traveling the world',
  'guild artisan perfecting their craft',
];

// Available classes with configurations
const CLASS_CONFIGS: Record<string, ClassConfig> = {
  fighter: {
    hitDie: 'd10',
    primaryStat: 'strength',
    secondaryStat: 'constitution',
    stats: {
      strength: 16,
      constitution: 14,
      dexterity: 13,
      wisdom: 12,
      intelligence: 10,
      charisma: 8,
    },
    armorClass: 16,
    proficiencies: [
      'All Armor',
      'All Shields',
      'Simple Weapons',
      'Martial Weapons',
      'Strength Saves',
      'Constitution Saves',
    ],
    abilities: [
      { name: 'Second Wind', uses: 1, maxUses: 1 },
      { name: 'Action Surge', uses: 1, maxUses: 1 },
    ],
  },
  rogue: {
    hitDie: 'd8',
    primaryStat: 'dexterity',
    secondaryStat: 'intelligence',
    stats: {
      dexterity: 16,
      intelligence: 14,
      constitution: 13,
      charisma: 12,
      wisdom: 10,
      strength: 8,
    },
    armorClass: 14,
    proficiencies: [
      'Light Armor',
      'Simple Weapons',
      'Hand Crossbows',
      'Longswords',
      'Rapiers',
      'Shortswords',
      'Dexterity Saves',
      'Intelligence Saves',
    ],
    abilities: [
      { name: 'Sneak Attack', uses: -1, maxUses: -1 }, // -1 = unlimited
      { name: 'Cunning Action', uses: -1, maxUses: -1 },
    ],
  },
  cleric: {
    hitDie: 'd8',
    primaryStat: 'wisdom',
    secondaryStat: 'constitution',
    stats: {
      wisdom: 16,
      constitution: 14,
      strength: 13,
      charisma: 12,
      dexterity: 10,
      intelligence: 8,
    },
    armorClass: 15,
    proficiencies: [
      'Light Armor',
      'Medium Armor',
      'Shields',
      'Simple Weapons',
      'Wisdom Saves',
      'Charisma Saves',
    ],
    abilities: [
      { name: 'Channel Divinity', uses: 1, maxUses: 1 },
      { name: 'Turn Undead', uses: 1, maxUses: 1 },
    ],
  },
  wizard: {
    hitDie: 'd6',
    primaryStat: 'intelligence',
    secondaryStat: 'constitution',
    stats: {
      intelligence: 16,
      constitution: 14,
      dexterity: 13,
      wisdom: 12,
      charisma: 10,
      strength: 8,
    },
    armorClass: 12,
    proficiencies: [
      'Daggers',
      'Darts',
      'Slings',
      'Quarterstaffs',
      'Light Crossbows',
      'Intelligence Saves',
      'Wisdom Saves',
    ],
    abilities: [
      { name: 'Arcane Recovery', uses: 1, maxUses: 1 },
      { name: 'Spellcasting', uses: -1, maxUses: -1 },
    ],
  },
  ranger: {
    hitDie: 'd10',
    primaryStat: 'dexterity',
    secondaryStat: 'wisdom',
    stats: {
      dexterity: 16,
      wisdom: 14,
      constitution: 13,
      strength: 12,
      intelligence: 10,
      charisma: 8,
    },
    armorClass: 14,
    proficiencies: [
      'Light Armor',
      'Medium Armor',
      'Shields',
      'Simple Weapons',
      'Martial Weapons',
      'Strength Saves',
      'Dexterity Saves',
    ],
    abilities: [
      { name: 'Favored Enemy', uses: -1, maxUses: -1 },
      { name: 'Natural Explorer', uses: -1, maxUses: -1 },
    ],
  },
};

// Random number generator with seed support
class SeededRandom {
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

/**
 * Generate a random fantasy name
 */
export function generateName(seed: number = Date.now(), gender: string | null = null): GeneratedName {
  const rng = new SeededRandom(seed);

  // Random gender if not specified
  if (gender === null) {
    gender = rng.next() > 0.5 ? 'male' : 'female';
  }

  const firstName = gender === 'male' ? rng.choice(MALE_NAMES) : rng.choice(FEMALE_NAMES);

  const surname = rng.choice(SURNAMES);

  return {
    fullName: `${firstName} ${surname}`,
    firstName,
    surname,
    gender,
  };
}

/**
 * Generate a random personality trait
 */
export function generatePersonality(seed: number = Date.now()): string {
  const rng = new SeededRandom(seed);

  // Pick 1-2 personality traits
  const numTraits = rng.nextInt(1, 2);
  const traits: string[] = [];

  const availableTraits = [...PERSONALITIES];
  for (let i = 0; i < numTraits; i++) {
    const index = rng.nextInt(0, availableTraits.length - 1);
    traits.push(availableTraits[index]);
    availableTraits.splice(index, 1); // Remove to avoid duplicates
  }

  return traits.join(', ');
}

/**
 * Generate a random background
 */
export function generateBackground(seed: number = Date.now()): string {
  const rng = new SeededRandom(seed);
  return rng.choice(BACKGROUNDS);
}

/**
 * Generate a random NPC Character.
 * classType may be null for a random class.
 */
export function generateNPC(
  level = 1,
  classType: string | null = null,
  seed: number = Date.now()
): Character {
  const rng = new SeededRandom(seed);

  // Select random class if not specified
  const availableClasses = Object.keys(CLASS_CONFIGS);
  const selectedClass = classType || rng.choice(availableClasses);

  // Validate class
  if (!CLASS_CONFIGS[selectedClass]) {
    throw new Error(`Invalid class type: ${selectedClass}`);
  }

  // Generate name
  const nameData = generateName(rng.nextInt(0, 999999));

  // Create base character
  const npc = new Character(nameData.fullName, null); // Don't apply class modifiers yet

  // Get class config
  const config = CLASS_CONFIGS[selectedClass];

  // Set class
  npc.class = selectedClass;
  npc.level = level;

  // Apply stats
  npc.abilities = { ...config.stats };

  // Add slight random variation to stats (+/- 1)
  (Object.keys(npc.abilities) as (keyof AbilityStats)[]).forEach(ability => {
    const variation = rng.nextInt(-1, 1);
    npc.abilities[ability] = Math.max(6, Math.min(18, npc.abilities[ability] + variation));
  });

  // Calculate HP
  npc.hitDie = config.hitDie;
  const hitDieValue = parseInt(config.hitDie.substring(1), 10);
  const conMod = npc.getModifier('constitution');

  // First level gets max HP
  let totalHP = hitDieValue + conMod;

  // Add HP for additional levels (use average)
  for (let i = 2; i <= level; i++) {
    const avgRoll = Math.floor(hitDieValue / 2) + 1;
    totalHP += avgRoll + conMod;
  }

  npc.maxHP = Math.max(1, totalHP);
  npc.currentHP = npc.maxHP;

  // Set AC
  npc.armorClass = config.armorClass;

  // Calculate proficiency bonus
  npc.proficiencyBonus = Math.floor((level - 1) / 4) + 2;

  // Set proficiencies and abilities
  npc.proficiencies = [...config.proficiencies];
  npc.abilities_list = config.abilities.map(ability => {
    if (ability.uses === -1) {
      // Unlimited use abilities
      return { ...ability };
    } else {
      // Scale uses with proficiency bonus for some abilities
      const scaledUses = ability.maxUses + Math.floor((level - 1) / 6);
      return {
        ...ability,
        uses: scaledUses,
        maxUses: scaledUses,
      };
    }
  });

  // Generate personality and background
  npc.personality = generatePersonality(rng.nextInt(0, 999999));
  npc.background = generateBackground(rng.nextInt(0, 999999));
  npc.gender = nameData.gender;

  return npc;
}

/**
 * Generate a party of 3 random NPCs (each a different class where possible).
 */
export function generateNPCParty(level = 1, seed: number = Date.now()): Character[] {
  const rng = new SeededRandom(seed);
  const npcs: Character[] = [];
  const availableClasses = Object.keys(CLASS_CONFIGS);
  const usedClasses = new Set<string>();

  // Generate 3 NPCs with different classes
  for (let i = 0; i < 3; i++) {
    // Find an unused class
    let selectedClass: string;
    let attempts = 0;
    do {
      selectedClass = rng.choice(availableClasses);
      attempts++;
    } while (usedClasses.has(selectedClass) && attempts < 20);

    usedClasses.add(selectedClass);

    const npcSeed = rng.nextInt(0, 999999);
    const npc = generateNPC(level, selectedClass, npcSeed);
    npcs.push(npc);
  }

  return npcs;
}
