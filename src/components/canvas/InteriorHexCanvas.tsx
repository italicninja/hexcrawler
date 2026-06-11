/**
 * InteriorHexCanvas - Renders interior maps (caves, dungeons, etc.)
 * Simplified version of HexGridCanvas adapted for interior exploration
 */

import { useRef, useEffect, useCallback, useState, type MouseEvent } from 'react';
import {
  calculateHexPosition,
  drawHexShape,
  drawHexOutline as renderHexOutline,
  findHexAtPoint,
  drawPlayerMarker,
} from '../../utils/hexRenderer';
import { HexTextureGenerator } from '../../utils/hexTextureGenerator';
import { PerlinNoise } from '../../noise';

interface Coord {
  col: number;
  row: number;
}

interface CanvasHex {
  col: number;
  row: number;
  terrain: { key: string; color: string; walkable?: boolean; [key: string]: unknown };
  content?: string | null;
  [key: string]: unknown;
}

interface PositionedHex extends CanvasHex {
  x: number;
  y: number;
}

/** A loot/encounter/hazard entry placed on the interior map. */
interface ContentEntry {
  col: number;
  row: number;
  discovered?: boolean;
  defeated?: boolean;
  collected?: boolean;
  triggered?: boolean;
  isBoss?: boolean;
  cr?: number;
  [key: string]: unknown;
}

interface InteriorMapView {
  hexes: CanvasHex[];
  encounters?: ContentEntry[];
  loot?: ContentEntry[];
  hazards?: ContentEntry[];
  [key: string]: unknown;
}

interface VisualPos {
  x: number;
  y: number;
}

interface PlayerAnim {
  startPos: VisualPos;
  endPos: VisualPos;
  startTime: number;
  duration: number;
}

interface InteriorHexCanvasProps {
  interiorMap?: InteriorMapView | null;
  playerPosition?: Coord | null;
  playerIcon?: string;
  selectedHex?: Coord | null;
  onHexClick?: (hex: PositionedHex) => void;
  onHexDoubleClick?: (hex: PositionedHex) => void;
}

function InteriorHexCanvas({
  interiorMap,
  playerPosition,
  playerIcon = '🧍',
  selectedHex,
  onHexClick,
  onHexDoubleClick,
}: InteriorHexCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hexSize] = useState(30);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [targetOffsetX, setTargetOffsetX] = useState(0);
  const [targetOffsetY, setTargetOffsetY] = useState(0);
  const [hoveredHex, setHoveredHex] = useState<PositionedHex | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playerAnimationRef = useRef<PlayerAnim | null>(null);
  const playerVisualPosRef = useRef<VisualPos | null>(null);
  const previousPlayerPosRef = useRef<Coord | null>(playerPosition ?? null);
  const textureGenerator = useRef<HexTextureGenerator | null>(null);

  // Initialize texture generator once
  useEffect(() => {
    if (!textureGenerator.current) {
      const noise = new PerlinNoise(Date.now());
      textureGenerator.current = new HexTextureGenerator(noise);
    }
  }, []);

  // Convert grid to positioned hexes (using utility function)
  const positionedHexes = useCallback((): PositionedHex[] => {
    if (!interiorMap?.hexes) return [];

    return interiorMap.hexes.map(hex => {
      const { x, y } = calculateHexPosition(hex.col, hex.row, hexSize);
      return { ...hex, x, y };
    });
  }, [interiorMap, hexSize]);

  // Check if content should be visible
  const shouldRenderEncounter = useCallback((encounter: ContentEntry) => {
    return encounter.discovered || encounter.defeated;
  }, []);

  const shouldRenderHazard = useCallback((hazard: ContentEntry) => {
    return hazard.discovered || hazard.triggered;
  }, []);

  const shouldRenderLoot = useCallback((loot: ContentEntry) => {
    return loot.discovered || loot.collected;
  }, []);

  // Check if content is collected/defeated
  const isContentCollected = useCallback(
    (hex: CanvasHex) => {
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
    (ctx: CanvasRenderingContext2D, hex: PositionedHex) => {
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
          // Encounters are always visible — enemies stand in plain sight.
          // Defeated encounters render at low opacity (handled in drawContentMarker).
          shouldRender = true;
        } else if (content === 'hazard') {
          const hazard = interiorMap?.hazards?.find(h => h.col === hex.col && h.row === hex.row);
          shouldRender = Boolean(hazard && shouldRenderHazard(hazard));
        } else if (content === 'loot' || content === 'chest') {
          // Loot/chests are always visible — you can see the chest, you just
          // can't collect it until you walk onto the hex.
          shouldRender = true;
        } else {
          // Always render non-hidden content (entrance, exit, stairs, etc.)
          shouldRender = true;
        }

        if (shouldRender) {
          const isCollected = isContentCollected(hex);
          drawContentMarker(ctx, x, y, content, isCollected, hex.col, hex.row);
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
  const drawContentMarker = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    content: string,
    isCollected = false,
    col = 0,
    row = 0
  ) => {
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
        // Door knob
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(x + iconSize * 0.25, y, iconSize * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'exit': {
        // Wooden ladder leading up to the surface
        const railColor = '#8B5E3C';
        const railHighlight = '#C49A6C';
        const rungColor = '#6B4423';
        const rungHighlight = '#A0713A';
        const railW = iconSize * 0.12;
        const halfSpan = iconSize * 0.28;
        const ladderTop = y - iconSize * 0.52;
        const ladderBottom = y + iconSize * 0.48;

        // Left rail
        ctx.fillStyle = railColor;
        ctx.fillRect(x - halfSpan - railW / 2, ladderTop, railW, ladderBottom - ladderTop);
        // Left rail highlight
        ctx.fillStyle = railHighlight;
        ctx.fillRect(x - halfSpan - railW / 2, ladderTop, railW * 0.3, ladderBottom - ladderTop);

        // Right rail
        ctx.fillStyle = railColor;
        ctx.fillRect(x + halfSpan - railW / 2, ladderTop, railW, ladderBottom - ladderTop);
        // Right rail highlight
        ctx.fillStyle = railHighlight;
        ctx.fillRect(x + halfSpan - railW / 2, ladderTop, railW * 0.3, ladderBottom - ladderTop);

        // Rungs (4 horizontal bars evenly spaced)
        const rungCount = 4;
        const rungH = iconSize * 0.09;
        for (let i = 0; i < rungCount; i++) {
          const rungY = ladderTop + ((ladderBottom - ladderTop) / (rungCount + 1)) * (i + 1);
          ctx.fillStyle = rungColor;
          ctx.fillRect(x - halfSpan - railW / 2, rungY - rungH / 2, halfSpan * 2 + railW, rungH);
          // Rung highlight (top edge)
          ctx.fillStyle = rungHighlight;
          ctx.fillRect(
            x - halfSpan - railW / 2,
            rungY - rungH / 2,
            halfSpan * 2 + railW,
            rungH * 0.3
          );
        }

        break;
      }

      case 'encounter': {
        // Look up the encounter object for extra info (CR, isBoss, defeated)
        const enc = interiorMap?.encounters?.find(e => e.col === col && e.row === row);
        const isBoss = enc?.isBoss === true;
        const defeated = enc?.defeated === true || isCollected;
        const crLabel = enc?.cr != null ? `${enc.cr}` : '?';

        // Token base color: dark crimson for normal, deep purple for boss, gray for defeated
        const tokenColor = defeated ? '#555' : isBoss ? '#6a0dad' : '#c0392b';
        const borderColor = defeated ? '#333' : isBoss ? '#d4a0ff' : '#ff6b6b';

        // ── Body (hexagon-ish circle) ───────────────────────────────────────
        ctx.beginPath();
        ctx.arc(x, y + iconSize * 0.1, iconSize * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = tokenColor;
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = defeated ? 1.5 : 2.5;
        ctx.stroke();

        // ── Head ───────────────────────────────────────────────────────────
        ctx.beginPath();
        ctx.arc(x, y - iconSize * 0.28, iconSize * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = tokenColor;
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = defeated ? 1 : 2;
        ctx.stroke();

        // ── Skull face (X eyes when defeated, dot eyes when alive) ─────────
        if (defeated) {
          // X eyes
          ctx.strokeStyle = '#aaa';
          ctx.lineWidth = 1.2;
          for (const ox of [-0.12, 0.12]) {
            const ex = x + iconSize * ox;
            const ey = y - iconSize * 0.31;
            const r = iconSize * 0.06;
            ctx.beginPath();
            ctx.moveTo(ex - r, ey - r);
            ctx.lineTo(ex + r, ey + r);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ex + r, ey - r);
            ctx.lineTo(ex - r, ey + r);
            ctx.stroke();
          }
        } else {
          // Glowing dot eyes
          ctx.fillStyle = isBoss ? '#d4a0ff' : '#ff9999';
          for (const ox of [-0.12, 0.12]) {
            ctx.beginPath();
            ctx.arc(x + iconSize * ox, y - iconSize * 0.3, iconSize * 0.055, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // ── Boss crown ─────────────────────────────────────────────────────
        if (isBoss && !defeated) {
          ctx.fillStyle = '#f1c40f';
          ctx.strokeStyle = '#b8860b';
          ctx.lineWidth = 1;
          const cy2 = y - iconSize * 0.5;
          ctx.beginPath();
          ctx.moveTo(x - iconSize * 0.22, cy2);
          ctx.lineTo(x - iconSize * 0.22, cy2 - iconSize * 0.18);
          ctx.lineTo(x - iconSize * 0.1, cy2 - iconSize * 0.1);
          ctx.lineTo(x, cy2 - iconSize * 0.22);
          ctx.lineTo(x + iconSize * 0.1, cy2 - iconSize * 0.1);
          ctx.lineTo(x + iconSize * 0.22, cy2 - iconSize * 0.18);
          ctx.lineTo(x + iconSize * 0.22, cy2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // ── CR badge ───────────────────────────────────────────────────────
        if (!defeated) {
          const badgeX = x + iconSize * 0.38;
          const badgeY = y + iconSize * 0.48;
          ctx.fillStyle = isBoss ? '#6a0dad' : '#c0392b';
          ctx.strokeStyle = isBoss ? '#d4a0ff' : '#ff6b6b';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, iconSize * 0.22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${Math.max(7, iconSize * 0.22)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(crLabel, badgeX, badgeY);
        }
        break;
      }

      case 'loot':
      case 'chest': {
        if (!isCollected) {
          // Glow behind chest so it stands out on dark tiles
          ctx.shadowColor = '#f39c12';
          ctx.shadowBlur = 10;
        }
        // Chest body
        ctx.fillStyle = isCollected ? '#555' : '#8B6914';
        ctx.fillRect(x - iconSize * 0.55, y - iconSize * 0.2, iconSize * 1.1, iconSize * 0.65);
        // Chest lid (lighter strip on top)
        ctx.fillStyle = isCollected ? '#666' : '#f39c12';
        ctx.fillRect(x - iconSize * 0.55, y - iconSize * 0.35, iconSize * 1.1, iconSize * 0.22);
        // Outline
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isCollected ? '#444' : '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - iconSize * 0.55, y - iconSize * 0.35, iconSize * 1.1, iconSize * 0.87);
        // Dividing line between lid and body
        ctx.beginPath();
        ctx.moveTo(x - iconSize * 0.55, y - iconSize * 0.13);
        ctx.lineTo(x + iconSize * 0.55, y - iconSize * 0.13);
        ctx.strokeStyle = isCollected ? '#444' : '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Lock clasp (center)
        ctx.fillStyle = isCollected ? '#888' : '#f1c40f';
        ctx.beginPath();
        ctx.arc(x, y - iconSize * 0.13, iconSize * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }

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
    (ctx: CanvasRenderingContext2D, hex: PositionedHex, color: string, width: number) => {
      renderHexOutline(ctx, hex.x, hex.y, hexSize, color, width);
    },
    [hexSize]
  );

  // Draw player marker (using utility function with smooth animation)
  const drawPlayer = useCallback(
    (ctx: CanvasRenderingContext2D, hexArray: PositionedHex[]) => {
      if (!playerPosition) return;

      // Use animated position if available, otherwise actual position
      let x: number, y: number;
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

      drawPlayerMarker(ctx, x, y, hexSize, playerIcon);
    },
    [hexSize, playerPosition]
  );

  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const hexArray = positionedHexes();

    // Clear canvas with dark background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw all hexes
    hexArray.forEach(hex => drawHex(ctx, hex));

    // Draw selected hex outline (blue)
    if (selectedHex) {
      const selectedHexData = hexArray.find(
        h => h.col === selectedHex.col && h.row === selectedHex.row
      );
      if (selectedHexData) {
        drawHexOutline(ctx, selectedHexData, '#3498db', 3);
      }
    }

    // Draw hovered hex outline — color by content type
    if (hoveredHex) {
      const hoveredHexData = hexArray.find(
        h => h.col === hoveredHex.col && h.row === hoveredHex.row
      );
      if (hoveredHexData) {
        if (hoveredHex.content === 'loot' || hoveredHex.content === 'chest') {
          drawHexOutline(ctx, hoveredHexData, '#f39c12', 3); // Gold for loot
        } else if (hoveredHex.content === 'exit') {
          drawHexOutline(ctx, hoveredHexData, 'rgba(255,255,255,0.35)', 2);
        } else if (hoveredHex.content === 'encounter') {
          const enc = interiorMap?.encounters?.find(
            e => e.col === hoveredHex.col && e.row === hoveredHex.row
          );
          if (!enc?.defeated) {
            drawHexOutline(ctx, hoveredHexData, '#e74c3c', 3); // Red for active enemy
          } else {
            drawHexOutline(ctx, hoveredHexData, 'rgba(255,255,255,0.2)', 2);
          }
        } else if (hoveredHex.terrain?.walkable) {
          drawHexOutline(ctx, hoveredHexData, 'rgba(255,255,255,0.35)', 2);
        }
      }
    }

    // Draw player marker
    drawPlayer(ctx, hexArray);

    ctx.restore();
  }, [
    positionedHexes,
    offsetX,
    offsetY,
    selectedHex,
    hoveredHex,
    drawHex,
    drawHexOutline,
    drawPlayer,
  ]);

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
    const prev = previousPlayerPosRef.current;
    if (prev && (prev.col !== playerPosition.col || prev.row !== playerPosition.row)) {
      const prevHex = hexArray.find(h => h.col === prev.col && h.row === prev.row);

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
    (x: number, y: number): PositionedHex | null => {
      const worldX = x - offsetX;
      const worldY = y - offsetY;
      const hexArray = positionedHexes();

      return findHexAtPoint(worldX, worldY, hexArray, hexSize) as PositionedHex | null;
    },
    [hexSize, offsetX, offsetY, positionedHexes]
  );

  // Handle click
  const handleClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
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
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hex = getHexAtPoint(x, y);
      if (hex && onHexDoubleClick) {
        onHexDoubleClick(hex);
      }
    },
    [getHexAtPoint, onHexDoubleClick]
  );

  // Handle mouse move for cursor and hover highlight
  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hex = getHexAtPoint(x, y);
      setHoveredHex(hex || null);

      // Change cursor based on content
      if (hex) {
        if (hex.content === 'loot' || hex.content === 'chest') {
          canvas.style.cursor = 'grab';
        } else if (hex.content === 'exit') {
          canvas.style.cursor = 'crosshair';
        } else if (hex.terrain?.walkable) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'not-allowed';
        }
      } else {
        canvas.style.cursor = 'default';
      }
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
