import type { MouseEvent } from 'react';
import { useEventListener } from '../../../hooks/useEventListener';

/**
 * AbilityMenu - Modal overlay for selecting class ability
 * Shows available abilities with uses remaining, descriptions, and effects.
 */
interface Ability {
  name: string;
  uses?: number;
  maxUses?: number;
  actionType?: string;
  description?: string;
  effect?: string;
}

interface AbilityCharacter {
  abilities_list?: Ability[];
}

interface AbilityCombatant {
  statusEffects?: Array<{ name: string; roundsActive?: number }>;
}

interface AbilityMenuProps {
  character?: AbilityCharacter | null;
  combatant?: AbilityCombatant | null;
  onSelect: (ability: Ability) => void;
  onClose: () => void;
}

function AbilityMenu({ character, combatant, onSelect, onClose }: AbilityMenuProps) {
  // Filter abilities with uses remaining (or unlimited uses)
  const baseAbilities =
    character?.abilities_list?.filter(
      ability => !ability.maxUses || ability.maxUses === -1 || (ability.uses ?? 0) > 0
    ) || [];

  // Dynamically surface "Extend Rage" as a bonus action when the combatant is
  // currently raging and the bonus action hasn't been used yet.
  const rageEffect = combatant?.statusEffects?.find(e => e.name === 'Rage');
  const extendRageOption: Ability | null =
    rageEffect && (rageEffect.roundsActive ?? 0) > 0
      ? {
          name: 'Extend Rage',
          uses: -1,
          maxUses: -1,
          actionType: 'bonusAction',
          description:
            'Spend your Bonus Action to keep your Rage burning for another round when you have not made an attack or forced a saving throw.',
        }
      : null;

  const availableAbilities = extendRageOption
    ? [...baseAbilities, extendRageOption]
    : baseAbilities;

  // Handle ESC key to close
  useEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  });

  // Handle click outside to close
  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (availableAbilities.length === 0) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        onClick={handleOverlayClick}
      >
        <div
          className="rounded-lg p-6 max-w-md w-full mx-4"
          style={{
            backgroundColor: 'var(--panel-bg)',
            border: '2px solid var(--border-color)',
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>
            No Abilities Available
          </h2>
          <p className="mb-4" style={{ color: 'var(--text-light)' }}>
            You have no abilities with remaining uses.
          </p>
          <button
            className="w-full py-2 rounded-lg font-semibold"
            style={{
              backgroundColor: 'var(--primary-color)',
              color: 'white',
            }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  /**
   * Get ability description based on class and ability name
   */
  const getAbilityDescription = (ability: Ability) => {
    const descriptions: Record<string, string> = {
      Rage: 'Enter a Rage (Bonus Action). Resistance to Bludgeoning/Piercing/Slashing damage, +2 bonus damage on Strength attacks, and Advantage on Strength checks and saving throws. Lasts until end of next turn — extend by attacking, forcing a save, or using Bonus Action.',
      'Extend Rage':
        'Spend your Bonus Action to extend your Rage for another round when you have not made an attack or forced a saving throw this turn.',
      'Bardic Inspiration':
        'Grant an ally a d6 inspiration die they can add to an ability check, attack roll, or saving throw.',
      'Channel Divinity': 'Harness divine energy to produce a magical effect based on your domain.',
      'Wild Shape': 'Assume the shape of a beast you have seen before.',
      'Second Wind': 'Regain 1d10 + fighter level hit points as a bonus action.',
      'Ki Points':
        'Spend ki points to fuel special monk abilities like Flurry of Blows, Patient Defense, or Step of the Wind.',
      'Divine Sense': 'Detect the presence of celestials, fiends, or undead within 60 feet.',
      'Lay on Hands': 'Restore hit points equal to paladin level × 5, distributed as you choose.',
      'Sorcery Points': 'Use sorcery points to create spell slots or fuel metamagic options.',
      'Action Surge': 'Take an additional action on your turn.',
      'Sneak Attack':
        'Deal extra damage when you have advantage or an ally is within 5 feet of the target.',
    };
    return ability.description || descriptions[ability.name] || 'A special class ability.';
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      onClick={handleOverlayClick}
    >
      <div
        className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--panel-bg)',
          border: '2px solid var(--accent-color)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center p-4"
          style={{
            backgroundColor: 'var(--bg-lighter)',
            borderBottom: '2px solid var(--border-color)',
          }}
        >
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-color)' }}>
            Select Ability
          </h2>
          <button
            className="text-3xl font-bold px-3 py-1 rounded-full transition-colors hover:bg-red-500 hover:bg-opacity-20"
            style={{ color: 'var(--text-color)' }}
            onClick={onClose}
            aria-label="Close ability menu"
          >
            ×
          </button>
        </div>

        {/* Ability List */}
        <div className="overflow-y-auto p-4 space-y-3">
          {availableAbilities.map((ability, index) => (
            <button
              key={index}
              className="w-full text-left p-4 rounded-lg transition-all duration-200 hover:scale-102 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-lighter)',
                border: '2px solid var(--border-color)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-color)';
                e.currentTarget.style.backgroundColor = 'var(--bg-color)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.backgroundColor = 'var(--bg-lighter)';
              }}
              onClick={() => {
                onSelect(ability);
                onClose();
              }}
            >
              {/* Ability name and uses */}
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>
                  {ability.name}
                </h3>
                <div
                  className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'var(--bg-color)',
                  }}
                >
                  {ability.maxUses === -1 ? 'Unlimited' : `${ability.uses}/${ability.maxUses} uses`}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-light)' }}>
                {getAbilityDescription(ability)}
              </p>

              {/* Effect (if defined) */}
              {ability.effect && (
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Effect: {ability.effect}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          className="p-4"
          style={{
            backgroundColor: 'var(--bg-lighter)',
            borderTop: '2px solid var(--border-color)',
          }}
        >
          <button
            className="w-full py-2 rounded-lg font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--border-color)',
              color: 'var(--text-color)',
            }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default AbilityMenu;
