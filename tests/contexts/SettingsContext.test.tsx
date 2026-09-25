import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../../src/contexts/SettingsContext';

function Theme() {
  return <span>{useSettings().settings.theme}</span>;
}

describe('SettingsProvider', () => {
  beforeEach(() => localStorage.clear());

  it('keeps stored settings on first load instead of overwriting them with defaults', () => {
    localStorage.setItem('hexcrawl_settings', JSON.stringify({ theme: 'forest' }));
    const { getByText } = render(
      <SettingsProvider>
        <Theme />
      </SettingsProvider>
    );
    expect(getByText('forest')).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('hexcrawl_settings')!);
    expect(stored.theme).toBe('forest');
    expect(stored.keybindings.moveUp).toBe('w'); // defaults filled in
  });
});
