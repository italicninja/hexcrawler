import { describe, it, expect } from 'vitest';
import { artHexCenter, artPixelHex, ART_HEX_RADIUS } from '../../src/utils/pixelArt/core';
import { themeForPoi } from '../../src/utils/pixelArt/interiorArt';
import { PixelTerrainRenderer } from '../../src/utils/pixelArt/terrainTiles';

describe('pixelArt', () => {
  it('assigns every art pixel to exactly one hex, and hex centres to themselves', () => {
    // Tiles only paint pixels that map back to their own hex, so this is what keeps
    // neighbouring tiles from leaving gaps or overlapping.
    for (const [col, row] of [
      [0, 0],
      [3, 1],
      [-2, -3],
      [7, 4],
    ]) {
      const c = artHexCenter(col, row);
      expect(artPixelHex(Math.floor(c.x), Math.floor(c.y))).toEqual({ col, row });
    }
    let counted = 0;
    for (let j = 0; j < 60; j++)
      for (let i = 0; i < 60; i++) {
        const h = artPixelHex(i, j);
        const c = artHexCenter(h.col, h.row);
        // The owning hex centre is always within one hex radius of the pixel
        expect(Math.hypot(i + 0.5 - c.x, j + 0.5 - c.y)).toBeLessThanOrEqual(ART_HEX_RADIUS + 0.01);
        counted++;
      }
    expect(counted).toBe(3600);
  });

  it('maps interior POI types to themes', () => {
    expect(themeForPoi('cave')).toBe('cave');
    expect(themeForPoi('village')).toBe('town');
    expect(themeForPoi('tower')).toBe('tower');
    expect(themeForPoi(undefined)).toBe('dungeon');
  });

  it('reports failure instead of throwing when no 2D canvas is available', () => {
    const r = new PixelTerrainRenderer(1);
    const ctx = { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
    // jsdom has no canvas 2D context, so the tile can't render and the caller falls back
    expect(r.drawHex(ctx, 0, 0, 'grassland', 0, 0, 30, () => 'grassland')).toBe(false);
  });
});
