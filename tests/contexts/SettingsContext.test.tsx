import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../../src/contexts/SettingsContext';

function Music() {
  return <span>{useSettings().settings.musicVolume}</span>;
}

describe('SettingsProvider', () => {
  beforeEach(() => localStorage.clear());

  it('keeps stored settings on first load instead of overwriting them with defaults', () => {
    localStorage.setItem('hexcrawl_settings', JSON.stringify({ musicVolume: 0.25 }));
    const { getByText } = render(
      <SettingsProvider>
        <Music />
      </SettingsProvider>
    );
    expect(getByText('0.25')).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('hexcrawl_settings')!);
    expect(stored.musicVolume).toBe(0.25);
    expect(stored.keybindings.moveUp).toBe('w'); // defaults filled in
  });
});
