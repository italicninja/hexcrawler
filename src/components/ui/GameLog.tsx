// @ts-nocheck
import { useEffect, useRef } from 'react';
import { useGameLog } from '../../contexts/GameLogContext';

/**
 * GameLog Component
 * Displays timestamped game messages
 * Now connected to GameLogContext instead of using refs
 */

const ROLL_NUMBER_COLOR = '#f4d03f'; // warm yellow — distinct from log-text but readable on all themes

/**
 * Split a log message into text and highlighted number segments.
 * Numbers that are roll results (after "=", leading total before "damage/vs",
 * or standalone integers that are NOT part of a dice expression like "1d12"
 * or a signed modifier like "+4"/"-1") get the highlight colour.
 *
 * Strategy: tokenise on integers. Mark a token as a roll result when it is
 * NOT immediately preceded or followed by "d" (dice), and NOT preceded by
 * "+" or "-" alone (plain modifiers in dice strings).  Leading total before
 * " slashing/piercing/bludgeoning/fire… damage" is always highlighted.
 */
function renderLogText(text) {
  // Split into alternating [non-number, number, non-number, number …] segments.
  // The regex captures integers; we then decide per-token whether to highlight.
  const parts = text.split(/(\d+)/);

  return parts.map((part, i) => {
    if (!/^\d+$/.test(part)) {
      // Plain text segment — render as-is
      return part;
    }

    const before = parts[i - 1] ?? '';
    const after = parts[i + 1] ?? '';

    const prevChar = before.slice(-1);
    const nextChar = after.charAt(0);

    // Skip: part of a dice expression like "1d12" → digit before 'd' or after 'd'
    if (nextChar === 'd' || prevChar === 'd') return part;

    // Skip: plain signed modifier in a dice string like "+4" or "-1"
    // (preceded only by +/- and the token is small, ≤2 digits — heuristic)
    if ((prevChar === '+' || prevChar === '-') && part.length <= 2) {
      // But DO highlight if this is a result after "=" e.g. "1d12+2=11"
      const prevTwo = before.slice(-2);
      if (prevTwo !== '=+' && prevTwo !== '=-') {
        // Check two chars back: if char before +/- is a digit or ')' it's a modifier
        const charBeforeSign = before.slice(-2, -1);
        if (/[\d)]/.test(charBeforeSign)) return part;
      }
    }

    // Highlight: roll result
    return (
      <span key={i} style={{ color: ROLL_NUMBER_COLOR, fontWeight: '700' }}>
        {part}
      </span>
    );
  });
}

function GameLog() {
  const { messages } = useGameLog();
  const scrollContainerRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    });
  }, [messages]);

  return (
    <div
      id="game-log"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
    >
      <div className="log-header">
        <h3>Game Log</h3>
      </div>
      <div className="log-messages" id="log-messages" ref={scrollContainerRef}>
        {messages.length === 0 ? (
          <div className="log-placeholder">Game events will appear here...</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`log-entry log-${msg.type}`}>
              <span className="log-timestamp">[{msg.timestamp}]</span>
              <span className="log-text">{renderLogText(msg.text)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default GameLog;
