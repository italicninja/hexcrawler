import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const GameLog = forwardRef((props, ref) => {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  const addMessage = (text, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages(prev => [...prev, { text, type, timestamp, id: Date.now() + Math.random() }]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Expose addMessage method to parent via ref
  useImperativeHandle(ref, () => ({
    addMessage
  }));

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
});

GameLog.displayName = 'GameLog';

export default GameLog;
