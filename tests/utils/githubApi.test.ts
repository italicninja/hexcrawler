import { describe, it, expect } from 'vitest';
import { buildBugReportUrl } from '../../src/utils/githubApi';

describe('buildBugReportUrl', () => {
  it('builds a prefilled new-issue URL', () => {
    const url = new URL(buildBugReportUrl('Crash on load\nmore detail', '[t] [info] hello'));
    expect(url.origin + url.pathname).toBe('https://github.com/italicninja/hexcrawler/issues/new');
    expect(url.searchParams.get('title')).toBe('Bug Report: Crash on load');
    expect(url.searchParams.get('body')).toContain('[t] [info] hello');
  });

  it('trims oldest log lines to stay under the URL limit, keeping the newest', () => {
    const log = Array.from({ length: 2000 }, (_, i) => `[t] [info] line ${i}`).join('\n');
    const url = buildBugReportUrl('bug', log);
    expect(url.length).toBeLessThanOrEqual(7000);
    const body = new URL(url).searchParams.get('body') ?? '';
    expect(body).toContain('line 1999');
    expect(body).not.toContain('line 0\n');
  });

  it('trims an oversized description as a last resort', () => {
    expect(buildBugReportUrl('x'.repeat(20000), '').length).toBeLessThanOrEqual(7000);
  });
});
