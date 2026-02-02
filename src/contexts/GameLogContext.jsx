import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

const GameLogContext = createContext(null);

const MAX_MESSAGES = 100; // Limit to prevent memory leaks

/**
 * GameLog Context Provider
 * Manages game log messages globally
 */
export function GameLogProvider({ children }) {
  const [messages, setMessages] = useState([]);

  /**
   * Add a message to the game log
   * @param {string} text - Message text
   * @param {string} type - Message type: 'info', 'warning', 'error', 'success', 'action', 'discovery', 'encounter', 'system', 'poi-interaction'
   */
  const addMessage = useCallback((text, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages(prev => {
      const newMessages = [...prev, { text, type, timestamp, id: Date.now() + Math.random() }];
      // Keep only the last MAX_MESSAGES messages
      if (newMessages.length > MAX_MESSAGES) {
        return newMessages.slice(-MAX_MESSAGES);
      }
      return newMessages;
    });
  }, []);

  /**
   * Clear all messages from the log
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      messages,
      addMessage,
      clearMessages,
    }),
    [messages, addMessage, clearMessages]
  );

  return <GameLogContext.Provider value={value}>{children}</GameLogContext.Provider>;
}

GameLogProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to use GameLog
 */
export function useGameLog() {
  const context = useContext(GameLogContext);
  if (!context) {
    throw new Error('useGameLog must be used within GameLogProvider');
  }
  return context;
}
