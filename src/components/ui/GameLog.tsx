// @ts-nocheck
import { useEffect, useRef } from 'react';
import { useGameLog } from '../../contexts/GameLogContext';

/**
 * GameLog Component
 * Displays timestamped game messages
 * Now connected to GameLogContext instead of using refs
 */
function GameLog() {
  const { messages } = useGameLog();
  const scrollContainerRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
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
              <span className="log-text">{msg.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default GameLog;
