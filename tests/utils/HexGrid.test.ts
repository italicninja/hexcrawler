import { describe, it, expect, beforeEach } from 'vitest';
import { HexGrid } from '../../src/utils/HexGrid';
import type { Hex } from '../../src/types/game';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeHex(col: number, row: number, terrainKey = 'grassland'): Hex {
  return {
    col,
    row,
    terrain: {
      key: terrainKey,
      name: terrainKey,
      color: '#00ff00',
      difficulty: 1,
      traversable: true,
    },
  };
}

function makeGrid(cols = 3, rows = 3): Hex[] {
  const hexes: Hex[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      hexes.push(makeHex(c, r));
    }
  }
  return hexes;
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('HexGrid — constructor', () => {
  it('creates empty grid with no arguments', () => {
    const grid = new HexGrid();
    expect(grid.size).toBe(0);
  });

  it('creates grid from hex array', () => {
    const hexes = makeGrid(3, 3);
    const grid = new HexGrid(hexes);
    expect(grid.size).toBe(9);
  });
});

// ─── makeKey ─────────────────────────────────────────────────────────────────

describe('HexGrid.makeKey()', () => {
  it('returns a string in "col,row" format', () => {
    expect(HexGrid.makeKey(5, 3)).toBe('5,3');
  });

  it('handles negative coordinates', () => {
    expect(HexGrid.makeKey(-2, -4)).toBe('-2,-4');
  });
});

// ─── get / has ────────────────────────────────────────────────────────────────

describe('HexGrid.get()', () => {
  let grid: HexGrid;
  beforeEach(() => {
    grid = new HexGrid(makeGrid(5, 5));
  });

  it('returns the hex at a valid coordinate', () => {
    const hex = grid.get(2, 2);
    expect(hex).toBeDefined();
    expect(hex?.col).toBe(2);
    expect(hex?.row).toBe(2);
  });

  it('returns undefined for a coordinate not in the grid', () => {
    expect(grid.get(99, 99)).toBeUndefined();
  });
});

describe('HexGrid.has()', () => {
  let grid: HexGrid;
  beforeEach(() => {
    grid = new HexGrid(makeGrid(3, 3));
  });

  it('returns true for an existing hex', () => {
    expect(grid.has(1, 1)).toBe(true);
  });

  it('returns false for a non-existent hex', () => {
    expect(grid.has(50, 50)).toBe(false);
  });
});

// ─── set ──────────────────────────────────────────────────────────────────────

describe('HexGrid.set()', () => {
  it('adds a new hex to the grid', () => {
    const grid = new HexGrid();
    const hex = makeHex(3, 3);
    grid.set(hex);
    expect(grid.size).toBe(1);
    expect(grid.has(3, 3)).toBe(true);
  });

  it('updates an existing hex', () => {
    const grid = new HexGrid([makeHex(1, 1, 'grassland')]);
    const updated = makeHex(1, 1, 'forest');
    grid.set(updated);
    expect(grid.size).toBe(1);
    expect(grid.get(1, 1)?.terrain.key).toBe('forest');
  });

  it('updates bounds when adding a hex beyond current extent', () => {
    const grid = new HexGrid(makeGrid(3, 3));
    grid.set(makeHex(100, 100));
    const bounds = grid.getBounds();
    expect(bounds.maxCol).toBe(100);
    expect(bounds.maxRow).toBe(100);
  });
});

// ─── getNeighbors ────────────────────────────────────────────────────────────

describe('HexGrid.getNeighbors()', () => {
  let grid: HexGrid;
  beforeEach(() => {
    grid = new HexGrid(makeGrid(5, 5));
  });

  it('returns an array', () => {
    expect(Array.isArray(grid.getNeighbors(2, 2))).toBe(true);
  });

  it('interior hex has up to 6 neighbors (all exist in 5×5 grid)', () => {
    const neighbors = grid.getNeighbors(2, 2);
    expect(neighbors.length).toBe(6);
  });

  it('corner hex (0, 0) has fewer than 6 neighbors in a bounded grid', () => {
    const neighbors = grid.getNeighbors(0, 0);
    expect(neighbors.length).toBeLessThan(6);
  });

  it('each neighbor has col and row properties', () => {
    for (const n of grid.getNeighbors(2, 2)) {
      expect(n).toHaveProperty('col');
      expect(n).toHaveProperty('row');
    }
  });
});

// ─── getInRadius ─────────────────────────────────────────────────────────────

describe('HexGrid.getInRadius()', () => {
  let grid: HexGrid;
  beforeEach(() => {
    grid = new HexGrid(makeGrid(10, 10));
  });

  it('radius 0 returns only the center hex (if it exists)', () => {
    const result = grid.getInRadius(5, 5, 0);
    expect(result).toHaveLength(1);
    expect(result[0].col).toBe(5);
    expect(result[0].row).toBe(5);
  });

  it('radius 1 returns center + up to 6 neighbors', () => {
    const result = grid.getInRadius(5, 5, 1);
    expect(result.length).toBeGreaterThanOrEqual(6);
    expect(result.length).toBeLessThanOrEqual(7);
  });

  it('all returned hexes exist in the grid', () => {
    const result = grid.getInRadius(5, 5, 2);
    for (const h of result) {
      expect(grid.has(h.col, h.row)).toBe(true);
    }
  });
});

// ─── getBounds ───────────────────────────────────────────────────────────────

describe('HexGrid.getBounds()', () => {
  it('returns correct bounds for a 5×5 grid (0-indexed)', () => {
    const grid = new HexGrid(makeGrid(5, 5));
    const bounds = grid.getBounds();
    expect(bounds.minCol).toBe(0);
    expect(bounds.maxCol).toBe(4);
    expect(bounds.minRow).toBe(0);
    expect(bounds.maxRow).toBe(4);
  });

  it('returns a copy — mutating does not affect the grid', () => {
    const grid = new HexGrid(makeGrid(3, 3));
    const bounds = grid.getBounds();
    bounds.maxCol = 999;
    expect(grid.getBounds().maxCol).toBe(2);
  });
});

// ─── size / clear ────────────────────────────────────────────────────────────

describe('HexGrid.size', () => {
  it('reflects the number of hexes', () => {
    const grid = new HexGrid(makeGrid(4, 4));
    expect(grid.size).toBe(16);
  });
});

describe('HexGrid.clear()', () => {
  it('empties the grid', () => {
    const grid = new HexGrid(makeGrid(3, 3));
    grid.clear();
    expect(grid.size).toBe(0);
  });

  it('returns undefined for any coordinate after clear', () => {
    const grid = new HexGrid(makeGrid(3, 3));
    grid.clear();
    expect(grid.get(1, 1)).toBeUndefined();
  });
});
