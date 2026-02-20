// @ts-nocheck
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useCanvasAnimation } from '../../hooks/useCanvasAnimation';
import { POIRenderer } from '../../poiRenderer';
import { HexTextureGenerator } from '../../utils/hexTextureGenerator';
import {
  calculateHexPosition,
  drawHexShape,
  drawHexOutline as renderHexOutline,
  findHexAtPoint,
} from '../../utils/hexRenderer';
import { PerlinNoise } from '../../noise';

/**
 * HexGridCanvas component - renders hex grid on canvas
 */

function HexGridCanvas({ hexes, width, height, onHexClick, onHexDoubleClick }) {
  const canvasRef = useRef(null);
  const { state, isHexExplored, shouldShowPOI, isPoiDiscovered } = useGameState();
  const { settings } = useSettings();

  const [hexSize] = useState(30);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zoom] = useState(1.0);
  const [selectedHex, setSelectedHex] = useState(null);

  const poiRenderer = useRef(new POIRenderer());
  const textureGenerator = useRef(null);

  // Initialize texture generator once
  useEffect(() => {
    if (!textureGenerator.current) {
      const noise = new PerlinNoise(state.mapSeed || Date.now());
      textureGenerator.current = new HexTextureGenerator(noise);
    }
  }, [state.mapSeed]);

  // Calculate hex position (using utility function)
  const getHexX = useCallback(
    (col, row) => {
      return calculateHexPosition(col, row, hexSize).x;
    },
    [hexSize]
  );

  const getHexY = useCallback(
    row => {
      return calculateHexPosition(0, row, hexSize).y;
    },
    [hexSize]
  );

  // Convert hex array to positioned hex objects (memoized for performance)
  const positionedHexes = useMemo(() => {
    if (!hexes) return [];
    return hexes.map(hex => {
      const { x, y } = calculateHexPosition(hex.col, hex.row, hexSize);
      return { ...hex, x, y };
    });
  }, [hexes, hexSize]);

  // Draw a single hex
  const drawHex = useCallback(
    (ctx, hex) => {
      const { x, y } = hex;

      // Check if hex has been explored (fog of war)
      const explored = isHexExplored(hex.col, hex.row);

      if (!explored) {
        // Draw fog of war
        drawHexShape(ctx, x, y, hexSize, '#1a1a1a', '#333', 1);
        return;
      }

      // Draw explored hex with textured pattern (pass col/row for per-hex variation)
      if (textureGenerator.current) {
        const pattern = textureGenerator.current.getPattern(
          ctx,
          hex.terrain,
          hexSize,
          hex.col,
          hex.row
        );
        drawHexShape(ctx, x, y, hexSize, pattern, '#333', 1);
      } else {
        // Fallback to solid color if texture generator not ready
        drawHexShape(ctx, x, y, hexSize, hex.terrain.color, '#333', 1);
      }

      // Draw POI icon if present AND visible (towns always, others only if discovered)
      if (hex.poi && shouldShowPOI(hex.poi, hex.col, hex.row)) {
        // Save context before drawing POI
        ctx.save();

        poiRenderer.current.draw(ctx, x, y, hexSize, hex.poi);

        ctx.restore();

        // Draw discovered marker for discovered POIs (not towns, they're always visible)
        if (isPoiDiscovered(hex.col, hex.row) && !hex.poi.visibleWithoutDiscovery) {
          ctx.save();

          // Draw a small star marker in the top-right corner of the hex
          const starX = x + hexSize * 0.6;
          const starY = y - hexSize * 0.6;
          const starSize = hexSize * 0.15;

          // Draw a 5-pointed star
          ctx.fillStyle = '#FFD700'; // Gold color
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;

          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const outerRadius = starSize;
            const innerRadius = starSize * 0.4;

            // Outer point
            const outerX = starX + Math.cos(angle) * outerRadius;
            const outerY = starY + Math.sin(angle) * outerRadius;

            if (i === 0) {
              ctx.moveTo(outerX, outerY);
            } else {
              ctx.lineTo(outerX, outerY);
            }

            // Inner point
            const innerAngle = angle + Math.PI / 5;
            const innerX = starX + Math.cos(innerAngle) * innerRadius;
            const innerY = starY + Math.sin(innerAngle) * innerRadius;
            ctx.lineTo(innerX, innerY);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.restore();
        }
      }
    },
    [hexSize, isHexExplored, shouldShowPOI, isPoiDiscovered]
  );

  // Draw hex outline (for selection) - wrapper around utility function
  const drawHexOutline = useCallback(
    (ctx, hex, color, width) => {
      renderHexOutline(ctx, hex.x, hex.y, hexSize, color, width);
    },
    [hexSize]
  );

  // Draw player marker (now receives playerVisualPosRef from animation hook)
  const drawPlayerMarker = useCallback(
    (ctx, hexes, playerVisualPosRef) => {
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
    },
    [hexSize, state.playerPosition, state.party]
  );

  // Main draw function (will be called by animation hook)
  const draw = useCallback(
    playerVisualPosRef => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply transformations
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(zoom, zoom);

      // Draw all hexes
      positionedHexes.forEach(hex => drawHex(ctx, hex));

      // Draw selected hex outline
      if (selectedHex) {
        const selectedHexData = positionedHexes.find(
          h => h.col === selectedHex.col && h.row === selectedHex.row
        );
        if (selectedHexData) {
          drawHexOutline(ctx, selectedHexData, '#ff6b6b', 3);
        }
      }

      // Draw player marker
      drawPlayerMarker(ctx, positionedHexes, playerVisualPosRef);

      ctx.restore();
    },
    [
      positionedHexes,
      offsetX,
      offsetY,
      zoom,
      selectedHex,
      drawHex,
      drawHexOutline,
      drawPlayerMarker,
    ]
  );

  // Use animation hook for smooth camera and player movement
  const { playerVisualPosRef, centerCameraOnHex, currentCameraRef } = useCanvasAnimation({
    drawCallback: () => draw(playerVisualPosRef),
    getHexX,
    getHexY,
    setOffsetX,
    setOffsetY,
    playerPosition: state.playerPosition,
    hexes,
  });

  // Setup canvas and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth - 48;
        canvas.height = container.clientHeight - 48;
      }
    };

    // Initial size
    resizeCanvas();

    // Add resize listener
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Center camera on player initially when hexes are loaded
  useEffect(() => {
    if (!hexes || hexes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Only center once when map first loads
    const hasInitialized = currentCameraRef.current.x !== 0 || currentCameraRef.current.y !== 0;
    if (hasInitialized) return;

    centerCameraOnHex(
      state.playerPosition.col,
      state.playerPosition.row,
      canvas.width,
      canvas.height,
      false
    );
  }, [
    hexes,
    centerCameraOnHex,
    state.playerPosition.col,
    state.playerPosition.row,
    currentCameraRef,
  ]);

  // Center camera when player moves
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hexes || hexes.length === 0) return;

    centerCameraOnHex(
      state.playerPosition.col,
      state.playerPosition.row,
      canvas.width,
      canvas.height,
      true
    );
  }, [state.playerPosition, hexes, centerCameraOnHex]);

  // Get hex at point (using utility function)
  const getHexAtPoint = useCallback(
    (x, y) => {
      const worldX = (x - offsetX) / zoom;
      const worldY = (y - offsetY) / zoom;

      return findHexAtPoint(worldX, worldY, positionedHexes, hexSize);
    },
    [hexSize, offsetX, offsetY, zoom, positionedHexes]
  );

  // Handle click
  const handleClick = useCallback(
    e => {
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
    },
    [getHexAtPoint, onHexClick]
  );

  // Handle double click
  const handleDoubleClick = useCallback(
    e => {
      if (!settings.doubleClickMove) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hex = getHexAtPoint(x, y);
      if (hex && onHexDoubleClick) {
        onHexDoubleClick(hex);
      }
    },
    [settings.doubleClickMove, getHexAtPoint, onHexDoubleClick]
  );

  // Handle mouse move for cursor
  const handleMouseMove = useCallback(
    e => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hex = getHexAtPoint(x, y);
      canvasRef.current.style.cursor = hex ? 'pointer' : 'default';
    },
    [getHexAtPoint]
  );

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
        cursor: 'pointer',
      }}
    />
  );
}

export default HexGridCanvas;
