import { describe, it, expect } from 'vitest';
import { calculateHexPosition, findHexAtPoint, isPointInHex } from '../../src/utils/hexRenderer';

describe('findHexAtPoint', () => {
  const size = 25;
  const hexes: Array<{ col: number; row: number; x: number; y: number }> = [];
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 12; col++) {
      hexes.push({ col, row, ...calculateHexPosition(col, row, size) });
    }
  }

  it('matches the brute-force geometric scan', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 5000; i++) {
      const x = rand() * 12 * size * 2 - size;
      const y = rand() * 12 * size * 1.6 - size;
      const expected = hexes.filter(h => isPointInHex(x, y, h.x, h.y, size));
      if (expected.length !== 1) continue; // exact edge or outside the grid
      expect(findHexAtPoint(x, y, hexes, size)).toBe(expected[0]);
    }
  });

  it('returns hex centers and null off-grid', () => {
    for (const h of hexes) expect(findHexAtPoint(h.x, h.y, hexes, size)).toBe(h);
    expect(findHexAtPoint(-500, -500, hexes, size)).toBeNull();
  });
});
