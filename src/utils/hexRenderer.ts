/**
 * Hex Rendering Utilities
 *
 * Shared hex rendering functions used by both HexGridCanvas and InteriorHexCanvas.
 * Provides common geometry calculations, drawing functions, and hit detection.
 */

interface HexPosition {
  x: number;
  y: number;
}

interface HexObject {
  x: number;
  y: number;
  [key: string]: unknown;
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
 * Draw a hexagon shape at the specified position
 */
export function drawHexShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  fillStyle: string | null = null,
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

/**
 * Draw a hexagon outline at the specified position (for selection/highlighting)
 */
export function drawHexOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  color: string = '#ff6b6b',
  width: number = 3
): void {
  ctx.beginPath();

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
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
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
 * Find a hex at a specific screen point from an array of positioned hexes
 */
export function findHexAtPoint(
  pointX: number,
  pointY: number,
  hexes: HexObject[],
  hexSize: number
): HexObject | null {
  for (const hex of hexes) {
    if (isPointInHex(pointX, pointY, hex.x, hex.y, hexSize)) {
      return hex;
    }
  }
  return null;
}

/**
 * Draw a player marker at a hex position
 */
export function drawPlayerMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hexSize: number,
  label: string = 'P'
): void {
  // Draw yellow circle
  ctx.beginPath();
  ctx.arc(x, y, hexSize * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw label (emoji or text) — serif renders emoji correctly on canvas
  ctx.font = `${hexSize * 0.55}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}
