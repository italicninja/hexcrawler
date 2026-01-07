/**
 * Hex Rendering Utilities
 *
 * Shared hex rendering functions used by both HexGridCanvas and InteriorHexCanvas.
 * Provides common geometry calculations, drawing functions, and hit detection.
 */

/**
 * Calculate the screen position (x, y) for a hex at grid coordinates (col, row)
 *
 * @param {number} col - Column coordinate
 * @param {number} row - Row coordinate
 * @param {number} hexSize - Size of the hex (radius)
 * @returns {Object} - {x, y} screen coordinates
 */
export function calculateHexPosition(col, row, hexSize) {
  const xSpacing = hexSize * Math.sqrt(3);
  const xOffset = Math.abs(row % 2) * (hexSize * Math.sqrt(3) / 2);
  const x = col * xSpacing + hexSize * 1.5 + xOffset;

  const ySpacing = hexSize * 1.5;
  const y = row * ySpacing + hexSize * 1.5;

  return { x, y };
}

/**
 * Draw a hexagon shape at the specified position
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} hexSize - Size of the hex (radius)
 * @param {string} fillStyle - Fill color (optional, if null won't fill)
 * @param {string} strokeStyle - Stroke color (optional, if null won't stroke)
 * @param {number} lineWidth - Stroke width (default 1)
 */
export function drawHexShape(ctx, x, y, hexSize, fillStyle = null, strokeStyle = '#333', lineWidth = 1) {
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
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} hexSize - Size of the hex (radius)
 * @param {string} color - Outline color
 * @param {number} width - Outline width
 */
export function drawHexOutline(ctx, x, y, hexSize, color = '#ff6b6b', width = 3) {
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
 *
 * @param {number} pointX - X coordinate of point to test
 * @param {number} pointY - Y coordinate of point to test
 * @param {number} hexX - Center X of hex
 * @param {number} hexY - Center Y of hex
 * @param {number} hexSize - Size of the hex (radius)
 * @returns {boolean} - True if point is inside hex
 */
export function isPointInHex(pointX, pointY, hexX, hexY, hexSize) {
  const dx = Math.abs(pointX - hexX);
  const dy = Math.abs(pointY - hexY);

  // Quick reject: outside bounding rectangle
  if (dx > hexSize * 0.866) return false;
  if (dy > hexSize) return false;

  // Precise check using hex geometry
  const check = (hexSize * Math.sqrt(3) / 2 * hexSize -
                 hexSize / 2 * dx -
                 hexSize * Math.sqrt(3) / 2 * dy);

  return check >= 0;
}

/**
 * Find a hex at a specific screen point from an array of positioned hexes
 *
 * @param {number} pointX - Screen X coordinate
 * @param {number} pointY - Screen Y coordinate
 * @param {Array} hexes - Array of hex objects with {x, y, ...} properties
 * @param {number} hexSize - Size of hexes
 * @returns {Object|null} - Hex object at point, or null if none found
 */
export function findHexAtPoint(pointX, pointY, hexes, hexSize) {
  for (const hex of hexes) {
    if (isPointInHex(pointX, pointY, hex.x, hex.y, hexSize)) {
      return hex;
    }
  }
  return null;
}

/**
 * Draw a player marker at a hex position
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} hexSize - Size of hex (for scaling marker)
 * @param {string} label - Text to display in marker (e.g., party size or "P")
 */
export function drawPlayerMarker(ctx, x, y, hexSize, label = 'P') {
  // Draw yellow circle
  ctx.beginPath();
  ctx.arc(x, y, hexSize * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw label text
  ctx.fillStyle = '#000';
  ctx.font = `bold ${hexSize * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}
