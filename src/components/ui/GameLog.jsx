import { useGameLog } from '../../contexts/GameLogContext';

/**
 * GameLog Component
 * Displays timestamped game messages
 * Now connected to GameLogContext instead of using refs
 */
function GameLog() {
  const { messages, messagesEndRef } = useGameLog();

  return (
    <div id="game-log" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div className="log-header">
        <h3>Game Log</h3>
      </div>
      <div className="log-messages" id="log-messages">
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
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default GameLog;
