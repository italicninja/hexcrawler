/**
 * combatWeatherRenderer - Pure canvas weather effect renderers for combat battlefield
 * Each function draws a weather effect overlay on the canvas.
 * All functions are pure: (ctx, width, height, timestamp) => void — no side effects.
 */

export interface WeatherRenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Draw animated rain streaks
 */
export function drawRainOverlay({ ctx, width, height, timestamp }: WeatherRenderParams): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(174, 194, 224, 0.35)';
  ctx.lineWidth = 1;

  const count = 60;
  const speed = 0.18; // pixels per ms fraction

  for (let i = 0; i < count; i++) {
    const seed = i * 137.508; // golden angle spacing
    const x = ((seed * 73 + timestamp * speed * 0.8) % (width + 40)) - 20;
    const yBase = (seed * 53 + timestamp * speed * 1.2) % (height + 60);
    const length = 8 + (i % 5) * 3;

    ctx.beginPath();
    ctx.moveTo(x, yBase % height);
    ctx.lineTo(x - 2, (yBase + length) % height);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw animated snow particles
 */
export function drawSnowOverlay({ ctx, width, height, timestamp }: WeatherRenderParams): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

  const count = 50;
  const speed = 0.04;

  for (let i = 0; i < count; i++) {
    const seed = i * 137.508;
    const x = (((seed * 61 + Math.sin(timestamp * 0.0005 + i) * 20) % width) + width) % width;
    const y =
      (((seed * 47 + timestamp * speed * (0.5 + (i % 3) * 0.3)) % height) + height) % height;
    const r = 1 + (i % 3) * 0.5;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw fog overlay — semi-transparent white vignette that pulses slowly
 */
export function drawFogOverlay({ ctx, width, height, timestamp }: WeatherRenderParams): void {
  ctx.save();
  const pulse = Math.sin(timestamp * 0.0003) * 0.04 + 0.18;
  ctx.fillStyle = `rgba(220, 225, 230, ${pulse})`;
  ctx.fillRect(0, 0, width, height);

  // Denser fog at edges (vignette)
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.2,
    width / 2,
    height / 2,
    height * 0.8
  );
  gradient.addColorStop(0, 'rgba(220, 225, 230, 0)');
  gradient.addColorStop(1, `rgba(200, 210, 220, ${pulse + 0.12})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

/**
 * Draw storm overlay — rain + darkening + lightning flash occasionally
 */
export function drawStormOverlay({ ctx, width, height, timestamp }: WeatherRenderParams): void {
  // Darker ambient
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 20, 0.15)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Heavy rain (denser than normal rain)
  drawRainOverlay({ ctx, width, height, timestamp });

  ctx.save();
  ctx.strokeStyle = 'rgba(174, 194, 224, 0.25)';
  ctx.lineWidth = 1.5;
  const count = 40;
  const speed = 0.25;
  for (let i = 0; i < count; i++) {
    const seed = i * 137.508 + 500;
    const x = ((seed * 79 + timestamp * speed) % (width + 40)) - 20;
    const yBase = (seed * 59 + timestamp * speed * 1.4) % (height + 60);
    const length = 12 + (i % 4) * 4;
    ctx.beginPath();
    ctx.moveTo(x, yBase % height);
    ctx.lineTo(x - 3, (yBase + length) % height);
    ctx.stroke();
  }

  // Occasional lightning flash (every ~5 seconds)
  const flashCycle = (timestamp % 5000) / 5000;
  if (flashCycle < 0.04) {
    const flashAlpha = (1 - flashCycle / 0.04) * 0.3;
    ctx.fillStyle = `rgba(220, 230, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

/**
 * Draw heat shimmer — subtle vertical distortion tint for hot/arid conditions
 */
export function drawHeatOverlay({ ctx, width, height, timestamp }: WeatherRenderParams): void {
  ctx.save();
  const pulse = Math.sin(timestamp * 0.0008) * 0.02 + 0.05;
  ctx.fillStyle = `rgba(255, 180, 60, ${pulse})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Resolve and draw the appropriate weather overlay based on weather condition string.
 * Returns true if any overlay was drawn.
 */
export function drawWeatherOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timestamp: number,
  weatherCondition: string
): boolean {
  const condition = weatherCondition.toLowerCase();

  if (condition.includes('storm') || condition.includes('thunder')) {
    drawStormOverlay({ ctx, width, height, timestamp });
    return true;
  }
  if (condition.includes('heavy rain')) {
    drawStormOverlay({ ctx, width, height, timestamp });
    return true;
  }
  if (condition.includes('rain') || condition.includes('drizzle')) {
    drawRainOverlay({ ctx, width, height, timestamp });
    return true;
  }
  if (condition.includes('snow') || condition.includes('blizzard')) {
    drawSnowOverlay({ ctx, width, height, timestamp });
    return true;
  }
  if (condition.includes('fog') || condition.includes('mist')) {
    drawFogOverlay({ ctx, width, height, timestamp });
    return true;
  }
  if (condition.includes('hot') || condition.includes('arid') || condition.includes('heat')) {
    drawHeatOverlay({ ctx, width, height, timestamp });
    return true;
  }

  return false; // Clear/unknown — no overlay
}
