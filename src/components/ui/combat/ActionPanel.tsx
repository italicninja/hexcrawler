import ActionEconomyDisplay from './ActionEconomyDisplay';
import PixelIcon from '../PixelIcon';
import './ActionPanel.css';

/**
 * ActionPanel - Display available actions for current combatant
 * Dynamically generates action buttons based on combatant class and state
 * Actions: Move, Attack, Dodge, Dash, Disengage, Hide, Abilities, Cast Spell, End Turn
 * Bonus Actions: Rage (barbarian), class bonus actions
 */
interface PanelAbility {
  name: string;
  actionType?: string;
  uses?: number;
  maxUses?: number;
  effects?: Record<string, unknown>;
}

interface PanelStatusEffect {
  name: string;
  effects?: { rageDamageBonus?: number; [key: string]: unknown };
}

interface PanelCharacter {
  class?: string;
  level?: number;
  moveDistance?: number;
  abilities_list?: PanelAbility[];
  spells?: unknown[];
  getAvailableBonusActions?: () => PanelAbility[];
  [key: string]: unknown;
}

interface PanelCombatant {
  name?: string;
  character?: PanelCharacter;
  characterClass?: string;
  level?: number;
  abilities_list?: PanelAbility[];
  spells?: unknown[];
  statusEffects?: PanelStatusEffect[];
}

interface PanelTurnState {
  actionUsed?: boolean;
  bonusActionUsed?: boolean;
  attacksMade?: number;
}

interface ActionPanelProps {
  combatant: PanelCombatant | null;
  selectedAction?: string;
  movementRemaining?: number;
  attacksUsedThisTurn: number;
  turnState?: PanelTurnState;
  onActionSelect: (action: string) => void;
  onAbilityClick?: () => void;
  onFreeAbilityClick?: (ability: PanelAbility) => void;
  onBonusActionClick: (ability: PanelAbility) => void;
  onSpellClick?: () => void;
  onDodgeClick?: () => void;
  onDashClick?: () => void;
  onDisengageClick?: () => void;
  onHideClick?: () => void;
  onEndTurn?: () => void;
}

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
}: ActionPanelProps) {
  if (!combatant) {
    return <p className="jp-note">No combatant selected</p>;
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
    (ability: PanelAbility) =>
      ability.actionType !== 'bonusAction' &&
      ability.actionType !== 'free' &&
      ability.actionType !== 'passive' &&
      (!ability.maxUses || ability.maxUses === -1 || (ability.uses ?? 0) > 0)
  );

  // Bonus actions available this turn (Rage, Cunning Action, etc.)
  const availableBonusActions: PanelAbility[] = character?.getAvailableBonusActions
    ? character.getAvailableBonusActions()
    : abilitiesList.filter(
        (ability: PanelAbility) =>
          ability.actionType === 'bonusAction' &&
          (!ability.maxUses || ability.maxUses === -1 || (ability.uses ?? 0) > 0)
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
   * One action as a ruled row: pixel icon, name, and a short gloss of what it does.
   * The accessible name is just the label so tests and screen readers stay terse.
   */
  const ActionRow = ({
    action,
    icon,
    label,
    gloss,
    disabled,
    onClick,
  }: {
    action: string;
    icon: string;
    label: string;
    gloss?: string;
    disabled?: boolean;
    onClick?: () => void;
  }) => {
    const isSelected = selectedAction === action;
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={isSelected}
        className={isSelected ? 'is-selected' : undefined}
      >
        <PixelIcon name={icon} scale={2} />
        <span className="ap-name">{label}</span>
        <span className="jp-aside">{isSelected ? 'chosen' : gloss}</span>
      </button>
    );
  };

  const rageEffect = combatant.statusEffects?.find(e => e.name === 'Rage');
  const bonusActions = Array.from(
    new Map(availableBonusActions.map((a): [string, PanelAbility] => [a.name, a])).values()
  );
  const actionGone = actionUsed || attackActionCommitted;

  return (
    <div className="action-panel">
      <p className="jp-prose ap-turn">
        <em className="ap-who">{combatant.name}</em>
        <span>, it is your turn.</span>
      </p>

      {turnState && <ActionEconomyDisplay turnState={turnState} character={combatant.character} />}

      {rageEffect && (
        <p className="ap-rage">
          <PixelIcon name="bolt" scale={2} />
          <span>
            <b>Raging.</b> +{rageEffect.effects?.rageDamageBonus ?? 2} damage, resistant to
            bludgeoning, piercing and slashing, advantage on Strength.
          </span>
        </p>
      )}

      <h4 className="jp-heading">Actions</h4>
      <div className="jp-list ap-list">
        <ActionRow
          action="move"
          icon="move"
          label={`Move${movementRemaining !== undefined ? ` (${movementRemaining} ft)` : ''}`}
          gloss="pick a hex"
          disabled={(movementRemaining ?? 0) <= 0}
          onClick={() => onActionSelect('move')}
        />

        {/* Free-action declarations (e.g. Reckless Attack) — must be used before first attack */}
        {freeAbilities.map(ability => {
          const alreadyActive = combatant.statusEffects?.some(e => e.name === ability.name);
          return (
            <ActionRow
              key={ability.name}
              action={`free-${ability.name}`}
              icon="die"
              label={alreadyActive ? `${ability.name} (active)` : ability.name}
              gloss={alreadyActive ? 'declared' : 'free, before you strike'}
              disabled={attacksMade > 0 || alreadyActive}
              onClick={() => onFreeAbilityClick && onFreeAbilityClick(ability)}
            />
          );
        })}

        <ActionRow
          action="attack"
          icon="action"
          label={
            attacksUsedThisTurn > 0 ? `Attack (${attacksUsedThisTurn}/${maxAttacks})` : 'Attack'
          }
          gloss={maxAttacks > 1 ? `${maxAttacks} swings` : 'strike a foe in reach'}
          disabled={!canAttackAgain || otherActionTaken}
          onClick={() => onActionSelect('attack')}
        />
        <ActionRow
          action="dodge"
          icon="equipment"
          label="Dodge"
          gloss="foes strike at disadvantage"
          disabled={actionGone}
          onClick={onDodgeClick}
        />
        <ActionRow
          action="dash"
          icon="arrowUp"
          label="Dash"
          gloss="double your movement"
          disabled={actionGone}
          onClick={onDashClick}
        />
        <ActionRow
          action="disengage"
          icon="arrowLeft"
          label="Disengage"
          gloss="leave reach safely"
          disabled={actionGone}
          onClick={onDisengageClick}
        />
        <ActionRow
          action="hide"
          icon="lock"
          label="Hide"
          gloss="slip out of sight"
          disabled={actionGone}
          onClick={onHideClick}
        />
        {availableAbilities.length > 0 && (
          <ActionRow
            action="ability"
            icon="star"
            label={`Abilities (${availableAbilities.length})`}
            gloss="class features"
            disabled={actionGone}
            onClick={onAbilityClick}
          />
        )}
        {hasSpells && (
          <ActionRow
            action="spell"
            icon="bonus"
            label="Cast Spell"
            gloss="from your spellbook"
            disabled={actionGone}
            onClick={onSpellClick}
          />
        )}
      </div>

      {/* Bonus actions — deduplicated, remaining uses shown as pips */}
      {bonusActions.length > 0 && (
        <>
          <h4 className="jp-heading">Bonus actions</h4>
          <div className="jp-list ap-list">
            {bonusActions.map(ability => {
              const hasCharges = ability.maxUses !== undefined && ability.maxUses !== -1;
              const label = `${ability.name}${hasCharges ? ` (${ability.uses}/${ability.maxUses})` : ''}`;
              return (
                <button
                  key={ability.name}
                  type="button"
                  aria-label={label}
                  disabled={bonusActionUsed}
                  onClick={() => onBonusActionClick(ability)}
                >
                  <PixelIcon name="bolt" scale={2} />
                  <span className="ap-name">{ability.name}</span>
                  {hasCharges && (
                    <span className="ap-pips" aria-hidden="true">
                      {Array.from({ length: ability.maxUses ?? 0 }, (_, i) => (
                        <i key={i} className={i < (ability.uses ?? 0) ? 'is-full' : undefined} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="ap-end">
        <button type="button" className="jp-link jp-link--primary" onClick={onEndTurn}>
          End Turn <PixelIcon name="chevronRight" />
        </button>
      </div>
    </div>
  );
}

export default ActionPanel;
