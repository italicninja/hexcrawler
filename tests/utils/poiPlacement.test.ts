import { describe, it, expect } from 'vitest';
import { TerrainGenerator } from '../../src/terrainGenerator';
import { generateHex } from '../../src/utils/poiGenerationHelper';
import { getHexDistance } from '../../src/utils/hexMath';
import { POI_SPAWN, isSettlement } from '../../src/constants/gameConstants';

type Placed = { col: number; row: number; type: string };

const closestPair = (list: Placed[]) =>
  Math.min(
    ...list.flatMap((a, i) =>
      list.slice(i + 1).map(b => getHexDistance(a.col, a.row, b.col, b.row))
    )
  );

describe('POI placement', () => {
  it('keeps settlements apart and places dungeons on the starting map', () => {
    for (const seed of ['alpha', 'bravo', 'charlie']) {
      const gen = new TerrainGenerator();
      gen.setSeed(seed);
      const { grid } = gen.generate(60, 60, 0.5, 5);
      const pois: Placed[] = [];
      grid.forEach((r, row) =>
        r.forEach((h, col) => h.poi && pois.push({ col, row, type: h.poi.type as string }))
      );

      expect(closestPair(pois.filter(p => isSettlement(p.type)))).toBeGreaterThanOrEqual(
        POI_SPAWN.SETTLEMENT_MIN_SPACING
      );
      expect(pois.filter(p => p.type === 'dungeon').length).toBeGreaterThan(0);
    }
  });

  it('expansion land gets spaced settlements at roughly starting-map density', () => {
    const gen = new TerrainGenerator();
    gen.setSeed('expansion');
    gen.generate(60, 60, 0.5, 5); // initializes regions/weather used by generateHex
    const pois: Placed[] = [];
    for (let row = 0; row < 60; row++) {
      for (let col = 60; col < 120; col++) {
        const { poi } = generateHex(gen, col, row, 120, 60) as { poi: { type: string } | null };
        if (poi) pois.push({ col, row, type: poi.type });
      }
    }
    const settlements = pois.filter(p => isSettlement(p.type));

    expect(settlements.some(p => p.type !== 'camp')).toBe(true);
    expect(closestPair(settlements)).toBeGreaterThanOrEqual(POI_SPAWN.SETTLEMENT_MIN_SPACING);
    // Starting map runs ~150 POIs per 3600 hexes; the old flat 20% gave ~600.
    expect(pois.length).toBeGreaterThan(60);
    expect(pois.length).toBeLessThan(250);
  });
});
