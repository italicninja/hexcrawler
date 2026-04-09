import { describe, it, expect } from 'vitest';
import {
  offsetToCube,
  cubeToOffset,
  getHexDistance,
  getHexNeighbors,
  getHexesInRadius,
  isHexReachable,
} from '../../src/utils/hexMath';

// ─── offsetToCube ────────────────────────────────────────────────────────────

describe('offsetToCube()', () => {
  it('returns an object with x, y, z', () => {
    const result = offsetToCube(0, 0);
    expect(result).toHaveProperty('x');
    expect(result).toHaveProperty('y');
    expect(result).toHaveProperty('z');
  });

  it('converts (0, 0) to cube (0, 0, 0)', () => {
    const { x, y, z } = offsetToCube(0, 0);
    // Use == 0 to treat -0 and +0 as equal (JS -0 issue with Object.is)
    expect(x == 0).toBe(true);
    expect(y == 0).toBe(true);
    expect(z == 0).toBe(true);
  });

  it('satisfies the cube constraint x + y + z === 0', () => {
    const coords = [
      [0, 0],
      [1, 0],
      [0, 1],
      [5, 3],
      [-2, 4],
      [10, 7],
    ];
    for (const [col, row] of coords) {
      const { x, y, z } = offsetToCube(col, row);
      expect(x + y + z).toBe(0);
    }
  });
});

// ─── cubeToOffset ────────────────────────────────────────────────────────────

describe('cubeToOffset()', () => {
  it('returns an object with col and row', () => {
    const result = cubeToOffset(0, 0, 0);
    expect(result).toHaveProperty('col');
    expect(result).toHaveProperty('row');
  });

  it('converts cube (0, 0, 0) to offset (0, 0)', () => {
    const { col, row } = cubeToOffset(0, 0, 0);
    expect(col).toBe(0);
    expect(row).toBe(0);
  });
});

// ─── Round-trip: offsetToCube → cubeToOffset ─────────────────────────────────

describe('offsetToCube / cubeToOffset round-trip', () => {
  const testCoords = [
    [0, 0],
    [1, 0],
    [0, 1],
    [5, 3],
    [10, 7],
    [-2, 4],
    [3, -1],
  ];

  it.each(testCoords)('round-trips (%i, %i)', (col, row) => {
    const cube = offsetToCube(col, row);
    const back = cubeToOffset(cube.x, cube.y, cube.z);
    expect(back.col).toBe(col);
    expect(back.row).toBe(row);
  });
});

// ─── getHexDistance ──────────────────────────────────────────────────────────

describe('getHexDistance()', () => {
  it('returns 0 for the same hex', () => {
    expect(getHexDistance(3, 4, 3, 4)).toBe(0);
  });

  it('returns 1 for directly adjacent hexes (even row)', () => {
    // Moving one column right on an even row should be distance 1
    expect(getHexDistance(0, 0, 1, 0)).toBe(1);
  });

  it('is symmetric', () => {
    expect(getHexDistance(2, 3, 5, 7)).toBe(getHexDistance(5, 7, 2, 3));
  });

  it('returns an integer for valid hex coords', () => {
    const result = getHexDistance(0, 0, 4, 4);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('returns larger values for more distant hexes', () => {
    const d1 = getHexDistance(0, 0, 1, 0);
    const d2 = getHexDistance(0, 0, 5, 0);
    expect(d2).toBeGreaterThan(d1);
  });

  it('never returns a negative value', () => {
    const coords: Array<[number, number, number, number]> = [
      [0, 0, 3, 3],
      [-5, -3, 2, 4],
      [10, 7, 0, 0],
    ];
    for (const [c1, r1, c2, r2] of coords) {
      expect(getHexDistance(c1, r1, c2, r2)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── getHexNeighbors ─────────────────────────────────────────────────────────

describe('getHexNeighbors()', () => {
  it('always returns exactly 6 neighbors', () => {
    const testCases = [
      [0, 0],
      [1, 0],
      [0, 1],
      [5, 3],
      [10, 7],
    ];
    for (const [col, row] of testCases) {
      const neighbors = getHexNeighbors(col, row);
      expect(neighbors).toHaveLength(6);
    }
  });

  it('each neighbor has col and row properties', () => {
    const neighbors = getHexNeighbors(0, 0);
    for (const n of neighbors) {
      expect(n).toHaveProperty('col');
      expect(n).toHaveProperty('row');
    }
  });

  it('each neighbor is distance 1 from center', () => {
    const center = { col: 5, row: 4 };
    const neighbors = getHexNeighbors(center.col, center.row);
    for (const n of neighbors) {
      expect(getHexDistance(center.col, center.row, n.col, n.row)).toBe(1);
    }
  });

  it('returns unique neighbors (no duplicates)', () => {
    const neighbors = getHexNeighbors(3, 3);
    const keys = neighbors.map(n => `${n.col},${n.row}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(6);
  });

  it('works on even rows', () => {
    const neighbors = getHexNeighbors(4, 2); // even row
    expect(neighbors).toHaveLength(6);
  });

  it('works on odd rows', () => {
    const neighbors = getHexNeighbors(4, 3); // odd row
    expect(neighbors).toHaveLength(6);
  });
});

// ─── getHexesInRadius ────────────────────────────────────────────────────────

describe('getHexesInRadius()', () => {
  it('radius 0 returns only the center hex', () => {
    const hexes = getHexesInRadius(3, 3, 0);
    expect(hexes).toHaveLength(1);
    expect(hexes[0]).toEqual({ col: 3, row: 3 });
  });

  it('radius 1 returns center + 6 neighbors = 7 hexes', () => {
    const hexes = getHexesInRadius(5, 5, 1);
    expect(hexes).toHaveLength(7);
  });

  it('all returned hexes are within the requested radius', () => {
    const center = { col: 4, row: 4 };
    const radius = 3;
    const hexes = getHexesInRadius(center.col, center.row, radius);
    for (const h of hexes) {
      const d = getHexDistance(center.col, center.row, h.col, h.row);
      expect(d).toBeLessThanOrEqual(radius);
    }
  });

  it('includes the center hex', () => {
    const hexes = getHexesInRadius(2, 2, 2);
    expect(hexes.some(h => h.col === 2 && h.row === 2)).toBe(true);
  });

  it('result size grows with radius', () => {
    const r1 = getHexesInRadius(0, 0, 1).length;
    const r2 = getHexesInRadius(0, 0, 2).length;
    const r3 = getHexesInRadius(0, 0, 3).length;
    expect(r2).toBeGreaterThan(r1);
    expect(r3).toBeGreaterThan(r2);
  });

  it('each result has col and row', () => {
    const hexes = getHexesInRadius(0, 0, 2);
    for (const h of hexes) {
      expect(h).toHaveProperty('col');
      expect(h).toHaveProperty('row');
    }
  });
});

// ─── isHexReachable ──────────────────────────────────────────────────────────

describe('isHexReachable()', () => {
  it('same hex is always reachable (moveDistance 0)', () => {
    expect(isHexReachable(3, 3, 3, 3, 0)).toBe(true);
  });

  it('returns true when distance <= moveDistance', () => {
    expect(isHexReachable(0, 0, 1, 0, 1)).toBe(true);
  });

  it('returns false when distance > moveDistance', () => {
    expect(isHexReachable(0, 0, 10, 0, 3)).toBe(false);
  });

  it('returns true at the exact boundary', () => {
    const dist = getHexDistance(0, 0, 3, 0);
    expect(isHexReachable(0, 0, 3, 0, dist)).toBe(true);
  });
});
