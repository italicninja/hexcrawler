import PropTypes from 'prop-types';

/**
 * ActionPanel - Display available actions for current combatant
 * Dynamically generates action buttons based on combatant class and state
 * Actions: Move, Attack, Dodge, Dash, Abilities, Cast Spell, End Turn
 */
function ActionPanel({
  combatant,
  selectedAction,
  movementRemaining,
  attacksUsedThisTurn,
  onActionSelect,
  onAbilityClick,
  onSpellClick,
  onEndTurn
}) {
  if (!combatant) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
        No combatant selected
      </div>
    );
  }

  // Check if combatant has Extra Attack feature
  const hasExtraAttack = combatant.level >= 5 && 
    ['fighter', 'barbarian', 'paladin', 'ranger', 'monk'].includes(combatant.class?.toLowerCase());

  const maxAttacks = hasExtraAttack ? 2 : 1;
  const canAttackAgain = attacksUsedThisTurn < maxAttacks;

  // Check for abilities with remaining uses
  const availableAbilities = combatant.abilities_list?.filter(
    ability => !ability.maxUses || ability.maxUses === -1 || (ability.uses > 0)
  ) || [];

  // Check for spell slots (simplified - just check if they have spells)
  const hasSpells = combatant.spells && combatant.spells.length > 0;

  /**
   * Render an action button
   */
  const ActionButton = ({ action, label, icon, disabled, color, onClick }) => {
    const isSelected = selectedAction === action;
    const baseColor = color || 'var(--primary-color)';

    return (
      <button
        className={`
          rounded-lg p-3 font-semibold transition-all duration-200
          flex flex-col items-center justify-center gap-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
          ${isSelected ? 'ring-2' : ''}
        `}
        style={{
          backgroundColor: isSelected ? baseColor : 'var(--bg-lighter)',
          color: isSelected ? 'white' : 'var(--text-color)',
          border: `2px solid ${disabled ? 'var(--border-color)' : baseColor}`,
          ringColor: baseColor
        }}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        <div className="text-2xl">{icon}</div>
        <div className="text-sm">{label}</div>
      </button>
    );
  };

  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--panel-bg)',
        border: '2px solid var(--border-color)'
      }}
    >
      {/* Header */}
      <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-color)' }}>
        Actions
      </h3>
      <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        {combatant.name}
      </div>

      {/* Movement Info */}
      {movementRemaining !== undefined && movementRemaining !== null && (
        <div className="mb-4 p-2 rounded" style={{
          backgroundColor: 'var(--bg-lighter)',
          border: '1px solid var(--border-color)'
        }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Movement Remaining
          </div>
          <div className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
            {movementRemaining} ft
          </div>
        </div>
      )}

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Move */}
        <ActionButton
          action="move"
          label="Move"
          icon="🚶"
          disabled={movementRemaining <= 0}
          color="var(--primary-color)"
          onClick={() => onActionSelect('move')}
        />

        {/* Attack */}
        <ActionButton
          action="attack"
          label={attacksUsedThisTurn > 0 ? `Attack (${attacksUsedThisTurn}/${maxAttacks})` : 'Attack'}
          icon="⚔️"
          disabled={!canAttackAgain}
          color="#e74c3c"
          onClick={() => onActionSelect('attack')}
        />

        {/* Dodge */}
        <ActionButton
          action="dodge"
          label="Dodge"
          icon="🛡️"
          color="#3498db"
          onClick={() => onActionSelect('dodge')}
        />

        {/* Dash */}
        <ActionButton
          action="dash"
          label="Dash"
          icon="💨"
          color="#2ecc71"
          onClick={() => onActionSelect('dash')}
        />

        {/* Abilities */}
        {availableAbilities.length > 0 && (
          <ActionButton
            action="ability"
            label={`Abilities (${availableAbilities.length})`}
            icon="✨"
            color="#9b59b6"
            onClick={onAbilityClick}
          />
        )}

        {/* Cast Spell */}
        {hasSpells && (
          <ActionButton
            action="spell"
            label="Cast Spell"
            icon="🔮"
            color="#f39c12"
            onClick={onSpellClick}
          />
        )}
      </div>

      {/* End Turn Button */}
      <button
        className="w-full py-3 rounded-lg font-bold text-lg transition-all duration-200 hover:scale-105"
        style={{
          backgroundColor: 'var(--accent-color)',
          color: 'var(--bg-color)',
          border: '2px solid var(--accent-color)'
        }}
        onClick={onEndTurn}
      >
        End Turn
      </button>

      {/* Ability Uses Display */}
      {availableAbilities.length > 0 && (
        <div className="mt-4 p-3 rounded" style={{
          backgroundColor: 'var(--bg-lighter)',
          border: '1px solid var(--border-color)'
        }}>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Ability Uses
          </div>
          {availableAbilities.map((ability, idx) => (
            <div key={idx} className="flex justify-between text-sm mb-1" style={{ color: 'var(--text-light)' }}>
              <span>{ability.name}</span>
              <span className="font-semibold">
                {ability.maxUses === -1 ? '∞' : `${ability.uses}/${ability.maxUses}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

ActionPanel.propTypes = {
  combatant: PropTypes.shape({
    name: PropTypes.string.isRequired,
    class: PropTypes.string,
    level: PropTypes.number,
    abilities_list: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        uses: PropTypes.number,
        maxUses: PropTypes.number
      })
    ),
    spells: PropTypes.array
  }),
  selectedAction: PropTypes.string,
  movementRemaining: PropTypes.number,
  attacksUsedThisTurn: PropTypes.number,
  onActionSelect: PropTypes.func.isRequired,
  onAbilityClick: PropTypes.func,
  onSpellClick: PropTypes.func,
  onEndTurn: PropTypes.func.isRequired
};

export default ActionPanel;
