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
  drawHexOutline as renderHexOutline,
  findHexAtPoint,
} from '../../utils/hexRenderer';
import { drawPixelIcon, drawPixelPlayer } from '../../utils/pixelIcons';
import { ART_PX } from '../../utils/pixelTerrainRenderer';
import { renderInteriorFloor, interiorThemeFor } from '../../utils/pixelInteriorRenderer';

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
  playerClass?: string;
  selectedHex?: Coord | null;
  onHexClick?: (hex: PositionedHex) => void;
  onHexDoubleClick?: (hex: PositionedHex) => void;
}

function InteriorHexCanvas({
  interiorMap,
  playerPosition,
  playerClass,
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
  // Whole-floor pixel art, re-rendered only when the terrain changes
  const floor = useMemo(
    () =>
      interiorMap?.hexes?.length
        ? renderInteriorFloor(interiorMap.hexes, interiorThemeFor(interiorMap.poiType), hexSize)
        : null,
    [interiorMap?.hexes, interiorMap?.poiType, hexSize]
  );

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
      const { x, y, content } = hex;

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

    switch (content) {
      case 'encounter': {
        // Look up the encounter object for extra info (CR, isBoss, defeated)
        const enc = interiorMap?.encounters?.find(e => e.col === col && e.row === row);
        const isBoss = enc?.isBoss === true;
        const defeated = enc?.defeated === true || isCollected;
        ctx.globalAlpha = 1; // the defeated sprite is already greyed
        drawPixelIcon(ctx, defeated ? 'enemyDefeated' : isBoss ? 'enemyBoss' : 'enemy', x, y);

        // CR badge: square pixel plate, bottom-right
        if (!defeated) {
          const bx = Math.round((x + hexSize * 0.3) / ART_PX) * ART_PX;
          const by = Math.round((y + hexSize * 0.3) / ART_PX) * ART_PX;
          const half = 5 * ART_PX / 2 + ART_PX;
          ctx.fillStyle = '#1a150c';
          ctx.fillRect(bx - half - ART_PX, by - half - ART_PX, (half + ART_PX) * 2, (half + ART_PX) * 2);
          ctx.fillStyle = isBoss ? '#5a2a8a' : '#7a1f16';
          ctx.fillRect(bx - half, by - half, half * 2, half * 2);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(enc?.cr != null ? `${enc.cr}` : '?', bx, by + 1);
        }
        break;
      }
      case 'loot':
      case 'chest':
        ctx.globalAlpha = 1;
        drawPixelIcon(ctx, isCollected ? 'chestOpened' : 'chest', x, y);
        break;
      case 'hazard':
        ctx.globalAlpha = 1;
        drawPixelIcon(ctx, isCollected ? 'hazardTriggered' : 'hazard', x, y);
        break;
      default:
        // entrance, exit, stairsUp, stairsDown
        drawPixelIcon(ctx, content, x, y);
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

      drawPixelPlayer(ctx, x, y, playerClass);
    },
    [playerPosition, playerClass]
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

      if (floor) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(floor.canvas, floor.x, floor.y, floor.canvas.width * ART_PX, floor.canvas.height * ART_PX);
      }

      // Draw content markers inside the viewport (plus a margin)
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
      floor,
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
