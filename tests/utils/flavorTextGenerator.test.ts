import { describe, it, expect } from 'vitest';
import { nextTerrainFlavorIn } from '../../src/utils/flavorTextGenerator';

describe('nextTerrainFlavorIn', () => {
  it('spaces terrain blurbs 10-15 hexes apart', () => {
    for (let i = 0; i < 200; i++) {
      const n = nextTerrainFlavorIn();
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(15);
      expect(Number.isInteger(n)).toBe(true);
    }
  });
});
