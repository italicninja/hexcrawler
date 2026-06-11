// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CombatantCard from '../../../../src/components/ui/combat/CombatantCard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCombatant(overrides = {}) {
  return {
    name: 'Thalindra',
    currentHP: 30,
    maxHP: 40,
    armorClass: 16,
    initiative: 15,
    isAlly: true,
    statusEffects: [],
    class: 'Ranger',
    ...overrides,
  };
}

// ─── Null guard ───────────────────────────────────────────────────────────────

describe('CombatantCard — null guard', () => {
  it('renders nothing when combatant is null', () => {
    const { container } = render(<CombatantCard combatant={null} isActive={false} />);
    expect(container.firstChild).toBeNull();
  });
});

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('CombatantCard — rendering', () => {
  it('renders the combatant name', () => {
    render(<CombatantCard combatant={makeCombatant()} isActive={false} />);
    expect(screen.getByText('Thalindra')).toBeInTheDocument();
  });

  it('renders the class name when provided', () => {
    render(<CombatantCard combatant={makeCombatant({ class: 'Ranger' })} isActive={false} />);
    expect(screen.getByText('Ranger')).toBeInTheDocument();
  });

  it('renders HP values (current / max)', () => {
    render(<CombatantCard combatant={makeCombatant()} isActive={false} />);
    expect(screen.getByText('30/40')).toBeInTheDocument();
  });

  it('renders AC value', () => {
    render(<CombatantCard combatant={makeCombatant()} isActive={false} />);
    expect(screen.getByText('16')).toBeInTheDocument();
  });

  it('renders initiative value', () => {
    render(<CombatantCard combatant={makeCombatant()} isActive={false} />);
    expect(screen.getByText(/init:\s*15/i)).toBeInTheDocument();
  });

  it('defaults AC to 10 when armorClass and ac are both absent', () => {
    const c = makeCombatant({ armorClass: undefined, ac: undefined });
    render(<CombatantCard combatant={c} isActive={false} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});

// ─── HP bar colour thresholds ─────────────────────────────────────────────────

describe('CombatantCard — HP bar colour', () => {
  it('HP bar has green class when HP > 50%', () => {
    const { container } = render(
      <CombatantCard combatant={makeCombatant({ currentHP: 30, maxHP: 40 })} isActive={false} />
    );
    const bar = container.querySelector('.bg-green-500');
    expect(bar).not.toBeNull();
  });

  it('HP bar has yellow class when HP is 25–50%', () => {
    const { container } = render(
      <CombatantCard combatant={makeCombatant({ currentHP: 15, maxHP: 40 })} isActive={false} />
    );
    const bar = container.querySelector('.bg-yellow-500');
    expect(bar).not.toBeNull();
  });

  it('HP bar has red class when HP < 25%', () => {
    const { container } = render(
      <CombatantCard combatant={makeCombatant({ currentHP: 5, maxHP: 40 })} isActive={false} />
    );
    const bar = container.querySelector('.bg-red-500');
    expect(bar).not.toBeNull();
  });

  it('HP bar width is 0% when HP is 0', () => {
    const { container } = render(
      <CombatantCard combatant={makeCombatant({ currentHP: 0, maxHP: 40 })} isActive={false} />
    );
    const bar = container.querySelector('[style*="width: 0%"]');
    expect(bar).not.toBeNull();
  });
});

// ─── Active / inactive styling ────────────────────────────────────────────────

describe('CombatantCard — active state', () => {
  it('applies active border class when isActive is true (ally)', () => {
    const { container } = render(
      <CombatantCard combatant={makeCombatant({ isAlly: true })} isActive={true} />
    );
    // Active ally → border-yellow-400
    expect(container.firstChild?.className).toMatch(/border-yellow-400/);
  });

  it('applies inactive border class when isActive is false (ally)', () => {
    const { container } = render(
      <CombatantCard combatant={makeCombatant({ isAlly: true })} isActive={false} />
    );
    expect(container.firstChild?.className).toMatch(/border-yellow-500/);
  });

  it('uses red border colours for enemies', () => {
    const { container } = render(
      <CombatantCard combatant={makeCombatant({ isAlly: false })} isActive={false} />
    );
    expect(container.firstChild?.className).toMatch(/border-red-500/);
  });
});

// ─── Status effects ───────────────────────────────────────────────────────────

describe('CombatantCard — status effects', () => {
  it('renders a status effect badge', () => {
    const combatant = makeCombatant({
      statusEffects: [{ name: 'Blinded' }],
    });
    render(<CombatantCard combatant={combatant} isActive={false} />);
    expect(screen.getByText('Blinded')).toBeInTheDocument();
  });

  it('renders Rage badge with correct label', () => {
    const combatant = makeCombatant({
      statusEffects: [{ name: 'Rage' }],
    });
    render(<CombatantCard combatant={combatant} isActive={false} />);
    expect(screen.getByText('Rage')).toBeInTheDocument();
  });

  it('renders Dodge badge', () => {
    const combatant = makeCombatant({
      statusEffects: [{ name: 'Dodge' }],
    });
    render(<CombatantCard combatant={combatant} isActive={false} />);
    expect(screen.getByText('Dodge')).toBeInTheDocument();
  });

  it('renders no status section when statusEffects is empty', () => {
    render(<CombatantCard combatant={makeCombatant()} isActive={false} />);
    expect(screen.queryByText('Blinded')).not.toBeInTheDocument();
  });
});
