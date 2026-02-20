import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { LogMessageType } from '../types/game';

// Re-export for consumers that import from this module
export type { LogMessageType as MessageType };

export interface GameLogMessage {
  id: number;
  text: string;
  type: LogMessageType;
  timestamp: string;
}

interface GameLogContextValue {
  messages: GameLogMessage[];
  addMessage: (text: string, type?: LogMessageType) => void;
  clearMessages: () => void;
}

const GameLogContext = createContext<GameLogContextValue | null>(null);

const MAX_MESSAGES = 100; // Limit to prevent memory leaks

/**
 * GameLog Context Provider
 * Manages game log messages globally
 */
export function GameLogProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<GameLogMessage[]>([]);

  /**
   * Add a message to the game log
   * @param text - Message text
   * @param type - Message type
   */
  const addMessage = useCallback((text: string, type: LogMessageType = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages(prev => {
      const newMessages: GameLogMessage[] = [
        ...prev,
        { text, type, timestamp, id: Date.now() + Math.random() },
      ];
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
  const value = useMemo<GameLogContextValue>(
    () => ({
      messages,
      addMessage,
      clearMessages,
    }),
    [messages, addMessage, clearMessages]
  );

  return <GameLogContext.Provider value={value}>{children}</GameLogContext.Provider>;
}

/**
 * Hook to use GameLog
 */
export function useGameLog(): GameLogContextValue {
  const context = useContext(GameLogContext);
  if (!context) {
    throw new Error('useGameLog must be used within GameLogProvider');
  }
  return context;
}
