import PropTypes from 'prop-types';
import { getExhaustionEffects } from '../../game/SurvivalManager.js';
import { useGameState, ACTIONS } from '../../contexts/GameStateContext.jsx';

/**
 * CharacterStats component - displays character stats in D&D 5e format
 */

function formatModifier(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function AbilityScore({ label, score, modifier }) {
  return (
    <div className="ability-score">
      <div className="ability-label">{label}</div>
      <div className="ability-value">{score}</div>
      <div className="ability-modifier">{formatModifier(modifier)}</div>
    </div>
  );
}

AbilityScore.propTypes = {
  label: PropTypes.string.isRequired,
  score: PropTypes.number.isRequired,
  modifier: PropTypes.number.isRequired
};

function CharacterStats({ character, characterId = 'player' }) {
  const { dispatch } = useGameState();

  if (!character) {
    return <div className="character-card">No character</div>;
  }

  // Additional null checks for nested properties
  if (!character.abilities || typeof character.getModifier !== 'function') {
    return <div className="character-card">Invalid character data</div>;
  }

  const hpPercent = (character.currentHP / character.maxHP) * 100;
  const xpPercent = character.xpToNextLevel > 0 ? (character.xp / character.xpToNextLevel) * 100 : 0;
  const canLevelUp = character.shouldLevelUp && character.shouldLevelUp();

  const handleLevelUp = () => {
    dispatch({
      type: ACTIONS.LEVEL_UP_CHARACTER,
      payload: { characterId }
    });
  };

  return (
    <div className="character-card">
      <div className="character-name">{character.name}</div>
      <div className="character-class">
        Level {character.level} {capitalize(character.class)}
      </div>

      <div className="ability-scores">
        <AbilityScore
          label="STR"
          score={character.abilities.strength}
          modifier={character.getModifier('strength')}
        />
        <AbilityScore
          label="DEX"
          score={character.abilities.dexterity}
          modifier={character.getModifier('dexterity')}
        />
        <AbilityScore
          label="CON"
          score={character.abilities.constitution}
          modifier={character.getModifier('constitution')}
        />
        <AbilityScore
          label="INT"
          score={character.abilities.intelligence}
          modifier={character.getModifier('intelligence')}
        />
        <AbilityScore
          label="WIS"
          score={character.abilities.wisdom}
          modifier={character.getModifier('wisdom')}
        />
        <AbilityScore
          label="CHA"
          score={character.abilities.charisma}
          modifier={character.getModifier('charisma')}
        />
      </div>

      <div className="character-stats">
        <div className="stat-item">
          <div className="stat-label">Armor Class</div>
          <div className="stat-value">{character.armorClass}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Proficiency</div>
          <div className="stat-value">+{character.proficiencyBonus}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Hit Die</div>
          <div className="stat-value">{character.hitDie}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Initiative</div>
          <div className="stat-value">
            {formatModifier(character.getModifier('dexterity'))}
          </div>
        </div>
      </div>

      <div className="stat-item" style={{ marginTop: '1rem' }}>
        <div className="stat-label">Hit Points</div>
        <div className="stat-value">
          {character.currentHP} / {character.maxHP}
        </div>
        <div className="hp-bar">
          <div className="hp-fill" style={{ width: `${hpPercent}%` }}>
            {Math.round(hpPercent)}%
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      {character.level < 20 && (
        <div className="stat-item" style={{ marginTop: '1rem' }}>
          <div className="stat-label">Experience</div>
          <div className="stat-value">
            {character.xp} / {character.xpToNextLevel} XP
          </div>
          <div className="hp-bar" style={{ position: 'relative' }}>
            <div
              className="hp-fill"
              style={{
                width: `${Math.min(xpPercent, 100)}%`,
                backgroundColor: canLevelUp ? '#f39c12' : '#3498db',
                animation: canLevelUp ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }}
            >
              {Math.round(xpPercent)}%
            </div>
          </div>
          {canLevelUp && (
            <button
              onClick={handleLevelUp}
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#f39c12',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}
            >
              LEVEL UP!
            </button>
          )}
        </div>
      )}

      {character.level === 20 && (
        <div style={{ marginTop: '1rem', textAlign: 'center', color: '#f39c12', fontWeight: 'bold' }}>
          MAX LEVEL REACHED
        </div>
      )}

      {/* Survival Stats */}
      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-color)' }}>
          Survival
        </div>

        <div className="character-stats">
          <div className="stat-item">
            <div className="stat-label">Rations</div>
            <div className="stat-value" style={{ color: character.rations <= 2 ? '#e74c3c' : 'var(--text-color)' }}>
              {character.rations} days
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Water</div>
            <div className="stat-value" style={{ color: character.water <= 2 ? '#e74c3c' : 'var(--text-color)' }}>
              {character.water} days
            </div>
          </div>
        </div>

        {(character.daysWithoutFood > 0 || character.daysWithoutWater > 0) && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            {character.daysWithoutFood > 0 && (
              <div style={{ color: '#e74c3c', marginBottom: '0.25rem' }}>
                ⚠ {character.daysWithoutFood} day(s) without food
              </div>
            )}
            {character.daysWithoutWater > 0 && (
              <div style={{ color: '#e74c3c' }}>
                ⚠ {character.daysWithoutWater} day(s) without water
              </div>
            )}
          </div>
        )}

        {character.exhaustionLevel > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: '4px', border: '1px solid #e74c3c' }}>
            <div style={{ fontWeight: 'bold', color: '#e74c3c', marginBottom: '0.25rem' }}>
              Exhaustion Level {character.exhaustionLevel}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-color)' }}>
              {getExhaustionEffects(character.exhaustionLevel).description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

CharacterStats.propTypes = {
  character: PropTypes.shape({
    name: PropTypes.string.isRequired,
    class: PropTypes.string.isRequired,
    level: PropTypes.number.isRequired,
    currentHP: PropTypes.number.isRequired,
    maxHP: PropTypes.number.isRequired,
    armorClass: PropTypes.number.isRequired,
    proficiencyBonus: PropTypes.number.isRequired,
    hitDie: PropTypes.string.isRequired,
    xp: PropTypes.number,
    xpToNextLevel: PropTypes.number,
    abilities: PropTypes.shape({
      strength: PropTypes.number.isRequired,
      dexterity: PropTypes.number.isRequired,
      constitution: PropTypes.number.isRequired,
      intelligence: PropTypes.number.isRequired,
      wisdom: PropTypes.number.isRequired,
      charisma: PropTypes.number.isRequired
    }).isRequired,
    getModifier: PropTypes.func.isRequired,
    shouldLevelUp: PropTypes.func
  }),
  characterId: PropTypes.string
};

export default CharacterStats;
