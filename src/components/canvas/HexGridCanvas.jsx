import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useSettings } from '../../contexts/SettingsContext';
import { POIRenderer } from '../../poiRenderer.js';

/**
 * HexGridCanvas component - renders hex grid on canvas
 */

function HexGridCanvas({ hexes, width, height, onHexClick, onHexDoubleClick }) {
  const canvasRef = useRef(null);
  const { state, isHexExplored } = useGameState();
  const { settings } = useSettings();

  const [hexSize] = useState(30);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zoom] = useState(1.0);
  const [selectedHex, setSelectedHex] = useState(null);

  // Animation state
  const animationFrameRef = useRef(null);
  const targetCameraRef = useRef({ x: 0, y: 0 });
  const currentCameraRef = useRef({ x: 0, y: 0 });
  const previousPlayerPosRef = useRef(state.playerPosition);

  // Use ref for player visual position - NEVER null
  const playerVisualPosRef = useRef(null);
  const playerAnimationRef = useRef(null); // Track animation state
  const drawRef = useRef(null); // Reference to draw function

  const poiRenderer = useRef(new POIRenderer());

  // Calculate hex position
  const getHexX = useCallback((col, row) => {
    const xSpacing = hexSize * Math.sqrt(3);
    const xOffset = (row % 2) * (hexSize * Math.sqrt(3) / 2);
    return col * xSpacing + hexSize * 1.5 + xOffset;
  }, [hexSize]);

  const getHexY = useCallback((row) => {
    const ySpacing = hexSize * 1.5;
    return row * ySpacing + hexSize * 1.5;
  }, [hexSize]);

  // Convert hex array to positioned hex objects
  const positionedHexes = useCallback(() => {
    if (!hexes) return [];
    return hexes.map(hex => ({
      ...hex,
      x: getHexX(hex.col, hex.row),
      y: getHexY(hex.row)
    }));
  }, [hexes, getHexX, getHexY]);

  // Draw a single hex
  const drawHex = useCallback((ctx, hex) => {
    const { x, y } = hex;
    const size = hexSize;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const hx = x + size * Math.cos(angle);
      const hy = y + size * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(hx, hy);
      } else {
        ctx.lineTo(hx, hy);
      }
    }
    ctx.closePath();

    // Check if hex has been explored (fog of war)
    const explored = isHexExplored(hex.col, hex.row);

    if (!explored) {
      // Draw fog of war
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }

    // Fill with terrain color
    ctx.fillStyle = hex.terrain.color;
    ctx.fill();

    // Draw border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw POI icon if present
    if (hex.poi) {
      poiRenderer.current.draw(ctx, x, y, hexSize, hex.poi);
    }
  }, [hexSize, isHexExplored]);

  // Draw hex outline (for selection)
  const drawHexOutline = useCallback((ctx, hex, color, width) => {
    const { x, y } = hex;
    const size = hexSize;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const hx = x + size * Math.cos(angle);
      const hy = y + size * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(hx, hy);
      } else {
        ctx.lineTo(hx, hy);
      }
    }
    ctx.closePath();

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }, [hexSize]);

  // Draw player marker
  const drawPlayer = useCallback((ctx, hexes) => {
    const partySize = state.party?.getSize() || 1;
    let playerX, playerY;

    // ALWAYS use the visual position ref
    if (playerVisualPosRef.current) {
      playerX = playerVisualPosRef.current.x;
      playerY = playerVisualPosRef.current.y;
    } else {
      // Initialize visual position on first render
      const { col, row } = state.playerPosition;
      const hex = hexes.find(h => h.col === col && h.row === row);
      if (!hex) return;
      playerX = hex.x;
      playerY = hex.y;
      playerVisualPosRef.current = { x: playerX, y: playerY };
    }

    // Draw player marker (yellow circle)
    ctx.beginPath();
    ctx.arc(playerX, playerY, hexSize * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw party size indicator
    ctx.fillStyle = '#000';
    ctx.font = `bold ${hexSize * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(partySize.toString(), playerX, playerY);
  }, [hexSize, state.playerPosition, state.party]);

  // Center camera on a specific hex
  const centerCameraOnHex = useCallback((col, row, smooth = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const x = getHexX(col, row);
    const y = getHexY(row);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

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
  }, [getHexX, getHexY]);

  // Animation loop for smooth camera AND player movement
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
          y: startPos.y + (endPos.y - startPos.y) * eased
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
  }, []);

  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hexArray = positionedHexes();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    // Draw all hexes
    hexArray.forEach(hex => drawHex(ctx, hex));

    // Draw selected hex outline
    if (selectedHex) {
      const selectedHexData = hexArray.find(h => h.col === selectedHex.col && h.row === selectedHex.row);
      if (selectedHexData) {
        drawHexOutline(ctx, selectedHexData, '#ff6b6b', 3);
      }
    }

    // Draw player marker
    drawPlayer(ctx, hexArray);

    ctx.restore();
  }, [positionedHexes, offsetX, offsetY, zoom, selectedHex, drawHex, drawHexOutline, drawPlayer]);

  // Keep draw ref updated
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth - 48;
      canvas.height = container.clientHeight - 48;
    }
  }, []);

  // Center camera on player initially when hexes are loaded
  useEffect(() => {
    if (!hexes || hexes.length === 0) return;

    // Only center once when map first loads
    const hasInitialized = currentCameraRef.current.x !== 0 || currentCameraRef.current.y !== 0;
    if (hasInitialized) return;

    centerCameraOnHex(state.playerPosition.col, state.playerPosition.row, false);
  }, [hexes, centerCameraOnHex, state.playerPosition.col, state.playerPosition.row]);

  // Redraw when dependencies change (continuous redraw at 60fps via animation loop)
  useEffect(() => {
    // Initial draw
    draw();
  }, [draw, hexes, selectedHex, state.party]);

  // Animate player movement when position changes
  useLayoutEffect(() => {
    if (!hexes || hexes.length === 0) return;

    // Check if position actually changed
    const prevPos = previousPlayerPosRef.current;
    const currentPos = state.playerPosition;

    if (prevPos.col === currentPos.col && prevPos.row === currentPos.row) {
      return; // No movement, don't animate
    }

    // Find old and new hex positions
    const oldHex = hexes.find(h => h.col === prevPos.col && h.row === prevPos.row);
    const newHex = hexes.find(h => h.col === currentPos.col && h.row === currentPos.row);

    if (!newHex) return;

    // Start position is the CURRENT visual position (where player is drawn now)
    const startPos = playerVisualPosRef.current || (oldHex ? { x: oldHex.x, y: oldHex.y } : {
      x: getHexX(prevPos.col, prevPos.row),
      y: getHexY(prevPos.row)
    });

    const endPos = { x: newHex.x, y: newHex.y };

    // Set up animation state
    playerAnimationRef.current = {
      startPos,
      endPos,
      startTime: performance.now(),
      duration: 300
    };

    // Update previous position after setting up animation
    previousPlayerPosRef.current = currentPos;

    // Center camera on new position
    centerCameraOnHex(currentPos.col, currentPos.row, true);
  }, [state.playerPosition, hexes, getHexX, getHexY, centerCameraOnHex]);


  // Get hex at point
  const getHexAtPoint = useCallback((x, y) => {
    const worldX = (x - offsetX) / zoom;
    const worldY = (y - offsetY) / zoom;
    const hexArray = positionedHexes();

    for (const hex of hexArray) {
      const dx = Math.abs(worldX - hex.x);
      const dy = Math.abs(worldY - hex.y);

      if (dx > hexSize * 0.866) continue;
      if (dy > hexSize) continue;

      const check = (hexSize * Math.sqrt(3) / 2 * hexSize -
                     hexSize / 2 * dx -
                     hexSize * Math.sqrt(3) / 2 * dy);

      if (check >= 0) {
        return hex;
      }
    }
    return null;
  }, [hexSize, offsetX, offsetY, zoom, positionedHexes]);

  // Handle click
  const handleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hex = getHexAtPoint(x, y);
    if (hex) {
      setSelectedHex(hex);
      if (onHexClick) {
        onHexClick(hex);
      }
    }
  }, [getHexAtPoint, onHexClick]);

  // Handle double click
  const handleDoubleClick = useCallback((e) => {
    if (!settings.doubleClickMove) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hex = getHexAtPoint(x, y);
    if (hex && onHexDoubleClick) {
      onHexDoubleClick(hex);
    }
  }, [settings.doubleClickMove, getHexAtPoint, onHexDoubleClick]);

  // Handle mouse move for cursor
  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hex = getHexAtPoint(x, y);
    canvasRef.current.style.cursor = hex ? 'pointer' : 'default';
  }, [getHexAtPoint]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        display: 'block',
        cursor: 'pointer'
      }}
    />
  );
}

export default HexGridCanvas;
