// @ts-nocheck
import { useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { Character } from '../../game/Character';
import { Party } from '../../game/Party';
import { generateCharacterWelcome } from '../../utils/flavorTextGenerator';

// D&D 5e Standard Array: [15, 14, 13, 12, 10, 8]
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// Random hero name lists for Quick Start
const HERO_NAMES = [
  // Fantasy warrior names
  'Aldric',
  'Theron',
  'Gareth',
  'Bران',
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
const getRandomElement = array => {
  return array[Math.floor(Math.random() * array.length)];
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
const CLASS_DATA = {
  barbarian: {
    name: 'Barbarian',
    hitDie: 'd12',
    description: 'A fierce warrior who channels primal rage in battle',
    primaryStat: 'strength',
    secondaryStat: 'constitution',
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
  const { state, dispatch, actions } = useGameState();
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
    <div className="character-creation-screen">
      <div className="character-creation-content">
        <h1 className="title-logo">Create Your Hero</h1>

        {/* Begin Adventure Button - Moved to Top */}
        <button
          className="btn-primary btn-large btn-begin-adventure"
          onClick={handleCreateCharacter}
        >
          Begin Adventure
        </button>

        {/* Quick Start Button */}
        <button className="btn-quick-start" onClick={handleQuickStart} type="button">
          Quick Start (Random Hero)
        </button>

        <div className="divider-text">
          <span>or customize</span>
        </div>

        <div className="character-creation-form">
          {/* Character Name Input */}
          <div className="control-group">
            <label htmlFor="character-name">Name:</label>
            <input
              type="text"
              id="character-name"
              placeholder="Enter name"
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

          {/* Class Selection */}
          <div className="control-group">
            <label>Class:</label>
            <div className="class-selection-grid">
              {Object.entries(CLASS_DATA).map(([key, data]) => {
                const isDisabled = DISABLED_CLASSES.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`class-button ${selectedClass === key ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && setSelectedClass(key)}
                    disabled={isDisabled}
                    title={isDisabled ? `${data.name} - Coming soon` : data.name}
                  >
                    <div className="class-button-name">{data.name}</div>
                    <div className="class-button-hitdie">{isDisabled ? 'soon' : data.hitDie}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Class Description - Condensed */}
          <div className="class-info-compact">
            <div className="class-info-header">
              <h3>{currentClassData.name}</h3>
              <span className="class-hitdie">{currentClassData.hitDie}</span>
            </div>
            <p className="class-description">{currentClassData.description}</p>
          </div>

          {/* Ability Scores Display - Condensed */}
          <div className="ability-scores-preview-compact">
            <h4>Starting Scores</h4>
            <div className="ability-scores-grid">
              <div className="ability-score">
                <div className="ability-label">STR</div>
                <div className="ability-value">{currentClassData.abilityScores.strength}</div>
              </div>
              <div className="ability-score">
                <div className="ability-label">DEX</div>
                <div className="ability-value">{currentClassData.abilityScores.dexterity}</div>
              </div>
              <div className="ability-score">
                <div className="ability-label">CON</div>
                <div className="ability-value">{currentClassData.abilityScores.constitution}</div>
              </div>
              <div className="ability-score">
                <div className="ability-label">INT</div>
                <div className="ability-value">{currentClassData.abilityScores.intelligence}</div>
              </div>
              <div className="ability-score">
                <div className="ability-label">WIS</div>
                <div className="ability-value">{currentClassData.abilityScores.wisdom}</div>
              </div>
              <div className="ability-score">
                <div className="ability-label">CHA</div>
                <div className="ability-value">{currentClassData.abilityScores.charisma}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CharacterCreationScene;
export { CLASS_DATA };
