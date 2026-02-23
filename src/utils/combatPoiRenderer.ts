/**
 * combatPoiRenderer - Pure canvas POI ambient effect renderers for combat battlefield.
 * These draw atmospheric/thematic overlays that complement the terrain when fighting at a POI.
 * All functions are pure: (ctx, width, height, timestamp) => void
 */

export interface PoiRenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Dungeon/cave: deep darkness at edges, torchlight orange ambient
 */
export function drawDungeonAmbient({ ctx, width, height, timestamp }: PoiRenderParams): void {
  ctx.save();
  // Dark vignette
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.15,
    width / 2,
    height / 2,
    height * 0.75
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  // Torchlight warm flicker
  const flicker = Math.sin(timestamp * 0.003 + 1.2) * 0.015 + 0.06;
  ctx.fillStyle = `rgba(200, 120, 40, ${flicker})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Ruins: dusty sepia tint + slow dust motes
 */
export function drawRuinsAmbient({ ctx, width, height, timestamp }: PoiRenderParams): void {
  ctx.save();
  ctx.fillStyle = 'rgba(160, 130, 90, 0.10)';
  ctx.fillRect(0, 0, width, height);
  // Dust motes
  ctx.fillStyle = 'rgba(210, 190, 150, 0.4)';
  for (let i = 0; i < 20; i++) {
    const seed = i * 137.5;
    const x = (((seed * 61 + Math.sin(timestamp * 0.0002 + i) * 15) % width) + width) % width;
    const y = (((seed * 47 + timestamp * 0.01 * (0.3 + (i % 3) * 0.2)) % height) + height) % height;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + (i % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Temple/shrine: holy golden glow at center, cool blue edges
 */
export function drawTempleAmbient({ ctx, width, height, timestamp }: PoiRenderParams): void {
  ctx.save();
  const pulse = Math.sin(timestamp * 0.0005) * 0.02 + 0.07;
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    height * 0.6
  );
  grad.addColorStop(0, `rgba(255, 220, 120, ${pulse})`);
  grad.addColorStop(0.6, 'rgba(180, 160, 220, 0.04)');
  grad.addColorStop(1, 'rgba(100, 100, 180, 0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Village/town: warm daylight, slight golden tint
 */
export function drawVillageAmbient({ ctx, width, height, timestamp }: PoiRenderParams): void {
  ctx.save();
  const pulse = Math.sin(timestamp * 0.0004) * 0.01 + 0.04;
  ctx.fillStyle = `rgba(255, 230, 160, ${pulse})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Bandit camp/lair: smoky dark, greenish-gray
 */
export function drawCampAmbient({ ctx, width, height, timestamp }: PoiRenderParams): void {
  ctx.save();
  ctx.fillStyle = 'rgba(40, 50, 30, 0.10)';
  ctx.fillRect(0, 0, width, height);
  // Smoke wisps
  ctx.strokeStyle = 'rgba(100, 110, 90, 0.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const baseX = width * 0.2 + i * (width * 0.15);
    const offsetX = Math.sin(timestamp * 0.0006 + i * 1.3) * 8;
    ctx.beginPath();
    ctx.moveTo(baseX, height);
    ctx.quadraticCurveTo(baseX + offsetX, height * 0.6, baseX + offsetX * 1.5, height * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Dispatch the correct POI ambient based on poiType.
 * Returns true if an overlay was drawn.
 */
export function drawPoiAmbient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timestamp: number,
  poiType: string
): boolean {
  const type = poiType.toLowerCase();

  if (type === 'dungeon' || type === 'cave') {
    drawDungeonAmbient({ ctx, width, height, timestamp });
    return true;
  }
  if (type === 'ruins' || type === 'tower') {
    drawRuinsAmbient({ ctx, width, height, timestamp });
    return true;
  }
  if (type === 'temple' || type === 'shrine') {
    drawTempleAmbient({ ctx, width, height, timestamp });
    return true;
  }
  if (type === 'village' || type === 'town') {
    drawVillageAmbient({ ctx, width, height, timestamp });
    return true;
  }
  if (type === 'camp' || type === 'lair') {
    drawCampAmbient({ ctx, width, height, timestamp });
    return true;
  }

  return false;
}
