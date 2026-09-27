import { getExhaustionEffects } from '../../game/SurvivalManager';
import { useGameState, ACTIONS } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { Character } from '../../game/Character';
import { FEATURES } from '../../constants/gameConstants';
import PixelIcon from './PixelIcon';
import './CharacterStats.css';

/**
 * CharacterStats component - the character sheet page of the journal (D&D 5e format)
 */

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const ABILITIES = [
  ['STR', 'strength'],
  ['DEX', 'dexterity'],
  ['CON', 'constitution'],
  ['INT', 'intelligence'],
  ['WIS', 'wisdom'],
  ['CHA', 'charisma'],
] as const;

function CharacterStats({ character }: { character: Character | null }) {
  const { dispatch } = useGameState();
  const { addMessage } = useGameLog();

  if (!character) {
    return <p className="jp-prose jp-muted">No one has signed this journal yet.</p>;
  }

  // Additional null checks for nested properties
  if (!character.abilities || typeof character.getModifier !== 'function') {
    return <p className="jp-prose jp-muted">The ink on this page has run; it cannot be read.</p>;
  }

  const hpPercent = (character.currentHP / character.maxHP) * 100;
  const xpPercent =
    character.xpToNextLevel > 0 ? (character.xp / character.xpToNextLevel) * 100 : 0;
  const canLevelUp = character.shouldLevelUp && character.shouldLevelUp();
  const className = capitalize(character.class ?? '');
  const origin = [character.personality, character.background]
    .filter((s): s is string => !!s)
    .map(capitalize)
    .join(' · ');

  const handleLevelUp = () => {
    // Clone immutably, apply level-up, dispatch updated character
    const updatedCharacter = character.clone();
    const result = updatedCharacter.levelUp();
    if (!result) return;

    dispatch({
      type: ACTIONS.LEVEL_UP_CHARACTER,
      payload: { character: updatedCharacter },
    });

    addMessage(
      `Level up! ${character.name} is now level ${result.newLevel}. +${result.hpGain} max HP.`,
      'success'
    );
  };

  return (
    <div className="cs-sheet">
      <div className="cs-head">
        <PixelIcon name={`player:${character.class ?? ''}`} scale={3} />
        <div>
          <div className="cs-name">{character.name}</div>
          <div className="jp-prose cs-sub">
            Level {character.level} {className}
          </div>
          {origin && <div className="jp-note">{origin}</div>}
        </div>
      </div>

      <h3 className="jp-heading">Ability scores</h3>
      <div className="jp-scores cs-scores">
        {ABILITIES.map(([label, key]) => (
          <div key={key}>
            <b>{character.abilities[key]}</b>
            {label}
            <i>{formatModifier(character.getModifier(key))}</i>
          </div>
        ))}
      </div>

      <h3 className="jp-heading">Vitals</h3>
      <div className="cs-cols">
        <ul className="jp-rows">
          <li className="jp-row">
            <span>Armour class</span>
            <span>{character.armorClass}</span>
          </li>
          <li className="jp-row">
            <span>Proficiency</span>
            <span>+{character.proficiencyBonus}</span>
          </li>
        </ul>
        <ul className="jp-rows">
          <li className="jp-row">
            <span>Hit die</span>
            <span>{character.hitDie}</span>
          </li>
          <li className="jp-row">
            <span>Initiative</span>
            <span>{formatModifier(character.getModifier('dexterity'))}</span>
          </li>
        </ul>
      </div>

      <div className="cs-meter">
        <div className="jp-row">
          <span>Hit points</span>
          <span>
            {character.currentHP} / {character.maxHP}
          </span>
        </div>
        <div
          className="jp-bar"
          role="meter"
          aria-label="Hit points"
          aria-valuenow={character.currentHP}
          aria-valuemin={0}
          aria-valuemax={character.maxHP}
        >
          <span style={{ width: `${Math.min(Math.max(hpPercent, 0), 100)}%` }} />
        </div>
      </div>

      {character.level < 20 && (
        <div className="cs-meter">
          <div className="jp-row">
            <span>Experience</span>
            <span>
              {character.xp} / {character.xpToNextLevel} XP
            </span>
          </div>
          <div
            className={`jp-bar jp-bar--xp${canLevelUp ? ' cs-ready' : ''}`}
            role="meter"
            aria-label="Experience"
            aria-valuenow={character.xp}
            aria-valuemin={0}
            aria-valuemax={character.xpToNextLevel}
          >
            <span style={{ width: `${Math.min(xpPercent, 100)}%` }} />
          </div>
          {canLevelUp && (
            <div className="jp-actions">
              <button type="button" className="jp-link jp-link--primary" onClick={handleLevelUp}>
                <PixelIcon name="star" /> Level up!
              </button>
              <span className="jp-note">You have learned enough to grow stronger.</span>
            </div>
          )}
        </div>
      )}

      {character.level === 20 && (
        <p className="jp-prose cs-max">You have reached the height of your powers.</p>
      )}

      {/* Class Abilities */}
      {character.abilities_list && character.abilities_list.length > 0 && (
        <>
          <h3 className="jp-heading">Features</h3>
          <ul className="jp-list">
            {character.abilities_list.map((ability, index) => (
              <li key={index} title={ability.description}>
                <span>{ability.name}</span>
                {(ability.maxUses ?? -1) >= 0 && (
                  <span className="jp-aside">
                    {ability.uses} of {ability.maxUses} left
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Spells */}
      {character.spells && character.spells.length > 0 && (
        <>
          <h3 className="jp-heading">Spells</h3>
          <ul className="jp-list">
            {character.spells.map((spell, index) => (
              <li key={index}>
                {typeof spell === 'string' ? spell : ((spell as { name?: string }).name ?? '')}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Survival Stats (hidden when survival mechanics are disabled) */}
      {FEATURES.SURVIVAL_ENABLED && (
        <>
          <h3 className="jp-heading">Survival</h3>
          <ul className="jp-rows">
            <li className="jp-row">
              <span>Rations</span>
              <span className={character.rations <= 2 ? 'cs-warn' : undefined}>
                {character.rations} days
              </span>
            </li>
          </ul>
          {character.daysWithoutFood > 0 && (
            <p className="jp-prose cs-warn">
              <PixelIcon name="warning" /> {character.daysWithoutFood} day(s) without food
            </p>
          )}
          {character.exhaustionLevel > 0 && (
            <p className="jp-prose">
              <strong className="cs-warn">Exhaustion level {character.exhaustionLevel}.</strong>{' '}
              {getExhaustionEffects(character.exhaustionLevel).description}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default CharacterStats;
