/**
 * combatLandmarkRenderer - Pure canvas landmark centerpiece renderers for combat battlefield.
 * Each function draws a signature terrain landmark at the given pixel position.
 * All functions are pure: (ctx, cx, cy, hexSize) => void — no side effects.
 */

// ============================================================================
// Individual landmark drawers
// ============================================================================

/** Ancient gnarled tree (forest) */
function drawAncientTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  // Thick gnarled trunk
  ctx.fillStyle = '#5C3A1E';
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.6, s * 0.18, s * 0.5, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Three layered canopy circles
  const layers = [
    { dx: -s * 0.25, dy: -s * 0.1, r: s * 0.38, color: '#1a5c1a' },
    { dx: s * 0.2, dy: -s * 0.25, r: s * 0.32, color: '#1e6b1e' },
    { dx: 0, dy: -s * 0.45, r: s * 0.44, color: '#237523' },
  ];
  layers.forEach(({ dx, dy, r, color }) => {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  // Moss patches
  ctx.fillStyle = 'rgba(100, 160, 60, 0.3)';
  ctx.beginPath();
  ctx.arc(cx - s * 0.3, cy + s * 0.2, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Rocky mountain spire (mountains/hills) */
function drawRockSpire(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  // Base boulders
  ctx.fillStyle = '#7a7a7a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.5, s * 0.55, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main spire
  ctx.fillStyle = '#8a8a8a';
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.7);
  ctx.lineTo(cx - s * 0.28, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.28, cy + s * 0.3);
  ctx.closePath();
  ctx.fill();
  // Snow cap
  ctx.fillStyle = '#e8e8f0';
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.7);
  ctx.lineTo(cx - s * 0.1, cy - s * 0.45);
  ctx.lineTo(cx + s * 0.1, cy - s * 0.45);
  ctx.closePath();
  ctx.fill();
  // Shadow side
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.28, cy + s * 0.3);
  ctx.lineTo(cx, cy + s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** River channel cutting diagonally (river/water) */
function drawRiverChannel(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  // Water body
  ctx.fillStyle = 'rgba(60, 120, 200, 0.5)';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.8, cy - s * 0.6);
  ctx.bezierCurveTo(
    cx - s * 0.2,
    cy - s * 0.2,
    cx + s * 0.2,
    cy + s * 0.2,
    cx + s * 0.8,
    cy + s * 0.6
  );
  ctx.lineTo(cx + s * 0.55, cy + s * 0.6);
  ctx.bezierCurveTo(cx, cy + s * 0.1, cx - s * 0.1, cy - s * 0.1, cx - s * 0.55, cy - s * 0.6);
  ctx.closePath();
  ctx.fill();
  // Ripple lines
  ctx.strokeStyle = 'rgba(180, 210, 255, 0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const x1 = cx - s * 0.6 + t * s * 0.5;
    const y1 = cy - s * 0.4 + t * s * 0.4;
    ctx.beginPath();
    ctx.arc(x1, y1, s * 0.08, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/** Murky sunken ruin (swamp) */
function drawSwampRuin(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  // Dark water pool
  ctx.fillStyle = 'rgba(40, 55, 25, 0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.2, s * 0.65, s * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // Broken pillar stumps
  ctx.fillStyle = '#5a5040';
  (
    [
      [-s * 0.35, -s * 0.1],
      [s * 0.3, -s * 0.05],
      [0, -s * 0.25],
    ] as [number, number][]
  ).forEach(([dx, dy]) => {
    ctx.fillRect(cx + dx - s * 0.06, cy + dy, s * 0.12, s * 0.3);
  });
  // Vine overlay
  ctx.strokeStyle = 'rgba(60, 90, 30, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.4, cy - s * 0.3);
  ctx.quadraticCurveTo(cx, cy - s * 0.5, cx + s * 0.35, cy - s * 0.1);
  ctx.stroke();
  ctx.restore();
}

/** Desert stone obelisk (desert) */
function drawObelisk(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  // Base slab
  ctx.fillStyle = '#b8962e';
  ctx.fillRect(cx - s * 0.3, cy + s * 0.4, s * 0.6, s * 0.15);
  // Shaft
  ctx.fillStyle = '#c8a040';
  ctx.fillRect(cx - s * 0.1, cy - s * 0.5, s * 0.2, s * 0.9);
  // Pointed cap
  ctx.fillStyle = '#d8b050';
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.7);
  ctx.lineTo(cx - s * 0.1, cy - s * 0.5);
  ctx.lineTo(cx + s * 0.1, cy - s * 0.5);
  ctx.closePath();
  ctx.fill();
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(cx + s * 0.1, cy - s * 0.5, s * 0.12, s * 0.9);
  ctx.restore();
}

/** Frozen pond with ice chunks (tundra) */
function drawFrozenPond(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  // Pond base
  ctx.fillStyle = '#aaccdd';
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.1, s * 0.6, s * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ice crack lines
  ctx.strokeStyle = 'rgba(180, 210, 230, 0.7)';
  ctx.lineWidth = 1;
  (
    [
      [cx - s * 0.2, cy, cx + s * 0.15, cy + s * 0.2],
      [cx, cy - s * 0.15, cx + s * 0.25, cy + s * 0.1],
      [cx - s * 0.3, cy + s * 0.1, cx, cy - s * 0.05],
    ] as [number, number, number, number][]
  ).forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  // Snow mound at top
  ctx.fillStyle = '#e8f0f5';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.22, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

/** Default: simple stone circle (fallback for plains/grassland/unknown) */
function drawStoneCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  const stones = 6;
  const r = s * 0.45;
  for (let i = 0; i < stones; i++) {
    const angle = (i / stones) * Math.PI * 2;
    const sx = cx + Math.cos(angle) * r;
    const sy = cy + Math.sin(angle) * r;
    ctx.fillStyle = '#888880';
    ctx.beginPath();
    ctx.ellipse(sx, sy, s * 0.1, s * 0.14, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555550';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================
// Public dispatcher
// ============================================================================

/**
 * Draw a terrain-appropriate landmark centerpiece at (cx, cy) in world space.
 * cx, cy are the pixel center of the desired hex.
 * s is a scale factor — pass HEX_SIZE * 2.5 for a nice landmark size.
 *
 * Returns true if a landmark was drawn.
 */
export function drawLandmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  terrainKey: string
): boolean {
  const key = terrainKey.toLowerCase();

  if (key === 'forest') {
    drawAncientTree(ctx, cx, cy, s);
    return true;
  }
  if (key === 'mountains' || key === 'mountain' || key === 'hills') {
    drawRockSpire(ctx, cx, cy, s);
    return true;
  }
  if (key === 'river' || key === 'water') {
    drawRiverChannel(ctx, cx, cy, s);
    return true;
  }
  if (key === 'swamp') {
    drawSwampRuin(ctx, cx, cy, s);
    return true;
  }
  if (key === 'desert') {
    drawObelisk(ctx, cx, cy, s);
    return true;
  }
  if (key === 'tundra') {
    drawFrozenPond(ctx, cx, cy, s);
    return true;
  }

  // Fallback for plains/grassland/unknown — subtle stone circle
  drawStoneCircle(ctx, cx, cy, s);
  return true;
}
