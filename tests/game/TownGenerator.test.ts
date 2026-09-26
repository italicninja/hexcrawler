import { describe, it, expect } from 'vitest';
import { TownGenerator } from '../../src/game/TownGenerator';
import { SETTLEMENT_DIMENSIONS } from '../../src/constants/gameConstants';

const ESSENTIALS: Record<string, string[]> = {
  camp: ['campfire', 'questBoard', 'supplyWagon'],
  village: ['well', 'questBoard', 'inn', 'shop'],
  town: ['well', 'questBoard', 'inn', 'shop', 'temple', 'blacksmith'],
  city: ['well', 'questBoard', 'inn', 'shop', 'temple', 'market', 'blacksmith', 'barracks'],
  metropolis: ['well', 'questBoard', 'inn', 'shop', 'temple', 'market', 'blacksmith', 'barracks'],
};

function build(size: string, seed: string) {
  const g = new TownGenerator();
  g.setSeed(seed);
  const { width, height } = SETTLEMENT_DIMENSIONS[size];
  const map = g.generate(width, height, { name: 'Test', settlementSize: size });
  const grid = Array.from({ length: height }, (_, r) => map.hexes.slice(r * width, (r + 1) * width));
  return { g, map, grid };
}

describe('TownGenerator', () => {
  for (const size of Object.keys(SETTLEMENT_DIMENSIONS)) {
    it(`${size}: every door and the gate are reachable from the entrance, essentials present`, () => {
      for (let i = 0; i < 8; i++) {
        const { g, map, grid } = build(size, `test-${size}-${i}`);
        const reach = g.floodFill(grid, map.entrance.col, map.entrance.row, h => h.terrain.walkable);

        expect(grid[map.entrance.row][map.entrance.col].terrain.walkable).toBe(true);
        expect(map.hexes.some(h => h.terrain.key === 'gate' && reach.has(`${h.col},${h.row}`))).toBe(true);

        for (const b of map.buildings) {
          if (b.door) expect(reach.has(`${b.door.col},${b.door.row}`), `${b.type} door`).toBe(true);
        }
        const types = map.buildings.map(b => b.type);
        for (const t of ESSENTIALS[size]) expect(types, `seed ${i}`).toContain(t);

        // Footprints are solid and never sit on a street
        for (const h of map.hexes.filter(h => h.buildingId !== undefined && h.terrain.key === 'building')) {
          expect(h.terrain.walkable).toBe(false);
        }
      }
    });
  }

  it('is deterministic for a seed', () => {
    const a = build('town', 'same').map, b = build('town', 'same').map;
    expect(a.hexes.map(h => h.terrain.key)).toEqual(b.hexes.map(h => h.terrain.key));
    expect(a.buildings.map(x => x.name)).toEqual(b.buildings.map(x => x.name));
  });
});
