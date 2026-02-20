import { useEffect, useRef } from 'react';

/**
 * Custom hook for game loop with requestAnimationFrame.
 * @param callback - Function to call on each frame with deltaTime (seconds)
 * @param isActive - Whether the loop should be running
 */
export function useGameLoop(callback: (deltaTime: number) => void, isActive = true): void {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const callbackRef = useRef<(deltaTime: number) => void>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;

    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const deltaTime = (time - previousTimeRef.current) / 1000;
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive]);
}
