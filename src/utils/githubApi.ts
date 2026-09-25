/**
 * Bug report helper.
 * Builds a prefilled GitHub "new issue" URL — the user submits it from their own
 * GitHub session, so no token ever ships in the client bundle.
 */

const GITHUB_REPO = 'italicninja/hexcrawler';
const TITLE_MAX = 100;
// GitHub rejects very long issue URLs (~8 KB); keep the encoded URL well under that.
const URL_MAX = 7000;

/**
 * Build a prefilled GitHub new-issue URL. When it would be too long, the oldest
 * log entries are dropped first, then the description is cut as a last resort.
 */
export function buildBugReportUrl(description: string, gameLog: string): string {
  const title = `Bug Report: ${truncateTitle(description)}`;
  const build = (desc: string, log: string) =>
    `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(
      title
    )}&labels=bug&body=${encodeURIComponent(formatIssueBody(desc, log))}`;

  let lines = gameLog ? gameLog.split('\n') : [];
  let desc = description;
  let url = build(desc, gameLog);
  while (url.length > URL_MAX && lines.length > 0) {
    lines = lines.slice(Math.max(1, Math.ceil(lines.length / 4)));
    const log = lines.length ? `[... earlier entries trimmed ...]\n${lines.join('\n')}` : '';
    url = build(desc, log);
  }
  while (url.length > URL_MAX && desc.length > 0) {
    desc = desc.slice(0, Math.floor(desc.length * 0.75));
    url = build(`${desc}\n[... trimmed ...]`, '');
  }
  return url;
}

/**
 * Open the prefilled issue form in a new tab. Returns false if the popup was blocked.
 * (Not using the 'noopener' feature: with it window.open always returns null.)
 */
export function openBugReport(description: string, gameLog: string): boolean {
  const win = window.open(buildBugReportUrl(description, gameLog), '_blank');
  if (win) win.opener = null;
  return win !== null;
}

function formatIssueBody(description: string, gameLog: string): string {
  const commit = (import.meta.env.VITE_GIT_COMMIT as string | undefined) || 'unknown';
  const branch = (import.meta.env.VITE_GIT_BRANCH as string | undefined) || 'unknown';

  return `## Bug Description

${description}

## Environment

- **Timestamp:** ${new Date().toISOString()}
- **Branch:** ${branch}
- **Commit:** ${commit}
- **User Agent:** ${navigator.userAgent}

## Game Log

<details>
<summary>Game log</summary>

\`\`\`
${gameLog || 'No game log available'}
\`\`\`

</details>
`;
}

function truncateTitle(description: string): string {
  const firstLine = description.split('\n')[0].trim();
  return firstLine.length <= TITLE_MAX ? firstLine : firstLine.substring(0, TITLE_MAX - 3) + '...';
}
