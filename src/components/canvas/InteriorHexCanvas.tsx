/**
 * InteriorHexCanvas - Renders interior maps (caves, dungeons, etc.)
 * Simplified version of HexGridCanvas adapted for interior exploration
 */

import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  type MouseEvent,
  type MutableRefObject,
} from 'react';
import { useCanvasAnimation } from '../../hooks/useCanvasAnimation';
import {
  calculateHexPosition,
  sizeCanvasForDpr,
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

const NO_POSITION: Coord = { col: 0, row: 0 };

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
  const [hoveredHex, setHoveredHex] = useState<PositionedHex | null>(null);
  // CSS-pixel size of the canvas; the backing store is this x devicePixelRatio.
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const hasCenteredRef = useRef(false);
  const textureGenerator = useRef<HexTextureGenerator | null>(null);

  // Initialize texture generator once
  useEffect(() => {
    if (!textureGenerator.current) {
      const noise = new PerlinNoise(Date.now());
      textureGenerator.current = new HexTextureGenerator(noise);
    }
  }, []);

  // Convert grid to positioned hexes (using utility function)
  const positionedHexes = useMemo((): PositionedHex[] => {
    if (!interiorMap?.hexes) return [];

    return interiorMap.hexes.map(hex => {
      const { x, y } = calculateHexPosition(hex.col, hex.row, hexSize);
      return { ...hex, x, y };
    });
  }, [interiorMap, hexSize]);

  const getHexX = useCallback(
    (col: number, row: number) => calculateHexPosition(col, row, hexSize).x,
    [hexSize]
  );
  const getHexY = useCallback((row: number) => calculateHexPosition(0, row, hexSize).y, [hexSize]);

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
    (
      ctx: CanvasRenderingContext2D,
      hexArray: PositionedHex[],
      playerVisualPosRef: MutableRefObject<VisualPos | null>
    ) => {
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
    [hexSize, playerPosition, playerIcon]
  );

  // Main draw function (called by the animation hook only when something changed)
  const draw = useCallback(
    (playerVisualPosRef: MutableRefObject<VisualPos | null>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const hexArray = positionedHexes;

      // Clear canvas with dark background
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply transformations (drawing happens in CSS pixels)
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(offsetX, offsetY);

      // Draw only hexes inside the viewport (plus a margin)
      const { width, height } = canvasSizeRef.current;
      const margin = hexSize * 2;
      for (const hex of hexArray) {
        const sx = hex.x + offsetX;
        const sy = hex.y + offsetY;
        if (sx < -margin || sy < -margin || sx > width + margin || sy > height + margin) continue;
        drawHex(ctx, hex);
      }

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
          // Read content from the current map data, not the (possibly stale) hover snapshot
          if (hoveredHexData.content === 'loot' || hoveredHexData.content === 'chest') {
            drawHexOutline(ctx, hoveredHexData, '#f39c12', 3); // Gold for loot
          } else if (hoveredHexData.content === 'exit') {
            drawHexOutline(ctx, hoveredHexData, 'rgba(255,255,255,0.35)', 2);
          } else if (hoveredHexData.content === 'encounter') {
            const enc = interiorMap?.encounters?.find(
              e => e.col === hoveredHex.col && e.row === hoveredHex.row
            );
            if (!enc?.defeated) {
              drawHexOutline(ctx, hoveredHexData, '#e74c3c', 3); // Red for active enemy
            } else {
              drawHexOutline(ctx, hoveredHexData, 'rgba(255,255,255,0.2)', 2);
            }
          } else if (hoveredHexData.terrain?.walkable) {
            drawHexOutline(ctx, hoveredHexData, 'rgba(255,255,255,0.35)', 2);
          }
        }
      }

      // Draw player marker
      drawPlayer(ctx, hexArray, playerVisualPosRef);

      ctx.restore();
    },
    [
      positionedHexes,
      offsetX,
      offsetY,
      hexSize,
      selectedHex,
      hoveredHex,
      interiorMap,
      drawHex,
      drawHexOutline,
      drawPlayer,
    ]
  );

  // Shared overworld animation loop: camera lerp, player slide, redraw only when dirty
  const { playerVisualPosRef, centerCameraOnHex, invalidate } = useCanvasAnimation({
    drawCallback: () => draw(playerVisualPosRef),
    getHexX,
    getHexY,
    setOffsetX,
    setOffsetY,
    playerPosition: playerPosition ?? NO_POSITION,
    hexes: interiorMap?.hexes ?? [],
    moveDuration: 150,
  });

  // Size the canvas to its container (DPR-aware), and again whenever the container resizes.
  // Declared before the camera effect so the first centering sees the real size.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const width = container.clientWidth;
      const height = container.clientHeight - 60; // Account for header
      const prev = canvasSizeRef.current;
      if (prev.width === width && prev.height === height) return;
      canvasSizeRef.current = { width, height };
      sizeCanvasForDpr(canvas, width, height);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // Setting canvas.width clears it; repaint next frame.
      invalidate();
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Keep the camera centered on the player: snap on first view, glide afterwards
  useEffect(() => {
    if (!interiorMap || !playerPosition) return;
    const { width, height } = canvasSizeRef.current;
    centerCameraOnHex(
      playerPosition.col,
      playerPosition.row,
      width,
      height,
      hasCenteredRef.current
    );
    hasCenteredRef.current = true;
  }, [interiorMap, playerPosition]);

  // Get hex at point (using utility function)
  const getHexAtPoint = useCallback(
    (x: number, y: number): PositionedHex | null => {
      const worldX = x - offsetX;
      const worldY = y - offsetY;

      return findHexAtPoint(worldX, worldY, positionedHexes, hexSize) as PositionedHex | null;
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
      // Only re-render (and redraw) when the hovered hex actually changes
      if (hex?.col !== hoveredHex?.col || hex?.row !== hoveredHex?.row) {
        setHoveredHex(hex);
      }

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
    [getHexAtPoint, hoveredHex]
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
