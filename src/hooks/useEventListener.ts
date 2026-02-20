import { useEffect, useRef } from 'react';

type EventHandler<E extends Event = Event> = (event: E) => void;

/**
 * Custom hook for adding event listeners with automatic cleanup.
 * @param eventName - Name of the event (e.g., 'keydown', 'resize')
 * @param handler - Event handler function
 * @param element - Element to attach listener to (default: window)
 */
export function useEventListener<E extends Event = Event>(
  eventName: string,
  handler: EventHandler<E>,
  element: EventTarget = window
): void {
  const savedHandler = useRef<EventHandler<E>>(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!element?.addEventListener) return;

    const eventListener = (event: Event) => savedHandler.current(event as E);

    element.addEventListener(eventName, eventListener);

    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}
