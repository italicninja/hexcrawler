import { describe, it, expect } from 'vitest';
import { describeArrival, describeGoing } from '../../src/utils/flavorTextGenerator';

describe('describeArrival', () => {
  it('names the terrain, position, going and weather', () => {
    expect(
      describeArrival({
        col: 11,
        row: 7,
        terrain: { name: 'Grassland', difficulty: 1 },
        weather: { condition: 'Clear Skies' },
      })
    ).toBe('You arrive in Grassland (11, 7); the going is easy. Clear Skies.');
  });

  it('mentions a known place and tolerates missing data', () => {
    expect(describeArrival({ col: 2, row: 3, knownPlace: 'Millbrook' })).toBe(
      'You arrive in the wilds (2, 3); the going is easy. Millbrook is here.'
    );
  });

  it('grades difficulty', () => {
    expect([1, 2, 3, 4].map(describeGoing)).toEqual([
      'easy',
      'moderate',
      'difficult',
      'very difficult',
    ]);
  });
});
