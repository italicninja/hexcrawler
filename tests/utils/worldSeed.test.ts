import { describe, it, expect } from 'vitest';
import { TerrainGenerator } from '../../src/terrainGenerator';
import { generateExpansionHexes } from '../../src/hooks/useInfiniteTerrainExpansion';
import { TERRAIN } from '../../src/constants/gameConstants';

const W = TERRAIN.MAP_INITIAL_WIDTH;
const H = TERRAIN.MAP_INITIAL_HEIGHT;

interface Hex {
  col: number;
  row: number;
  terrain: { key?: string; name: string };
  poi: unknown;
  weather: unknown;
}

/** Initial world (fixed size) as a coord → serialized-hex map. */
function initialWorld(seed: string) {
  const gen = new TerrainGenerator();
  gen.setSeed(seed);
  const { grid } = gen.generate(W, H, 0.5, 5);
  const hexes = new Map<string, string>();
  grid.forEach((cols, row) =>
    cols.forEach((h, col) =>
      hexes.set(`${col},${row}`, JSON.stringify([h.terrain.key, h.poi, h.weather]))
    )
  );
  return { gen, hexes };
}

function expand(
  gen: TerrainGenerator,
  seed: string,
  direction: string,
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }
) {
  gen.setSeed(seed); // the expansion hook re-seeds before every chunk
  return generateExpansionHexes(gen, direction, bounds, TERRAIN.EXPANSION_CHUNK_SIZE) as Hex[];
}

describe('world generation is a function of seed + coordinates only', () => {
  it('same seed with different viewport-driven expansion yields identical overlapping hexes', () => {
    const seed = 'dragon';
    const a = initialWorld(seed);
    const b = initialWorld(seed);
    expect([...a.hexes]).toEqual([...b.hexes]);

    // Small viewport: one chunk east. Large viewport: north first, then a taller east chunk
    // (so the east hexes are generated in a different order and chunk shape).
    const base = { minCol: 0, maxCol: W - 1, minRow: 0, maxRow: H - 1 };
    const eastA = expand(a.gen, seed, 'east', base);
    expand(b.gen, seed, 'north', base);
    const eastB = expand(b.gen, seed, 'east', { ...base, minRow: -TERRAIN.EXPANSION_CHUNK_SIZE });

    const bByKey = new Map(eastB.map(h => [`${h.col},${h.row}`, h]));
    expect(eastA.length).toBeGreaterThan(0);
    for (const h of eastA) {
      const other = bByKey.get(`${h.col},${h.row}`);
      expect(other).toBeDefined();
      expect([other!.terrain.name, other!.poi, other!.weather]).toEqual([
        h.terrain.name,
        h.poi,
        h.weather,
      ]);
    }
  });

  it('text seeds hash to a finite number (no NaN in the map)', () => {
    const { gen, hexes } = initialWorld('dragon');
    expect(Number.isFinite(gen.seed)).toBe(true);
    expect(gen.regions.every(r => Number.isFinite(r.centerHex.col))).toBe(true);
    for (const v of hexes.values()) expect(v).not.toContain('NaN');
    expect(new Set([...hexes.values()].map(v => JSON.parse(v)[0])).size).toBeGreaterThan(1);
  });

  it('different seeds give different worlds', () => {
    expect([...initialWorld('dragon').hexes]).not.toEqual([...initialWorld('wyvern').hexes]);
  });

  it('expanded hexes get regional weather, not a blanket clear-skies fallback', () => {
    const { gen } = initialWorld('dragon');
    const hexes = expand(gen, 'dragon', 'east', {
      minCol: 0,
      maxCol: W - 1,
      minRow: 0,
      maxRow: H - 1,
    });
    for (const h of hexes) {
      const nearest = gen.weatherSystem!.nearestRegionTo(h.col, h.row);
      expect((h.weather as { condition: string }).condition).toBe(nearest.weatherPattern!.name);
    }
  });
});
