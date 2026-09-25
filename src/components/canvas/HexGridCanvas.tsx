import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type MouseEvent,
  type MutableRefObject,
} from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useCanvasAnimation } from '../../hooks/useCanvasAnimation';
import { drawPixelIcon, drawPixelPlayer } from '../../utils/pixelIcons';
import { PixelTerrainRenderer, ART_PX } from '../../utils/pixelTerrainRenderer';
import {
  calculateHexPosition,
  drawHexOutline as renderHexOutline,
  findHexAtPoint,
} from '../../utils/hexRenderer';
import type { POI } from '../../types/game';

interface CanvasHex {
  col: number;
  row: number;
  terrain: { key: string; color: string; [key: string]: unknown };
  poi?: POI | null;
  [key: string]: unknown;
}

interface PositionedHex extends CanvasHex {
  x: number;
  y: number;
}

interface VisualPos {
  x: number;
  y: number;
}

interface HexGridCanvasProps {
  hexes?: CanvasHex[] | null;
  width?: number;
  height?: number;
  onHexClick?: (hex: PositionedHex) => void;
  onHexDoubleClick?: (hex: PositionedHex) => void;
}

/**
 * HexGridCanvas component - renders hex grid on canvas
 */

function HexGridCanvas({ hexes, onHexClick, onHexDoubleClick }: HexGridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, isHexExplored, shouldShowPOI, isPoiDiscovered } = useGameState();
  const { settings } = useSettings();

  const [hexSize] = useState(30);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zoom] = useState(1.0);
  const [selectedHex, setSelectedHex] = useState<PositionedHex | null>(null);

  // CSS-pixel size of the canvas; the backing store is this × devicePixelRatio.
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  // Per-hex pixel-art tiles, rendered lazily and cached for the current map
  const terrainRenderer = useMemo(() => new PixelTerrainRenderer(hexes ?? [], hexSize), [hexes, hexSize]);

  // Calculate hex position (using utility function)
  const getHexX = useCallback(
    (col: number, row: number) => {
      return calculateHexPosition(col, row, hexSize).x;
    },
    [hexSize]
  );

  const getHexY = useCallback(
    (row: number) => {
      return calculateHexPosition(0, row, hexSize).y;
    },
    [hexSize]
  );

  // Convert hex array to positioned hex objects (memoized for performance)
  const positionedHexes = useMemo<PositionedHex[]>(() => {
    if (!hexes) return [];
    return hexes.map(hex => {
      const { x, y } = calculateHexPosition(hex.col, hex.row, hexSize);
      return { ...hex, x, y };
    });
  }, [hexes, hexSize]);

  // Draw a hex's pixel-art ground or sprite layer (all ground goes down before any sprites,
  // since sprites overhang neighbouring hexes). Unexplored hexes are fog.
  const drawTerrain = useCallback(
    (ctx: CanvasRenderingContext2D, hex: PositionedHex, layer: 'ground' | 'sprites') => {
      const explored = isHexExplored(hex.col, hex.row);
      if (!explored && layer === 'sprites') return;
      // Unexplored hexes are flat fog of war
      const tile = explored ? terrainRenderer.getTile(hex.col, hex.row) : terrainRenderer.getFog(hex.col, hex.row);
      const img = tile[layer];
      ctx.drawImage(img, tile.x, tile.y, img.width * ART_PX, img.height * ART_PX);
    },
    [isHexExplored, terrainRenderer]
  );

  // Draw a hex's POI icon and discovered marker
  const drawPOI = useCallback(
    (ctx: CanvasRenderingContext2D, hex: PositionedHex) => {
      const { x, y } = hex;
      if (!isHexExplored(hex.col, hex.row)) return;

      // Draw POI icon if present AND visible (towns always, others only if discovered)
      if (hex.poi && shouldShowPOI(hex.poi, hex.col, hex.row)) {
        drawPixelIcon(ctx, hex.poi.icon || hex.poi.name, x, y);

        // Gold star in the top-right corner for discovered POIs (towns are always visible)
        if (isPoiDiscovered(hex.col, hex.row) && !hex.poi.visibleWithoutDiscovery) {
          drawPixelIcon(ctx, 'star', x + hexSize * 0.6, y - hexSize * 0.6);
        }
      }
    },
    [hexSize, isHexExplored, shouldShowPOI, isPoiDiscovered]
  );

  // Draw hex outline (for selection) - wrapper around utility function
  const drawHexOutline = useCallback(
    (ctx: CanvasRenderingContext2D, hex: PositionedHex, color: string, width: number) => {
      renderHexOutline(ctx, hex.x, hex.y, hexSize, color, width);
    },
    [hexSize]
  );

  // Draw player marker (now receives playerVisualPosRef from animation hook)
  const drawPlayerMarker = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      hexes: PositionedHex[],
      playerVisualPosRef: MutableRefObject<VisualPos | null>
    ) => {
      let playerX: number, playerY: number;

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

      drawPixelPlayer(ctx, playerX, playerY, state.party?.player?.class);
    },
    [state.playerPosition, state.party]
  );

  // Main draw function (will be called by animation hook)
  const draw = useCallback(
    (playerVisualPosRef: MutableRefObject<VisualPos | null>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply transformations (drawing happens in CSS pixels)
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(offsetX, offsetY);
      ctx.scale(zoom, zoom);

      // Draw only hexes inside the viewport (plus a one-hex margin)
      const { width, height } = canvasSizeRef.current;
      const margin = hexSize * 2;
      const visible = positionedHexes.filter(hex => {
        const sx = hex.x * zoom + offsetX;
        const sy = hex.y * zoom + offsetY;
        return !(sx < -margin || sy < -margin || sx > width + margin || sy > height + margin);
      });
      ctx.imageSmoothingEnabled = false; // keep art pixels crisp when tiles are scaled up
      visible.sort((a, b) => a.y - b.y || a.x - b.x); // painter's order for sprite overhang
      for (const hex of visible) drawTerrain(ctx, hex, 'ground');
      for (const hex of visible) drawTerrain(ctx, hex, 'sprites');
      for (const hex of visible) drawPOI(ctx, hex);

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
      hexSize,
      positionedHexes,
      offsetX,
      offsetY,
      zoom,
      selectedHex,
      drawTerrain,
      drawPOI,
      drawHexOutline,
      drawPlayerMarker,
    ]
  );

  // Use animation hook for smooth camera and player movement
  const { playerVisualPosRef, centerCameraOnHex, currentCameraRef, invalidate } = useCanvasAnimation({
    drawCallback: () => draw(playerVisualPosRef),
    getHexX,
    getHexY,
    setOffsetX,
    setOffsetY,
    playerPosition: state.playerPosition,
    hexes: hexes ?? [],
  });

  // Setup canvas and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        const width = container.clientWidth - 48;
        const height = container.clientHeight - 48;
        const dpr = window.devicePixelRatio || 1;
        canvasSizeRef.current = { width, height };
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        // Setting canvas.width clears it; repaint next frame.
        invalidate();
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
      canvasSizeRef.current.width,
      canvasSizeRef.current.height,
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
      canvasSizeRef.current.width,
      canvasSizeRef.current.height,
      true
    );
  }, [state.playerPosition, hexes, centerCameraOnHex]);

  // Get hex at point (using utility function)
  const getHexAtPoint = useCallback(
    (x: number, y: number): PositionedHex | null => {
      const worldX = (x - offsetX) / zoom;
      const worldY = (y - offsetY) / zoom;

      return findHexAtPoint(worldX, worldY, positionedHexes, hexSize) as PositionedHex | null;
    },
    [hexSize, offsetX, offsetY, zoom, positionedHexes]
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
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!settings.doubleClickMove) return;

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
    [settings.doubleClickMove, getHexAtPoint, onHexDoubleClick]
  );

  // Handle mouse move for cursor
  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hex = getHexAtPoint(x, y);
      canvas.style.cursor = hex ? 'pointer' : 'default';
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
