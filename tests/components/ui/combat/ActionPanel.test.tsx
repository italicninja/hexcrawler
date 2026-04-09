// @ts-nocheck — component and its deps use @ts-nocheck; casting to any for test isolation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Mock ActionEconomyDisplay (heavy UI, not under test) ────────────────────

vi.mock('../../../../src/components/ui/combat/ActionEconomyDisplay', () => ({
  default: () => <div data-testid="action-economy" />,
}));

// ─── Import component after mocks ────────────────────────────────────────────

import ActionPanel from '../../../../src/components/ui/combat/ActionPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCombatant(overrides = {}) {
  return {
    name: 'Aria',
    isAlly: true,
    character: {
      class: 'fighter',
      level: 1,
      abilities_list: [],
      spells: [],
      getAvailableBonusActions: undefined,
    },
    statusEffects: [],
    spells: [],
    abilities_list: [],
    ...overrides,
  };
}

function makeTurnState(overrides = {}) {
  return {
    actionUsed: false,
    bonusActionUsed: false,
    attacksMade: 0,
    ...overrides,
  };
}

const noop = vi.fn();

function defaultProps(overrides = {}) {
  return {
    combatant: makeCombatant(),
    selectedAction: null,
    movementRemaining: 30,
    attacksUsedThisTurn: 0,
    turnState: makeTurnState(),
    onActionSelect: noop,
    onAbilityClick: noop,
    onFreeAbilityClick: noop,
    onBonusActionClick: noop,
    onSpellClick: noop,
    onDodgeClick: noop,
    onDashClick: noop,
    onDisengageClick: noop,
    onHideClick: noop,
    onEndTurn: noop,
    ...overrides,
  };
}

// ─── Render tests ─────────────────────────────────────────────────────────────

describe('ActionPanel — rendering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders "No combatant selected" when combatant is null', () => {
    render(<ActionPanel {...defaultProps({ combatant: null })} />);
    expect(screen.getByText(/no combatant selected/i)).toBeInTheDocument();
  });

  it('renders the combatant name', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByText('Aria')).toBeInTheDocument();
  });

  it('renders the Actions header', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders the Move button', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /move/i })).toBeInTheDocument();
  });

  it('renders the Attack button', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /attack/i })).toBeInTheDocument();
  });

  it('renders the Dodge button', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /dodge/i })).toBeInTheDocument();
  });

  it('renders the Dash button', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /dash/i })).toBeInTheDocument();
  });

  it('renders the Disengage button', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /disengage/i })).toBeInTheDocument();
  });

  it('renders the Hide button', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
  });

  it('renders the End Turn button', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /end turn/i })).toBeInTheDocument();
  });

  it('shows remaining movement feet in the Move button label', () => {
    render(<ActionPanel {...defaultProps({ movementRemaining: 25 })} />);
    expect(screen.getByRole('button', { name: /25 ft/i })).toBeInTheDocument();
  });
});

// ─── Disabled states ─────────────────────────────────────────────────────────

describe('ActionPanel — disabled states', () => {
  it('Move button is disabled when movementRemaining is 0', () => {
    render(<ActionPanel {...defaultProps({ movementRemaining: 0 })} />);
    expect(screen.getByRole('button', { name: /move/i })).toBeDisabled();
  });

  it('Dodge is disabled when action already used', () => {
    render(<ActionPanel {...defaultProps({ turnState: makeTurnState({ actionUsed: true }) })} />);
    expect(screen.getByRole('button', { name: /dodge/i })).toBeDisabled();
  });

  it('Attack is disabled when all attacks used', () => {
    render(
      <ActionPanel {...defaultProps({ attacksUsedThisTurn: 1, turnState: makeTurnState() })} />
    );
    expect(screen.getByRole('button', { name: /attack/i })).toBeDisabled();
  });
});

// ─── Interactions ────────────────────────────────────────────────────────────

describe('ActionPanel — interactions', () => {
  it('calls onActionSelect("move") when Move is clicked', async () => {
    const user = userEvent.setup();
    const onActionSelect = vi.fn();
    render(<ActionPanel {...defaultProps({ onActionSelect })} />);
    await user.click(screen.getByRole('button', { name: /move/i }));
    expect(onActionSelect).toHaveBeenCalledWith('move');
  });

  it('calls onActionSelect("attack") when Attack is clicked', async () => {
    const user = userEvent.setup();
    const onActionSelect = vi.fn();
    render(<ActionPanel {...defaultProps({ onActionSelect })} />);
    await user.click(screen.getByRole('button', { name: /^attack$/i }));
    expect(onActionSelect).toHaveBeenCalledWith('attack');
  });

  it('calls onDodgeClick when Dodge is clicked', async () => {
    const user = userEvent.setup();
    const onDodgeClick = vi.fn();
    render(<ActionPanel {...defaultProps({ onDodgeClick })} />);
    await user.click(screen.getByRole('button', { name: /dodge/i }));
    expect(onDodgeClick).toHaveBeenCalled();
  });

  it('calls onEndTurn when End Turn is clicked', async () => {
    const user = userEvent.setup();
    const onEndTurn = vi.fn();
    render(<ActionPanel {...defaultProps({ onEndTurn })} />);
    await user.click(screen.getByRole('button', { name: /end turn/i }));
    expect(onEndTurn).toHaveBeenCalled();
  });
});

// ─── Bonus actions ────────────────────────────────────────────────────────────

describe('ActionPanel — bonus actions', () => {
  it('renders bonus action section when bonus actions are available', () => {
    const combatant = makeCombatant({
      character: {
        class: 'barbarian',
        level: 1,
        spells: [],
        getAvailableBonusActions: undefined,
        abilities_list: [{ name: 'Rage', actionType: 'bonusAction', uses: 2, maxUses: 2 }],
      },
    });
    render(<ActionPanel {...defaultProps({ combatant })} />);
    expect(screen.getByText(/bonus actions/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rage/i })).toBeInTheDocument();
  });

  it('does not render bonus section when no bonus actions available', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.queryByText(/bonus actions/i)).not.toBeInTheDocument();
  });
});

// ─── Cast Spell button ────────────────────────────────────────────────────────

describe('ActionPanel — spells', () => {
  it('renders Cast Spell button when character has spells', () => {
    const combatant = makeCombatant({
      character: {
        class: 'wizard',
        level: 1,
        spells: [{ name: 'Magic Missile' }],
        abilities_list: [],
        getAvailableBonusActions: undefined,
      },
    });
    render(<ActionPanel {...defaultProps({ combatant })} />);
    expect(screen.getByRole('button', { name: /cast spell/i })).toBeInTheDocument();
  });

  it('does not render Cast Spell for non-caster with no spells', () => {
    render(<ActionPanel {...defaultProps()} />);
    expect(screen.queryByRole('button', { name: /cast spell/i })).not.toBeInTheDocument();
  });
});
