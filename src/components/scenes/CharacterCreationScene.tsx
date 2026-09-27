import { random } from '../../utils/seededRandom';
import { useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { Character } from '../../game/Character';
import { Party } from '../../game/Party';
import { generateCharacterWelcome } from '../../utils/flavorTextGenerator';
import PixelIcon from '../ui/PixelIcon';
import TitleBackground from '../ui/TitleBackground';

interface ClassData {
  name: string;
  hitDie: string;
  description: string;
  primaryStat: string;
  secondaryStat: string;
  startingEquipment: string[];
  abilityScores: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

const ABILITIES = [
  ['STR', 'strength'],
  ['DEX', 'dexterity'],
  ['CON', 'constitution'],
  ['INT', 'intelligence'],
  ['WIS', 'wisdom'],
  ['CHA', 'charisma'],
] as const;

// Random hero name lists for Quick Start
const HERO_NAMES = [
  // Fantasy warrior names
  'Aldric',
  'Theron',
  'Gareth',
  'Bran',
  'Ragnar',
  'Thorin',
  'Gorin',
  'Borin',
  'Kael',
  'Darian',
  'Eamon',
  'Fynn',
  'Galen',
  'Haldor',
  'Ivar',
  'Jarek',
  // Fantasy mage names
  'Merlin',
  'Gandor',
  'Elara',
  'Lyra',
  'Mira',
  'Nyx',
  'Aria',
  'Luna',
  'Celeste',
  'Aurora',
  'Astrid',
  'Zara',
  'Thalia',
  'Seraphina',
  'Raven',
  // Rogueish names
  'Shadow',
  'Rook',
  'Sable',
  'Ash',
  'Ember',
  'Flint',
  'Steel',
  'Frost',
  // Divine names
  'Auriel',
  'Gabriel',
  'Raphael',
  'Uriel',
  'Azrael',
  'Cassiel',
  'Raziel',
  // Nature names
  'Rowan',
  'Willow',
  'Sage',
  'Briar',
  'Thorn',
  'Oak',
  'River',
  'Storm',
  // Classic hero names
  'Valor',
  'Justice',
  'Honor',
  'Glory',
  'Victory',
  'Phoenix',
  'Blade',
  'Aegis',
];

// Helper function to get random element from array
const getRandomElement = <T,>(array: T[]): T => {
  return array[Math.floor(random() * array.length)];
};

// Helper function to generate random hero name
const generateRandomName = () => {
  return getRandomElement(HERO_NAMES);
};

// Classes currently disabled (not yet fully fleshed out) - re-enable as each class is implemented
const DISABLED_CLASSES = new Set([
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
]);

// Helper function to get random class key (only enabled classes)
const getRandomClass = () => {
  const classKeys = Object.keys(CLASS_DATA).filter(key => !DISABLED_CLASSES.has(key));
  return getRandomElement(classKeys);
};

// Class definitions with primary/secondary stats and hit dice
const CLASS_DATA: Record<string, ClassData> = {
  barbarian: {
    name: 'Barbarian',
    hitDie: 'd12',
    description: 'A fierce warrior who channels primal rage in battle',
    primaryStat: 'strength',
    secondaryStat: 'constitution',
    startingEquipment: ['Greataxe (1d12 slashing)', '75 gp'],
    abilityScores: {
      strength: 15,
      dexterity: 13,
      constitution: 14,
      intelligence: 8,
      wisdom: 12,
      charisma: 10,
    },
  },
  bard: {
    name: 'Bard',
    hitDie: 'd8',
    description: 'An inspiring musician who weaves magic through performance',
    primaryStat: 'charisma',
    secondaryStat: 'dexterity',
    startingEquipment: ['Rapier (1d8 piercing, finesse)', 'Leather Armor', '75 gp'],
    abilityScores: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 10,
      wisdom: 13,
      charisma: 15,
    },
  },
  cleric: {
    name: 'Cleric',
    hitDie: 'd8',
    description: 'A divine servant who channels the power of their deity',
    primaryStat: 'wisdom',
    secondaryStat: 'constitution',
    startingEquipment: ['Mace (1d6 bludgeoning)', 'Scale Mail', 'Shield', '75 gp'],
    abilityScores: {
      strength: 14,
      dexterity: 10,
      constitution: 13,
      intelligence: 8,
      wisdom: 15,
      charisma: 12,
    },
  },
  druid: {
    name: 'Druid',
    hitDie: 'd8',
    description: 'A nature priest who shapeshifts and commands natural forces',
    primaryStat: 'wisdom',
    secondaryStat: 'constitution',
    startingEquipment: ['Quarterstaff (1d6 bludgeoning, versatile)', 'Leather Armor', '75 gp'],
    abilityScores: {
      strength: 10,
      dexterity: 12,
      constitution: 14,
      intelligence: 13,
      wisdom: 15,
      charisma: 8,
    },
  },
  fighter: {
    name: 'Fighter',
    hitDie: 'd10',
    description: 'A master of martial combat and weaponry',
    primaryStat: 'strength',
    secondaryStat: 'constitution',
    startingEquipment: ['Longsword (1d8 slashing)', 'Shield', 'Chain Mail', '75 gp'],
    abilityScores: {
      strength: 15,
      dexterity: 14,
      constitution: 13,
      intelligence: 8,
      wisdom: 10,
      charisma: 12,
    },
  },
  monk: {
    name: 'Monk',
    hitDie: 'd8',
    description: 'A martial artist who harnesses ki energy',
    primaryStat: 'dexterity',
    secondaryStat: 'wisdom',
    startingEquipment: ['Shortsword (1d6 piercing)', 'Unarmored Defense', '75 gp'],
    abilityScores: {
      strength: 10,
      dexterity: 15,
      constitution: 13,
      intelligence: 8,
      wisdom: 14,
      charisma: 12,
    },
  },
  paladin: {
    name: 'Paladin',
    hitDie: 'd10',
    description: 'A holy warrior bound by sacred oaths',
    primaryStat: 'strength',
    secondaryStat: 'charisma',
    startingEquipment: ['Longsword (1d8 slashing)', 'Shield', 'Chain Mail', '75 gp'],
    abilityScores: {
      strength: 15,
      dexterity: 10,
      constitution: 13,
      intelligence: 8,
      wisdom: 12,
      charisma: 14,
    },
  },
  ranger: {
    name: 'Ranger',
    hitDie: 'd10',
    description: 'A wilderness scout who hunts their favored enemies',
    primaryStat: 'dexterity',
    secondaryStat: 'wisdom',
    startingEquipment: [
      'Shortsword (1d6 piercing)',
      'Longbow (1d8 piercing, range 150/600)',
      'Leather Armor',
      '75 gp',
    ],
    abilityScores: {
      strength: 12,
      dexterity: 15,
      constitution: 13,
      intelligence: 8,
      wisdom: 14,
      charisma: 10,
    },
  },
  rogue: {
    name: 'Rogue',
    hitDie: 'd8',
    description: 'A cunning scoundrel who strikes from the shadows',
    primaryStat: 'dexterity',
    secondaryStat: 'intelligence',
    startingEquipment: [
      'Shortsword (1d6 piercing)',
      'Dagger x2 (1d4 piercing)',
      'Leather Armor',
      '75 gp',
    ],
    abilityScores: {
      strength: 8,
      dexterity: 15,
      constitution: 12,
      intelligence: 14,
      wisdom: 13,
      charisma: 10,
    },
  },
  sorcerer: {
    name: 'Sorcerer',
    hitDie: 'd6',
    description: 'A spellcaster with innate magical power',
    primaryStat: 'charisma',
    secondaryStat: 'constitution',
    startingEquipment: [
      'Dagger (1d4 piercing)',
      'Light Crossbow (1d8 piercing, range 80/320)',
      '75 gp',
    ],
    abilityScores: {
      strength: 8,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 13,
      charisma: 15,
    },
  },
  warlock: {
    name: 'Warlock',
    hitDie: 'd8',
    description: 'A spellcaster bound by a pact with an otherworldly patron',
    primaryStat: 'charisma',
    secondaryStat: 'constitution',
    startingEquipment: [
      'Light Crossbow (1d8 piercing, range 80/320)',
      'Dagger (1d4 piercing)',
      'Leather Armor',
      '75 gp',
    ],
    abilityScores: {
      strength: 8,
      dexterity: 13,
      constitution: 14,
      intelligence: 12,
      wisdom: 10,
      charisma: 15,
    },
  },
  wizard: {
    name: 'Wizard',
    hitDie: 'd6',
    description: 'A scholarly mage who masters arcane magic',
    primaryStat: 'intelligence',
    secondaryStat: 'constitution',
    startingEquipment: ['Dagger (1d4 piercing)', '75 gp'],
    abilityScores: {
      strength: 8,
      dexterity: 13,
      constitution: 14,
      intelligence: 15,
      wisdom: 12,
      charisma: 10,
    },
  },
};

function CharacterCreationScene() {
  const { dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const [characterName, setCharacterName] = useState('');
  const [selectedClass, setSelectedClass] = useState('barbarian');
  const [error, setError] = useState('');

  const handleCreateCharacter = () => {
    // Validate name
    const trimmedName = characterName.trim();
    if (!trimmedName) {
      setError('Please enter a character name');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Character name must be at least 2 characters');
      return;
    }

    if (trimmedName.length > 20) {
      setError('Character name must be 20 characters or less');
      return;
    }

    // Create character with selected class
    const playerChar = new Character(trimmedName, selectedClass);
    const party = new Party();
    party.setPlayer(playerChar);

    // Update state with character and party
    dispatch({ type: actions.SET_PLAYER_CHARACTER, payload: playerChar });
    dispatch({ type: actions.SET_PARTY, payload: party });

    // Welcome message
    const welcome = generateCharacterWelcome(trimmedName, selectedClass);
    addMessage(welcome, 'system');

    // Transition to overworld scene
    dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'overworld' });
  };

  const handleQuickStart = () => {
    // Generate random name and class
    const randomName = generateRandomName();
    const randomClass = getRandomClass();

    // Create character immediately
    const playerChar = new Character(randomName, randomClass);
    const party = new Party();
    party.setPlayer(playerChar);

    // Update state with character and party
    dispatch({ type: actions.SET_PLAYER_CHARACTER, payload: playerChar });
    dispatch({ type: actions.SET_PARTY, payload: party });

    // Welcome message
    const welcome = generateCharacterWelcome(randomName, randomClass);
    addMessage(welcome, 'system');

    // Transition to overworld scene
    dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'overworld' });
  };

  const currentClassData = CLASS_DATA[selectedClass];

  return (
    <div className="title-screen">
      <TitleBackground />
      <div className="hero-book">
        <section className="journal-page hero-page--roster">
          <div className="journal-kicker">Chapter One</div>
          <h1 className="journal-title">Create Your Hero</h1>

          <div className="jp-heading">Choose a class</div>
          <div className="hero-roster">
            {Object.entries(CLASS_DATA).map(([key, data]) => {
              const isDisabled = DISABLED_CLASSES.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`hero-class ${selectedClass === key ? 'is-selected' : ''}`}
                  onClick={() => setSelectedClass(key)}
                  disabled={isDisabled}
                  aria-pressed={selectedClass === key}
                  title={isDisabled ? `${data.name} - Coming soon` : data.name}
                >
                  <PixelIcon name={`player:${key}`} scale={3} />
                  <span>{data.name}</span>
                  <small>{isDisabled ? 'soon' : data.hitDie}</small>
                </button>
              );
            })}
          </div>
          <p className="jp-note">The other classes are still being written.</p>
        </section>

        <section className="journal-page hero-page--sheet">
          <div className="journal-hero">
            <div className="hero-portrait">
              <PixelIcon name={`player:${selectedClass}`} scale={5} />
            </div>
            <div className="journal-hero-body">
              <div className="journal-kicker">
                Level 1 {currentClassData.name} · {currentClassData.hitDie} hit die
              </div>
              <label htmlFor="character-name" className="sr-only">
                Name
              </label>
              <input
                type="text"
                id="character-name"
                className="hero-name"
                placeholder="Name your hero"
                value={characterName}
                onChange={e => {
                  setCharacterName(e.target.value);
                  setError('');
                }}
                maxLength={20}
                autoFocus
              />
              {error && <div className="error-message">{error}</div>}
            </div>
          </div>

          <p className="jp-prose hero-description">{currentClassData.description}.</p>

          <div className="jp-heading">Ability scores</div>
          <div className="jp-scores">
            {ABILITIES.map(([label, key]) => (
              <div
                key={key}
                className={key === currentClassData.primaryStat ? 'is-primary' : undefined}
              >
                <b>{currentClassData.abilityScores[key]}</b>
                {label}
              </div>
            ))}
          </div>

          <div className="jp-heading">Starting equipment</div>
          <ul className="jp-list">
            {currentClassData.startingEquipment.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>

          <div className="hero-actions">
            <button className="title-btn btn-primary" onClick={handleCreateCharacter}>
              Begin Adventure
            </button>
            <button className="jp-link" onClick={handleQuickStart} type="button">
              Quick Start (random hero)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CharacterCreationScene;
export { CLASS_DATA };
