import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';

const MAX_MESSAGES = 100; // Limit to prevent memory leaks

const GameLog = forwardRef((props, ref) => {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  const addMessage = (text, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages(prev => {
      const newMessages = [...prev, { text, type, timestamp, id: Date.now() + Math.random() }];
      // Keep only the last MAX_MESSAGES messages
      if (newMessages.length > MAX_MESSAGES) {
        return newMessages.slice(-MAX_MESSAGES);
      }
      return newMessages;
    });
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

GameLog.propTypes = {
  // This component doesn't receive any props, only uses forwardRef for imperative handle
};

export default GameLog;
