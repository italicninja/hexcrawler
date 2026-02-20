// @ts-nocheck
/**
 * InteriorHexCanvas - Renders interior maps (caves, dungeons, etc.)
 * Simplified version of HexGridCanvas adapted for interior exploration
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import {
  calculateHexPosition,
  drawHexShape,
  drawHexOutline as renderHexOutline,
  findHexAtPoint,
  drawPlayerMarker,
} from '../../utils/hexRenderer';
import { HexTextureGenerator } from '../../utils/hexTextureGenerator';
import { PerlinNoise } from '../../noise';

function InteriorHexCanvas({
  interiorMap,
  playerPosition,
  selectedHex,
  onHexClick,
  onHexDoubleClick,
}) {
  const canvasRef = useRef(null);
  const [hexSize] = useState(30);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [targetOffsetX, setTargetOffsetX] = useState(0);
  const [targetOffsetY, setTargetOffsetY] = useState(0);
  const animationFrameRef = useRef(null);
  const playerAnimationRef = useRef(null);
  const playerVisualPosRef = useRef(null);
  const previousPlayerPosRef = useRef(playerPosition);
  const textureGenerator = useRef(null);

  // Initialize texture generator once
  useEffect(() => {
    if (!textureGenerator.current) {
      const noise = new PerlinNoise(Date.now());
      textureGenerator.current = new HexTextureGenerator(noise);
    }
  }, []);

  // Convert grid to positioned hexes (using utility function)
  const positionedHexes = useCallback(() => {
    if (!interiorMap?.hexes) return [];

    return interiorMap.hexes.map(hex => {
      const { x, y } = calculateHexPosition(hex.col, hex.row, hexSize);
      return { ...hex, x, y };
    });
  }, [interiorMap, hexSize]);

  // Check if content should be visible
  const shouldRenderEncounter = useCallback(encounter => {
    return encounter.discovered || encounter.defeated;
  }, []);

  const shouldRenderHazard = useCallback(hazard => {
    return hazard.discovered || hazard.triggered;
  }, []);

  const shouldRenderLoot = useCallback(loot => {
    return loot.discovered || loot.collected;
  }, []);

  // Check if content is collected/defeated
  const isContentCollected = useCallback(
    hex => {
      if (!interiorMap) return false;

      // Check if loot is collected
      if (hex.content === 'loot' || hex.content === 'chest') {
        const lootItem = interiorMap.loot?.find(l => l.col === hex.col && l.row === hex.row);
        return lootItem?.collected || false;
      }

      // Check if encounter is defeated
      if (hex.content === 'encounter') {
        const encounterItem = interiorMap.encounters?.find(
          e => e.col === hex.col && e.row === hex.row
        );
        return encounterItem?.defeated || false;
      }

      // Check if hazard is triggered
      if (hex.content === 'hazard') {
        const hazardItem = interiorMap.hazards?.find(h => h.col === hex.col && h.row === hex.row);
        return hazardItem?.triggered || false;
      }

      return false;
    },
    [interiorMap]
  );

  // Draw a single hex (using utility function)
  const drawHex = useCallback(
    (ctx, hex) => {
      const { x, y, terrain, content } = hex;

      // Draw hex shape with procedural texture or solid color fallback
      const strokeColor = terrain.walkable ? '#555' : '#111';
      const lineWidth = terrain.walkable ? 1 : 2;

      if (textureGenerator.current) {
        const pattern = textureGenerator.current.getPattern(
          ctx,
          terrain,
          hexSize,
          hex.col,
          hex.row
        );
        drawHexShape(ctx, x, y, hexSize, pattern, strokeColor, lineWidth);
      } else {
        // Fallback to solid color if texture generator not ready
        drawHexShape(ctx, x, y, hexSize, terrain.color, strokeColor, lineWidth);
      }

      // Draw content markers (only if discovered)
      if (content) {
        // Check visibility based on content type
        let shouldRender = false;

        if (content === 'encounter') {
          const encounter = interiorMap?.encounters?.find(
            e => e.col === hex.col && e.row === hex.row
          );
          shouldRender = encounter && shouldRenderEncounter(encounter);
        } else if (content === 'hazard') {
          const hazard = interiorMap?.hazards?.find(h => h.col === hex.col && h.row === hex.row);
          shouldRender = hazard && shouldRenderHazard(hazard);
        } else if (content === 'loot' || content === 'chest') {
          const loot = interiorMap?.loot?.find(l => l.col === hex.col && l.row === hex.row);
          shouldRender = loot && shouldRenderLoot(loot);
        } else {
          // Always render non-hidden content (entrance, stairs, etc.)
          shouldRender = true;
        }

        if (shouldRender) {
          const isCollected = isContentCollected(hex);
          drawContentMarker(ctx, x, y, content, isCollected);
        }
      }
    },
    [
      hexSize,
      isContentCollected,
      interiorMap,
      shouldRenderEncounter,
      shouldRenderHazard,
      shouldRenderLoot,
    ]
  );

  // Draw content marker icons
  const drawContentMarker = (ctx, x, y, content, isCollected = false) => {
    ctx.save();

    // Gray out collected/defeated content
    if (isCollected) {
      ctx.globalAlpha = 0.3;
    }

    const iconSize = hexSize * 0.5;

    switch (content) {
      case 'entrance':
        // Brown door icon
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
        break;

      case 'encounter':
        // Red/gray skull icon (gray if defeated)
        ctx.fillStyle = isCollected ? '#666666' : '#e74c3c';
        ctx.beginPath();
        ctx.arc(x, y, iconSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Eye sockets
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x - iconSize * 0.2, y - iconSize * 0.1, iconSize * 0.1, 0, Math.PI * 2);
        ctx.arc(x + iconSize * 0.2, y - iconSize * 0.1, iconSize * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'loot':
      case 'chest':
        // Gold/gray chest icon (gray if collected)
        ctx.fillStyle = isCollected ? '#666666' : '#f39c12';
        ctx.fillRect(x - iconSize / 2, y - iconSize / 2, iconSize, iconSize * 0.7);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - iconSize / 2, y - iconSize / 2, iconSize, iconSize * 0.7);
        // Lock
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x, y, iconSize * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'hazard':
        // Orange/gray warning triangle (gray if triggered)
        ctx.fillStyle = isCollected ? '#666666' : '#e67e22';
        ctx.beginPath();
        ctx.moveTo(x, y - iconSize * 0.6);
        ctx.lineTo(x + iconSize * 0.6, y + iconSize * 0.4);
        ctx.lineTo(x - iconSize * 0.6, y + iconSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Exclamation mark
        ctx.fillStyle = '#000';
        ctx.fillRect(x - iconSize * 0.08, y - iconSize * 0.3, iconSize * 0.16, iconSize * 0.4);
        ctx.beginPath();
        ctx.arc(x, y + iconSize * 0.25, iconSize * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'stairsUp':
        // Stairs going up icon (arrow pointing up with steps)
        ctx.fillStyle = '#6a5a3a';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        // Draw steps (3 horizontal lines)
        for (let i = 0; i < 3; i++) {
          const yOffset = y - iconSize * 0.3 + i * iconSize * 0.3;
          ctx.beginPath();
          ctx.moveTo(x - iconSize * 0.4, yOffset);
          ctx.lineTo(x + iconSize * 0.4, yOffset);
          ctx.stroke();
        }
        // Draw up arrow
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x, y - iconSize * 0.5);
        ctx.lineTo(x + iconSize * 0.3, y);
        ctx.lineTo(x - iconSize * 0.3, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        break;

      case 'stairsDown':
        // Stairs going down icon (arrow pointing down with steps)
        ctx.fillStyle = '#5a4a2a';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        // Draw steps (3 horizontal lines)
        for (let i = 0; i < 3; i++) {
          const yOffset = y - iconSize * 0.3 + i * iconSize * 0.3;
          ctx.beginPath();
          ctx.moveTo(x - iconSize * 0.4, yOffset);
          ctx.lineTo(x + iconSize * 0.4, yOffset);
          ctx.stroke();
        }
        // Draw down arrow
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x, y + iconSize * 0.5);
        ctx.lineTo(x + iconSize * 0.3, y);
        ctx.lineTo(x - iconSize * 0.3, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        break;
    }

    ctx.restore();
  };

  // Draw hex outline (for selection) - wrapper around utility function
  const drawHexOutline = useCallback(
    (ctx, hex, color, width) => {
      renderHexOutline(ctx, hex.x, hex.y, hexSize, color, width);
    },
    [hexSize]
  );

  // Draw player marker (using utility function with smooth animation)
  const drawPlayer = useCallback(
    (ctx, hexArray) => {
      if (!playerPosition) return;

      // Use animated position if available, otherwise actual position
      let x, y;
      if (playerVisualPosRef.current) {
        x = playerVisualPosRef.current.x;
        y = playerVisualPosRef.current.y;
      } else {
        const playerHex = hexArray.find(
          h => h.col === playerPosition.col && h.row === playerPosition.row
        );
        if (!playerHex) return;
        x = playerHex.x;
        y = playerHex.y;
      }

      drawPlayerMarker(ctx, x, y, hexSize, 'P');
    },
    [hexSize, playerPosition]
  );

  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hexArray = positionedHexes();

    // Clear canvas with dark background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw all hexes
    hexArray.forEach(hex => drawHex(ctx, hex));

    // Draw selected hex outline
    if (selectedHex) {
      const selectedHexData = hexArray.find(
        h => h.col === selectedHex.col && h.row === selectedHex.row
      );
      if (selectedHexData) {
        drawHexOutline(ctx, selectedHexData, '#3498db', 3);
      }
    }

    // Draw player marker
    drawPlayer(ctx, hexArray);

    ctx.restore();
  }, [positionedHexes, offsetX, offsetY, selectedHex, drawHex, drawHexOutline, drawPlayer]);

  // Setup canvas and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight - 60; // Account for header
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Set target camera position and animate player when position changes
  useEffect(() => {
    if (!interiorMap || !playerPosition) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const hexArray = positionedHexes();
    const playerHex = hexArray.find(
      h => h.col === playerPosition.col && h.row === playerPosition.row
    );
    if (!playerHex) return;

    // Start player movement animation if position changed
    if (
      previousPlayerPosRef.current &&
      (previousPlayerPosRef.current.col !== playerPosition.col ||
        previousPlayerPosRef.current.row !== playerPosition.row)
    ) {
      const prevHex = hexArray.find(
        h =>
          h.col === previousPlayerPosRef.current.col && h.row === previousPlayerPosRef.current.row
      );

      if (prevHex) {
        playerAnimationRef.current = {
          startPos: { x: prevHex.x, y: prevHex.y },
          endPos: { x: playerHex.x, y: playerHex.y },
          startTime: performance.now(),
          duration: 150, // milliseconds
        };
      }
    }

    previousPlayerPosRef.current = playerPosition;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    setTargetOffsetX(centerX - playerHex.x);
    setTargetOffsetY(centerY - playerHex.y);
  }, [interiorMap, playerPosition, positionedHexes]);

  // Smooth camera and player animation with lerp
  useEffect(() => {
    let running = true;
    const lerpSpeed = 0.1; // Match the overworld smoothness

    const animate = () => {
      if (!running) return;

      // Update player animation
      if (playerAnimationRef.current) {
        const { startPos, endPos, startTime, duration } = playerAnimationRef.current;
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic for smooth deceleration)
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
      setOffsetX(prev => {
        const diff = targetOffsetX - prev;
        if (Math.abs(diff) < 0.1) return targetOffsetX;
        return prev + diff * lerpSpeed;
      });

      setOffsetY(prev => {
        const diff = targetOffsetY - prev;
        if (Math.abs(diff) < 0.1) return targetOffsetY;
        return prev + diff * lerpSpeed;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetOffsetX, targetOffsetY]);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // Get hex at point (using utility function)
  const getHexAtPoint = useCallback(
    (x, y) => {
      const worldX = x - offsetX;
      const worldY = y - offsetY;
      const hexArray = positionedHexes();

      return findHexAtPoint(worldX, worldY, hexArray, hexSize);
    },
    [hexSize, offsetX, offsetY, positionedHexes]
  );

  // Handle click
  const handleClick = useCallback(
    e => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hex = getHexAtPoint(x, y);
      if (hex && onHexClick) {
        onHexClick(hex);
      }
    },
    [getHexAtPoint, onHexClick]
  );

  // Handle double click
  const handleDoubleClick = useCallback(
    e => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hex = getHexAtPoint(x, y);
      if (hex && onHexDoubleClick) {
        onHexDoubleClick(hex);
      }
    },
    [getHexAtPoint, onHexDoubleClick]
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
        display: 'block',
        cursor: 'pointer',
      }}
    />
  );
}

export default InteriorHexCanvas;
