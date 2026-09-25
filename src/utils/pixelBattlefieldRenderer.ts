/**
 * Pixel-art combat battlefield: the ground (overworld terrain, or an interior theme
 * for POI fights), obstacle sprites, difficult-terrain dither and the centre landmark,
 * baked into one canvas per battlefield.
 */

import { ART_PX, calculateHexPosition, pixelToOffset } from './hexRenderer';
import { PixelTerrainRenderer, drawRaw, drawSprite, sprite } from './pixelTerrainRenderer';
import { renderInteriorFloor, interiorThemeFor, type PixelFloor } from './pixelInteriorRenderer';
import { drawLandmark } from './combatLandmarkRenderer';

interface BattleHex {
  col: number;
  row: number;
  terrain?: { key?: string };
  blocked?: boolean;
  difficultTerrain?: boolean;
  obstacleType?: string;
}

// POI battlefields get an interior theme; anything else is overworld terrain (keys may
// arrive as display names, e.g. "Forest"). River fields use grass ground (every hex
// being a river would be a channel maze).
const POI_TYPES = new Set(['dungeon', 'cave', 'lair', 'ruins', 'temple', 'shrine', 'tower', 'camp', 'village', 'town']);
const OVERWORLD: Record<string, string> = {
  grassland: 'grassland', plains: 'grassland', forest: 'forest', hills: 'hills', mountains: 'mountains',
  mountain: 'mountains', desert: 'desert', swamp: 'swamp', tundra: 'tundra', water: 'water', river: 'grassland',
};

export function renderBattlefield(hexes: readonly BattleHex[], r: number, landmarkKey?: string): PixelFloor {
  const key = (hexes[0]?.terrain?.key ?? 'grassland').toLowerCase();
  let floor: PixelFloor;

  if (!POI_TYPES.has(key)) {
    // Ground tiles only: overworld sprites (trees on every hex) would bury the tokens.
    const t = OVERWORLD[key] ?? 'grassland';
    const terrain = new PixelTerrainRenderer(hexes.map(h => ({ col: h.col, row: h.row, terrain: { key: t } })), r);
    const tiles = hexes.map(h => terrain.getTile(h.col, h.row));
    const x0 = Math.min(...tiles.map(t => t.x)), y0 = Math.min(...tiles.map(t => t.y));
    const x1 = Math.max(...tiles.map(t => t.x + t.ground.width * ART_PX));
    const y1 = Math.max(...tiles.map(t => t.y + t.ground.height * ART_PX));
    const canvas = document.createElement('canvas');
    canvas.width = (x1 - x0) / ART_PX;
    canvas.height = (y1 - y0) / ART_PX;
    const ctx = canvas.getContext('2d')!;
    for (const t of tiles) ctx.drawImage(t.ground, (t.x - x0) / ART_PX, (t.y - y0) / ART_PX);
    floor = { canvas, x: x0, y: y0 };
  } else {
    const walls = hexes.map(h => ({
      col: h.col,
      row: h.row,
      terrain: { key: h.blocked && h.obstacleType === 'wall' ? 'wall' : 'floor' },
    }));
    floor = renderInteriorFloor(walls, interiorThemeFor(key), r, { grid: true });
  }

  const ctx = floor.canvas.getContext('2d')!;
  const toArt = (h: BattleHex) => {
    const p = calculateHexPosition(h.col, h.row, r);
    return [Math.round((p.x - floor.x) / ART_PX), Math.round((p.y - floor.y) / ART_PX)];
  };

  // Difficult terrain: a sparse yellow dither over the hex's own pixels
  ctx.fillStyle = 'rgba(240, 216, 90, 0.35)';
  for (const h of hexes) {
    if (!h.difficultTerrain) continue;
    const [cx, cy] = toArt(h), lr = Math.ceil(r / ART_PX);
    for (let j = cy - lr; j <= cy + lr; j++) for (let i = cx - lr; i <= cx + lr; i++) {
      if ((i + j) % 3) continue;
      const o = pixelToOffset(floor.x + (i + 0.5) * ART_PX, floor.y + (j + 0.5) * ART_PX, r);
      if (o.col === h.col && o.row === h.row) ctx.fillRect(i, j, 1, 1);
    }
  }

  // Landmark: the vector art rasterised at art resolution with hard alpha, so it reads as pixels
  if (landmarkKey) {
    const tmp = document.createElement('canvas');
    tmp.width = floor.canvas.width;
    tmp.height = floor.canvas.height;
    const tctx = tmp.getContext('2d')!;
    tctx.setTransform(1 / ART_PX, 0, 0, 1 / ART_PX, -floor.x / ART_PX, -floor.y / ART_PX);
    const c = calculateHexPosition(9, 9, r);
    drawLandmark(tctx, c.x, c.y, r * 2.5, landmarkKey);
    const img = tctx.getImageData(0, 0, tmp.width, tmp.height), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
    tctx.putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  }

  // Obstacles (walls are already part of an interior floor), top to bottom
  for (const h of [...hexes].sort((a, b) => a.row - b.row || a.col - b.col)) {
    if (!h.blocked || h.obstacleType === 'wall') continue;
    const [cx, cy] = toArt(h), by = cy + 4;
    switch (h.obstacleType) {
      case 'tree':
        drawSprite(ctx, sprite('tree', 5), cx - 3, by);
        drawSprite(ctx, sprite('pine', 10), cx + 4, by + 1);
        break;
      case 'reed':
        for (const dx of [-4, -2, 0, 2, 4]) drawRaw(ctx, dx % 4 ? 'reed' : 'reedTall', cx + dx, by - (dx % 4 ? 1 : 0));
        break;
      case 'ice':
        drawRaw(ctx, 'ice', cx, by);
        break;
      case 'dune':
        drawRaw(ctx, 'dune', cx, by);
        break;
      default: // rock, boulder
        drawRaw(ctx, 'boulder', cx, by);
        drawSprite(ctx, sprite('rock', 0), cx + 4, by + 1);
    }
  }
  return floor;
}
