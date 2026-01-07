import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Create context
const EventInfoBoxContext = createContext(null);

const MAX_QUEUE_SIZE = 50; // Limit to prevent memory leaks

/**
 * EventInfoBox Context Provider
 * Manages the event info box state and message queue
 */
export function EventInfoBoxProvider({ children }) {
  const [currentEvent, setCurrentEvent] = useState(null);
  const [messageQueue, setMessageQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Show a simple informational message
   * @param {string} title - Message title
   * @param {string} message - Message content
   * @param {string} type - 'info' | 'active' | 'passive'
   * @param {boolean} dismissible - Can be dismissed
   * @param {number} autoDismissDelay - Auto-dismiss after N ms (0 = no auto-dismiss)
   */
  const showMessage = useCallback((title, message, type = 'info', dismissible = true, autoDismissDelay = 0) => {
    const messageObj = {
      id: Date.now() + Math.random(),
      type: 'message',
      displayType: type,
      title,
      message,
      dismissible,
      autoDismissDelay
    };

    setMessageQueue(prev => {
      const newQueue = [...prev, messageObj];
      // Enforce queue size limit, drop oldest messages if exceeded
      if (newQueue.length > MAX_QUEUE_SIZE) {
        return newQueue.slice(-MAX_QUEUE_SIZE);
      }
      return newQueue;
    });
  }, []);

  /**
   * Show an event with choices
   * @param {object} poi - POI object
   * @param {string} eventType - 'active' | 'passive'
   * @param {array} choices - Array of choice objects { label, action, style }
   * @param {function} onChoice - Callback when choice is made
   */
  const showEvent = useCallback((poi, eventType, choices, onChoice) => {
    const eventObj = {
      id: Date.now() + Math.random(),
      type: 'event',
      displayType: eventType,
      poi,
      choices,
      onChoice,
      dismissible: eventType === 'passive'
    };

    setMessageQueue(prev => {
      const newQueue = [...prev, eventObj];
      // Enforce queue size limit, drop oldest messages if exceeded
      if (newQueue.length > MAX_QUEUE_SIZE) {
        return newQueue.slice(-MAX_QUEUE_SIZE);
      }
      return newQueue;
    });
  }, []);

  /**
   * Dismiss the current event/message
   */
  const dismissEvent = useCallback(() => {
    if (currentEvent && currentEvent.dismissible) {
      setCurrentEvent(null);
      setIsProcessing(false);
    }
  }, [currentEvent]);

  /**
   * Handle choice selection
   * @param {string} action - Choice action string
   */
  const handleChoice = useCallback((action) => {
    if (currentEvent && currentEvent.onChoice) {
      currentEvent.onChoice(action);
    }
    setCurrentEvent(null);
    setIsProcessing(false);
  }, [currentEvent]);

  // Process message queue
  useEffect(() => {
    if (!currentEvent && messageQueue.length > 0 && !isProcessing) {
      setIsProcessing(true);
      const nextMessage = messageQueue[0];
      setMessageQueue(prev => prev.slice(1));
      setCurrentEvent(nextMessage);

      // Auto-dismiss for info messages
      if (nextMessage.type === 'message' && nextMessage.autoDismissDelay > 0) {
        setTimeout(() => {
          setCurrentEvent(prev => {
            if (prev && prev.id === nextMessage.id) {
              setIsProcessing(false);
              return null;
            }
            return prev;
          });
        }, nextMessage.autoDismissDelay);
      } else {
        setIsProcessing(false);
      }
    }
  }, [currentEvent, messageQueue, isProcessing]);

  const value = {
    currentEvent,
    showMessage,
    showEvent,
    dismissEvent,
    handleChoice,
    hasActiveEvent: currentEvent !== null,
    isBlockingMovement: currentEvent !== null && currentEvent.displayType === 'active' && !currentEvent.dismissible
  };

  return (
    <EventInfoBoxContext.Provider value={value}>
      {children}
    </EventInfoBoxContext.Provider>
  );
}

/**
 * Hook to use EventInfoBox
 */
export function useEventInfoBox() {
  const context = useContext(EventInfoBoxContext);
  if (!context) {
    throw new Error('useEventInfoBox must be used within EventInfoBoxProvider');
  }
  return context;
}
