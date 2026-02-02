import { useEffect, useRef } from 'react';

/**
 * Custom hook for adding event listeners with automatic cleanup
 * @param {string} eventName - Name of the event (e.g., 'keydown', 'resize')
 * @param {Function} handler - Event handler function
 * @param {Element} element - Element to attach listener to (default: window)
 */
export function useEventListener(eventName, handler, element = window) {
  const savedHandler = useRef();

  // Update ref.current value if handler changes
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    // Make sure element supports addEventListener
    const isSupported = element && element.addEventListener;
    if (!isSupported) return;

    // Create event listener that calls handler function stored in ref
    const eventListener = event => savedHandler.current(event);

    // Add event listener
    element.addEventListener(eventName, eventListener);

    // Remove event listener on cleanup
    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}
