import { useEffect, useRef, useLayoutEffect } from 'react';

/**
 * useCanvasAnimation Hook
 *
 * Handles canvas animation loop including:
 * - Smooth camera movement with lerp
 * - Player movement animation with easing
 * - Continuous 60fps rendering loop
 *
 * @param {Object} params - Configuration object
 * @param {Function} params.drawCallback - Function to call on each frame to render
 * @param {Function} params.getHexX - Function to get hex X position
 * @param {Function} params.getHexY - Function to get hex Y position
 * @param {Function} params.setOffsetX - State setter for camera X offset
 * @param {Function} params.setOffsetY - State setter for camera Y offset
 * @param {Object} params.playerPosition - Current player position {col, row}
 * @param {Array} params.hexes - Array of hex objects
 * @returns {Object} - { playerVisualPosRef, centerCameraOnHex }
 */
export function useCanvasAnimation({
  drawCallback,
  getHexX,
  getHexY,
  setOffsetX,
  setOffsetY,
  playerPosition,
  hexes,
}) {
  // Animation state
  const animationFrameRef = useRef(null);
  const targetCameraRef = useRef({ x: 0, y: 0 });
  const currentCameraRef = useRef({ x: 0, y: 0 });
  const previousPlayerPosRef = useRef(playerPosition);

  // Player animation state
  const playerVisualPosRef = useRef(null);
  const playerAnimationRef = useRef(null);
  const drawRef = useRef(drawCallback);

  // Update draw ref when callback changes
  useEffect(() => {
    drawRef.current = drawCallback;
  }, [drawCallback]);

  /**
   * Center camera on a specific hex with optional smooth animation
   */
  const centerCameraOnHex = (col, row, canvasWidth, canvasHeight, smooth = true) => {
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

  /**
   * Main animation loop - handles camera lerp and player movement
   */
  useEffect(() => {
    let running = true;

    const animate = () => {
      if (!running) return;

      // Update player animation
      if (playerAnimationRef.current) {
        const { startPos, endPos, startTime, duration } = playerAnimationRef.current;
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic)
        const eased = 1 - Math.pow(1 - progress, 3);

        playerVisualPosRef.current = {
          x: startPos.x + (endPos.x - startPos.x) * eased,
          y: startPos.y + (endPos.y - startPos.y) * eased,
        };

        // Animation complete
        if (progress >= 1) {
          playerVisualPosRef.current = endPos;
          playerAnimationRef.current = null;
        }
      }

      // Smooth camera lerp
      const lerpSpeed = 0.1;
      const dx = targetCameraRef.current.x - currentCameraRef.current.x;
      const dy = targetCameraRef.current.y - currentCameraRef.current.y;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        currentCameraRef.current.x += dx * lerpSpeed;
        currentCameraRef.current.y += dy * lerpSpeed;
        setOffsetX(currentCameraRef.current.x);
        setOffsetY(currentCameraRef.current.y);
      } else {
        currentCameraRef.current = { ...targetCameraRef.current };
        setOffsetX(targetCameraRef.current.x);
        setOffsetY(targetCameraRef.current.y);
      }

      // Call draw function via ref (always get latest version)
      if (drawRef.current) {
        drawRef.current();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [setOffsetX, setOffsetY]);

  /**
   * Animate player movement when position changes
   */
  useLayoutEffect(() => {
    if (!hexes || hexes.length === 0) return;

    // Check if position actually changed
    const prevPos = previousPlayerPosRef.current;
    const currentPos = playerPosition;

    if (prevPos.col === currentPos.col && prevPos.row === currentPos.row) {
      return; // No movement, don't animate
    }

    // Calculate end position
    const endPos = {
      x: getHexX(currentPos.col, currentPos.row),
      y: getHexY(currentPos.row),
    };

    // Start position is the CURRENT visual position (where player is drawn now)
    const startPos = playerVisualPosRef.current || {
      x: getHexX(prevPos.col, prevPos.row),
      y: getHexY(prevPos.row),
    };

    // Set up animation state
    playerAnimationRef.current = {
      startPos,
      endPos,
      startTime: performance.now(),
      duration: 300,
    };

    // Update previous position after setting up animation
    previousPlayerPosRef.current = currentPos;
  }, [playerPosition, hexes, getHexX, getHexY]);

  return {
    playerVisualPosRef,
    centerCameraOnHex,
    currentCameraRef,
  };
}
