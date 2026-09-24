import { useEffect, useRef, useLayoutEffect } from 'react';
import type { HexCoordinates } from '../types/game';

interface VisualPosition {
  x: number;
  y: number;
}

interface PlayerAnimation {
  startPos: VisualPosition;
  endPos: VisualPosition;
  startTime: number;
  duration: number;
}

interface UseCanvasAnimationParams {
  drawCallback: () => void;
  getHexX: (col: number, row: number) => number;
  getHexY: (row: number) => number;
  setOffsetX: (x: number) => void;
  setOffsetY: (y: number) => void;
  playerPosition: HexCoordinates;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hexes: any[];
}

interface UseCanvasAnimationReturn {
  playerVisualPosRef: React.MutableRefObject<VisualPosition | null>;
  centerCameraOnHex: (
    col: number,
    row: number,
    canvasWidth: number,
    canvasHeight: number,
    smooth?: boolean
  ) => void;
  currentCameraRef: React.MutableRefObject<VisualPosition>;
  /** Force a redraw on the next frame (e.g. after a canvas resize clears it). */
  invalidate: () => void;
}

/**
 * useCanvasAnimation Hook
 *
 * Handles canvas animation loop including:
 * - Smooth camera movement with lerp
 * - Player movement animation with easing
 * - rAF loop that only redraws when something changed (render, camera ease,
 *   player animation, or invalidate())
 */
export function useCanvasAnimation({
  drawCallback,
  getHexX,
  getHexY,
  setOffsetX,
  setOffsetY,
  playerPosition,
  hexes,
}: UseCanvasAnimationParams): UseCanvasAnimationReturn {
  const animationFrameRef = useRef<number | null>(null);
  const targetCameraRef = useRef<VisualPosition>({ x: 0, y: 0 });
  const currentCameraRef = useRef<VisualPosition>({ x: 0, y: 0 });
  const previousPlayerPosRef = useRef<HexCoordinates>(playerPosition);

  const playerVisualPosRef = useRef<VisualPosition | null>(null);
  const playerAnimationRef = useRef<PlayerAnimation | null>(null);
  const drawRef = useRef<() => void>(drawCallback);
  const dirtyRef = useRef(true);

  // A new drawCallback means the component re-rendered with new data.
  useEffect(() => {
    drawRef.current = drawCallback;
    dirtyRef.current = true;
  }, [drawCallback]);

  const centerCameraOnHex = (
    col: number,
    row: number,
    canvasWidth: number,
    canvasHeight: number,
    smooth = true
  ) => {
    const x = getHexX(col, row);
    const y = getHexY(row);

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const targetX = centerX - x;
    const targetY = centerY - y;

    if (smooth) {
      targetCameraRef.current = { x: targetX, y: targetY };
    } else {
      currentCameraRef.current = { x: targetX, y: targetY };
      targetCameraRef.current = { x: targetX, y: targetY };
      setOffsetX(targetX);
      setOffsetY(targetY);
    }
  };

  useEffect(() => {
    let running = true;

    const animate = () => {
      if (!running) return;

      let changed = dirtyRef.current;

      if (playerAnimationRef.current) {
        changed = true;
        const { startPos, endPos, startTime, duration } = playerAnimationRef.current;
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const eased = 1 - Math.pow(1 - progress, 3);

        playerVisualPosRef.current = {
          x: startPos.x + (endPos.x - startPos.x) * eased,
          y: startPos.y + (endPos.y - startPos.y) * eased,
        };

        if (progress >= 1) {
          playerVisualPosRef.current = endPos;
          playerAnimationRef.current = null;
        }
      }

      const lerpSpeed = 0.1;
      const dx = targetCameraRef.current.x - currentCameraRef.current.x;
      const dy = targetCameraRef.current.y - currentCameraRef.current.y;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        currentCameraRef.current.x += dx * lerpSpeed;
        currentCameraRef.current.y += dy * lerpSpeed;
        setOffsetX(currentCameraRef.current.x);
        setOffsetY(currentCameraRef.current.y);
        changed = true;
      } else if (dx !== 0 || dy !== 0) {
        currentCameraRef.current = { ...targetCameraRef.current };
        setOffsetX(targetCameraRef.current.x);
        setOffsetY(targetCameraRef.current.y);
        changed = true;
      }

      // Idle frames cost nothing: skip the full-map repaint when nothing moved.
      if (changed) {
        dirtyRef.current = false;
        drawRef.current();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [setOffsetX, setOffsetY]);

  useLayoutEffect(() => {
    if (!hexes || hexes.length === 0) return;

    const prevPos = previousPlayerPosRef.current;
    const currentPos = playerPosition;

    if (prevPos.col === currentPos.col && prevPos.row === currentPos.row) {
      return;
    }

    const endPos: VisualPosition = {
      x: getHexX(currentPos.col, currentPos.row),
      y: getHexY(currentPos.row),
    };

    const startPos: VisualPosition = playerVisualPosRef.current ?? {
      x: getHexX(prevPos.col, prevPos.row),
      y: getHexY(prevPos.row),
    };

    playerAnimationRef.current = {
      startPos,
      endPos,
      startTime: performance.now(),
      duration: 300,
    };

    previousPlayerPosRef.current = currentPos;
  }, [playerPosition, hexes, getHexX, getHexY]);

  return {
    playerVisualPosRef,
    centerCameraOnHex,
    currentCameraRef,
    invalidate: () => {
      dirtyRef.current = true;
    },
  };
}
