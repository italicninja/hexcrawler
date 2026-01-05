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

function CharacterStats({ character }) {
  if (!character) {
    return <div className="character-card">No character</div>;
  }

  const hpPercent = (character.currentHP / character.maxHP) * 100;

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
    </div>
  );
}

export default CharacterStats;
