import { useEffect, useRef } from 'react';

/**
 * Custom hook for game loop with requestAnimationFrame
 * @param {Function} callback - Function to call on each frame with deltaTime
 * @param {boolean} isActive - Whether the loop should be running
 */
export function useGameLoop(callback, isActive = true) {
  const requestRef = useRef();
  const previousTimeRef = useRef();
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;

    const animate = time => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = (time - previousTimeRef.current) / 1000; // Convert to seconds
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive]);
}
