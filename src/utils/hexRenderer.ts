/**
 * Hex Rendering Utilities
 *
 * Shared hex rendering functions used by both HexGridCanvas and InteriorHexCanvas.
 * Provides common geometry calculations, drawing functions, and hit detection.
 */

import { cubeToOffset } from './hexMath';
import type { HexCoordinates } from '../types/game';

interface HexPosition {
  x: number;
  y: number;
}

interface HexObject {
  col: number;
  row: number;
}

/**
 * Calculate the screen position (x, y) for a hex at grid coordinates (col, row)
 */
export function calculateHexPosition(col: number, row: number, hexSize: number): HexPosition {
  const xSpacing = hexSize * Math.sqrt(3);
  const xOffset = Math.abs(row % 2) * ((hexSize * Math.sqrt(3)) / 2);
  const x = col * xSpacing + hexSize * 1.5 + xOffset;

  const ySpacing = hexSize * 1.5;
  const y = row * ySpacing + hexSize * 1.5;

  return { x, y };
}

/**
 * Size a canvas backing store for crisp rendering on HiDPI screens.
 * Draw code should then `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` and work in CSS pixels.
 * Setting canvas.width clears the canvas, so callers must redraw afterwards.
 */
export function sizeCanvasForDpr(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
}

/**
 * Draw a hexagon shape at the specified position
 */
export function drawHexShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  fillStyle: string | CanvasGradient | CanvasPattern | null = null,
  strokeStyle: string | null = '#333',
  lineWidth: number = 1
): void {
  ctx.beginPath();

  // Draw 6 sides of hex
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const hx = x + hexSize * Math.cos(angle);
    const hy = y + hexSize * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(hx, hy);
    } else {
      ctx.lineTo(hx, hy);
    }
  }

  ctx.closePath();

  // Fill if color provided
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  // Stroke if color provided
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/** CSS pixels per art pixel for all pixel-art rendering (terrain, icons, outlines). */
export const ART_PX = 2;

// Art-pixel sets per hex, keyed by col,row,size,thickness (0 = whole hex)
const pixelHexCache = new Map<string, Path2D>();

/** The hex's pixels on the world art grid: its edge ring `thick` px deep, or all of it for 0. */
function pixelHexPath(x: number, y: number, hexSize: number, thick: number): Path2D {
  const { col, row } = pixelToOffset(x, y, hexSize);
  const key = `${col},${row},${hexSize},${thick}`;
  let path = pixelHexCache.get(key);
  if (path) return path;
  path = new Path2D();
  const own = (i: number, j: number) => {
    const o = pixelToOffset((i + 0.5) * ART_PX, (j + 0.5) * ART_PX, hexSize);
    return o.col === col && o.row === row;
  };
  const i0 = Math.floor((x - hexSize) / ART_PX) - 1, i1 = Math.ceil((x + hexSize) / ART_PX) + 1;
  const j0 = Math.floor((y - hexSize) / ART_PX) - 1, j1 = Math.ceil((y + hexSize) / ART_PX) + 1;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (!own(i, j)) continue;
      let hit = thick === 0;
      for (let k = 1; k <= thick && !hit; k++) {
        hit = !own(i + k, j) || !own(i - k, j) || !own(i, j + k) || !own(i, j - k);
      }
      if (hit) path.rect(i * ART_PX, j * ART_PX, ART_PX, ART_PX);
    }
  }
  pixelHexCache.set(key, path);
  return path;
}

/**
 * Draw a hex outline (selection / hover) as art pixels on the world art grid, so it
 * follows the same stepped edge as the pixel terrain. `width` >= 3 draws 2 art px thick.
 */
export function drawHexOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  color: string = '#ff6b6b',
  width: number = 3
): void {
  ctx.fillStyle = color;
  ctx.fill(pixelHexPath(x, y, hexSize, width >= 3 ? 2 : 1));
}

/** Fill a hex's art pixels (range overlays), matching the pixel terrain's stepped edges. */
export function fillPixelHex(ctx: CanvasRenderingContext2D, x: number, y: number, hexSize: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fill(pixelHexPath(x, y, hexSize, 0));
}

/**
 * Check if a point (x, y) is inside a hexagon
 *
 * Uses distance-based approximation for hex hit detection.
 */
export function isPointInHex(
  pointX: number,
  pointY: number,
  hexX: number,
  hexY: number,
  hexSize: number
): boolean {
  const dx = Math.abs(pointX - hexX);
  const dy = Math.abs(pointY - hexY);

  // Quick reject: outside bounding rectangle
  if (dx > hexSize * 0.866) return false;
  if (dy > hexSize) return false;

  // Precise check using hex geometry
  const check =
    ((hexSize * Math.sqrt(3)) / 2) * hexSize -
    (hexSize / 2) * dx -
    ((hexSize * Math.sqrt(3)) / 2) * dy;

  return check >= 0;
}

/**
 * Inverse of calculateHexPosition: the offset (col, row) of the hex containing a
 * world-space point. Pointy-top, odd rows shifted right (odd-r).
 */
export function pixelToOffset(pointX: number, pointY: number, hexSize: number): HexCoordinates {
  const px = pointX - hexSize * 1.5;
  const py = pointY - hexSize * 1.5;
  // Fractional axial coords, then cube-round to the nearest hex
  const q = ((Math.sqrt(3) / 3) * px - py / 3) / hexSize;
  const r = ((2 / 3) * py) / hexSize;
  let rx = Math.round(q);
  let rz = Math.round(r);
  const ry = Math.round(-q - r);
  const dx = Math.abs(rx - q);
  const dy = Math.abs(ry - (-q - r));
  const dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  return cubeToOffset(rx, -rx - rz, rz);
}

// Per-array col,row index, built lazily; callers pass memoized arrays.
const hexIndexCache = new WeakMap<readonly HexObject[], Map<string, HexObject>>();

/**
 * Find the hex at a world-space point: O(1) hex math + index lookup.
 */
export function findHexAtPoint<T extends HexObject>(
  pointX: number,
  pointY: number,
  hexes: readonly T[],
  hexSize: number
): T | null {
  let index = hexIndexCache.get(hexes);
  if (!index) {
    index = new Map(hexes.map(h => [`${h.col},${h.row}`, h]));
    hexIndexCache.set(hexes, index);
  }
  const { col, row } = pixelToOffset(pointX, pointY, hexSize);
  return (index.get(`${col},${row}`) as T | undefined) ?? null;
}
