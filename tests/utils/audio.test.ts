import { describe, it, expect } from 'vitest';
import { clamp01, playSfx, playMusic, setVolumes, unlockAudio } from '../../src/utils/audio';

describe('audio', () => {
  it('clamps volumes to [0, 1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(7)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
  });

  it('is a no-op without AudioContext (jsdom)', () => {
    expect(() => {
      setVolumes(0.5, 0.5);
      unlockAudio();
      playMusic('combat');
      playSfx('hit');
      playMusic(null);
    }).not.toThrow();
  });
});
