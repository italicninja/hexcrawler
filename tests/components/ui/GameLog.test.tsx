// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ─── Mock GameLogContext ─────────────────────────────────────────────────────
// GameLog depends on useGameLog(). We mock the context module to control messages.

let mockMessages: Array<{ id: string; timestamp: string; text: string; type: string }> = [];

vi.mock('../../../src/contexts/GameLogContext', () => ({
  useGameLog: () => ({ messages: mockMessages }),
}));

import GameLog from '../../../src/components/ui/GameLog';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMessage(id: string, text: string, type = 'info') {
  return { id, timestamp: '10:00', text, type };
}

// ─── Empty state ─────────────────────────────────────────────────────────────

describe('GameLog — empty state', () => {
  it('shows placeholder when no messages', () => {
    mockMessages = [];
    render(<GameLog />);
    expect(screen.getByText(/game events will appear here/i)).toBeInTheDocument();
  });

  it('renders the Game Log header', () => {
    mockMessages = [];
    render(<GameLog />);
    expect(screen.getByText(/game log/i)).toBeInTheDocument();
  });
});

// ─── Message rendering ────────────────────────────────────────────────────────

describe('GameLog — message rendering', () => {
  it('renders a single message text', () => {
    mockMessages = [makeMessage('1', 'You rolled a 15.')];
    render(<GameLog />);
    expect(screen.getByText(/you rolled a/i)).toBeInTheDocument();
  });

  it('renders a message timestamp', () => {
    mockMessages = [makeMessage('1', 'Attack hits!', 'success')];
    render(<GameLog />);
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  it('renders multiple messages', () => {
    mockMessages = [
      makeMessage('1', 'First message'),
      makeMessage('2', 'Second message'),
      makeMessage('3', 'Third message'),
    ];
    render(<GameLog />);
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.getByText('Third message')).toBeInTheDocument();
  });

  it('hides the placeholder when messages are present', () => {
    mockMessages = [makeMessage('1', 'Something happened')];
    render(<GameLog />);
    expect(screen.queryByText(/game events will appear here/i)).not.toBeInTheDocument();
  });
});

// ─── renderLogText — number highlighting ─────────────────────────────────────
// We test the public output (rendered DOM) of the number-highlighting logic.

describe('GameLog — roll number highlighting', () => {
  it('highlights a standalone roll result number', () => {
    mockMessages = [makeMessage('1', 'You rolled 20!')];
    const { container } = render(<GameLog />);
    // The number "20" should be in a <span> with the roll color
    const spans = container.querySelectorAll('span[style*="color"]');
    const hasHighlighted = Array.from(spans).some(s => s.textContent === '20');
    expect(hasHighlighted).toBe(true);
  });

  it('does not highlight the dice count in "2d6"', () => {
    mockMessages = [makeMessage('1', 'Roll 2d6 damage.')];
    const { container } = render(<GameLog />);
    // "2" before "d" should not be highlighted
    const rollSpans = container.querySelectorAll('span[style*="color: rgb"]');
    const twoHighlighted = Array.from(rollSpans).some(s => s.textContent === '2');
    expect(twoHighlighted).toBe(false);
  });
});

// ─── Message type CSS classes ─────────────────────────────────────────────────

describe('GameLog — message type styling', () => {
  it.each([['info'], ['success'], ['warning'], ['error']])(
    'applies log-%s class to %s messages',
    type => {
      mockMessages = [makeMessage('1', `A ${type} message`, type)];
      const { container } = render(<GameLog />);
      expect(container.querySelector(`.log-${type}`)).not.toBeNull();
    }
  );
});
