// @ts-nocheck
import PropTypes from 'prop-types';
import ActionEconomyDisplay from './ActionEconomyDisplay';

/**
 * ActionPanel - Display available actions for current combatant
 * Dynamically generates action buttons based on combatant class and state
 * Actions: Move, Attack, Dodge, Dash, Disengage, Hide, Abilities, Cast Spell, End Turn
 * Bonus Actions: Rage (barbarian), class bonus actions
 */
function ActionPanel({
  combatant,
  selectedAction,
  movementRemaining,
  attacksUsedThisTurn,
  turnState,
  onActionSelect,
  onAbilityClick,
  onFreeAbilityClick,
  onBonusActionClick,
  onSpellClick,
  onDodgeClick,
  onDashClick,
  onDisengageClick,
  onHideClick,
  onEndTurn,
}) {
  if (!combatant) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
        No combatant selected
      </div>
    );
  }

  // Character instance lives on combatant.character for allies
  const character = combatant.character;

  // Check if combatant has Extra Attack feature
  const characterClass = (character?.class || combatant.characterClass || '').toLowerCase();
  const characterLevel = character?.level || combatant.level || 1;
  const hasExtraAttack =
    characterLevel >= 5 &&
    ['fighter', 'barbarian', 'paladin', 'ranger', 'monk'].includes(characterClass);

  const maxAttacks = hasExtraAttack ? 2 : 1;
  const canAttackAgain = attacksUsedThisTurn < maxAttacks;

  // Pull abilities from the Character instance, falling back to flat combatant prop
  const abilitiesList = character?.abilities_list || combatant.abilities_list || [];

  // Free-action abilities (e.g. Reckless Attack) — declared before first attack, no action cost
  const freeAbilities = abilitiesList.filter(ability => ability.actionType === 'free');

  // Abilities usable as an Action (non-bonus, non-free, with uses remaining)
  const availableAbilities = abilitiesList.filter(
    ability =>
      ability.actionType !== 'bonusAction' &&
      ability.actionType !== 'free' &&
      ability.actionType !== 'passive' &&
      (!ability.maxUses || ability.maxUses === -1 || ability.uses > 0)
  );

  // Bonus actions available this turn (Rage, Cunning Action, etc.)
  const availableBonusActions = character?.getAvailableBonusActions
    ? character.getAvailableBonusActions()
    : abilitiesList.filter(
        ability =>
          ability.actionType === 'bonusAction' &&
          (!ability.maxUses || ability.maxUses === -1 || ability.uses > 0)
      );

  // Check for spell slots (simplified - just check if they have spells)
  const hasSpells = (character?.spells || combatant.spells || []).length > 0;

  const actionUsed = turnState?.actionUsed || false;
  const bonusActionUsed = turnState?.bonusActionUsed || false;
  const attacksMade = turnState?.attacksMade || 0;

  // Attack and the other action options (Dodge, Dash, Disengage, Hide, Ability, Spell)
  // are mutually exclusive — they all consume the Action for the turn.
  // Exception: traits like Cunning Action let Rogues Disengage/Hide as a Bonus Action,
  // but those appear in the Bonus Actions section, not here.
  const attackActionCommitted = attacksMade > 0; // started the Attack action
  const otherActionTaken = actionUsed && !attackActionCommitted; // spent action on non-attack

  /**
   * Render an action button — full-width horizontal row, no icon
   */
  const ActionButton = ({ action, label, disabled, color, onClick }) => {
    const isSelected = selectedAction === action;
    const baseColor = color || 'var(--primary-color)';

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontWeight: '600',
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          backgroundColor: isSelected ? baseColor : 'var(--bg-lighter)',
          color: isSelected ? 'white' : 'var(--text-color)',
          border: `1px solid ${disabled ? 'var(--border-color)' : baseColor}`,
          transition: 'filter 0.15s',
        }}
      >
        {label}
        {isSelected && <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>selected</span>}
      </button>
    );
  };

  ActionButton.propTypes = {
    action: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    color: PropTypes.string,
    onClick: PropTypes.func.isRequired,
  };

  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--panel-bg)',
        border: '2px solid var(--border-color)',
      }}
    >
      {/* Action Economy Display */}
      {turnState && <ActionEconomyDisplay turnState={turnState} character={combatant.character} />}

      {/* Rage banner — shown whenever the combatant has an active Rage status effect */}
      {(() => {
        const rageEffect = combatant.statusEffects?.find(e => e.name === 'Rage');
        if (!rageEffect) return null;
        const bonus = rageEffect.effects?.rageDamageBonus ?? 2;
        return (
          <div
            style={{
              margin: '8px 0 4px',
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #7f1d1d, #c0392b)',
              border: '1px solid #e74c3c',
              color: 'white',
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '3px' }}>RAGING</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
              +{bonus} damage · BPS resistance · STR advantage
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <h3 className="font-bold text-lg mb-1 mt-3" style={{ color: 'var(--text-color)' }}>
        Actions
      </h3>
      <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        {combatant.name}
      </div>

      {/* Actions — vertical stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
        <ActionButton
          action="move"
          label={`Move${movementRemaining !== undefined ? ` (${movementRemaining} ft)` : ''}`}
          disabled={movementRemaining <= 0}
          color="var(--primary-color)"
          onClick={() => onActionSelect('move')}
        />

        {/* Free-action declarations (e.g. Reckless Attack) — must be used before first attack */}
        {freeAbilities.map(ability => {
          const alreadyActive = combatant.statusEffects?.some(e => e.name === ability.name);
          return (
            <ActionButton
              key={ability.name}
              action={`free-${ability.name}`}
              label={alreadyActive ? `${ability.name} (active)` : ability.name}
              disabled={attacksMade > 0 || alreadyActive}
              color="#e67e22"
              onClick={() => onFreeAbilityClick && onFreeAbilityClick(ability)}
            />
          );
        })}

        <ActionButton
          action="attack"
          label={
            attacksUsedThisTurn > 0 ? `Attack (${attacksUsedThisTurn}/${maxAttacks})` : 'Attack'
          }
          disabled={!canAttackAgain || otherActionTaken}
          color="#e74c3c"
          onClick={() => onActionSelect('attack')}
        />
        <ActionButton
          action="dodge"
          label="Dodge"
          disabled={actionUsed || attackActionCommitted}
          color="#3498db"
          onClick={onDodgeClick}
        />
        <ActionButton
          action="dash"
          label="Dash"
          disabled={actionUsed || attackActionCommitted}
          color="#2ecc71"
          onClick={onDashClick}
        />
        <ActionButton
          action="disengage"
          label="Disengage"
          disabled={actionUsed || attackActionCommitted}
          color="#f39c12"
          onClick={onDisengageClick}
        />
        <ActionButton
          action="hide"
          label="Hide"
          disabled={actionUsed || attackActionCommitted}
          color="#9b59b6"
          onClick={onHideClick}
        />
        {availableAbilities.length > 0 && (
          <ActionButton
            action="ability"
            label={`Abilities (${availableAbilities.length})`}
            disabled={actionUsed || attackActionCommitted}
            color="#9b59b6"
            onClick={onAbilityClick}
          />
        )}
        {hasSpells && (
          <ActionButton
            action="spell"
            label="Cast Spell"
            disabled={actionUsed || attackActionCommitted}
            color="#f39c12"
            onClick={onSpellClick}
          />
        )}
      </div>

      {/* Bonus Actions — vertical stack, deduplicated, charges on label */}
      {availableBonusActions.length > 0 && (
        <>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: '8px',
              marginBottom: '4px',
            }}
          >
            Bonus Actions
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}
          >
            {Array.from(new Map(availableBonusActions.map(a => [a.name, a])).values()).map(
              ability => {
                const hasCharges = ability.maxUses !== undefined && ability.maxUses !== -1;
                const chargeLabel = hasCharges ? ` (${ability.uses}/${ability.maxUses})` : '';
                return (
                  <ActionButton
                    key={ability.name}
                    action={`bonus-${ability.name}`}
                    label={`${ability.name}${chargeLabel}`}
                    disabled={bonusActionUsed}
                    color="#c0392b"
                    onClick={() => onBonusActionClick(ability)}
                  />
                );
              }
            )}
          </div>
        </>
      )}

      {/* End Turn */}
      <button
        className="w-full py-2 rounded font-bold text-sm transition-all duration-150 hover:brightness-110 mt-1"
        style={{
          backgroundColor: 'var(--accent-color)',
          color: 'var(--bg-color)',
          border: '2px solid var(--accent-color)',
        }}
        onClick={onEndTurn}
      >
        End Turn
      </button>
    </div>
  );
}

export default ActionPanel;
