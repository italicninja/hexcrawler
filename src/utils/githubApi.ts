/**
 * GitHub API Integration
 * Handles bug report submission to GitHub issues
 * Requires VITE_GITHUB_PAT environment variable
 */

import logger from './logger';

const GITHUB_REPO = 'italicninja/hexcrawler';
const GITHUB_API_URL = 'https://api.github.com';

interface GitInfo {
  commit: string;
  branch: string;
}

interface BugReportResult {
  success: boolean;
  issueNumber?: number;
  url?: string;
  error?: string;
}

/**
 * Submit a bug report to GitHub Issues
 */
export async function submitBugReport(
  description: string,
  gameLog: string
): Promise<BugReportResult> {
  const token = import.meta.env.VITE_GITHUB_PAT as string | undefined;

  if (!token) {
    return {
      success: false,
      error: 'GitHub PAT not configured. Please set VITE_GITHUB_PAT environment variable.',
    };
  }

  try {
    // Get git info for context
    const gitInfo: GitInfo = {
      commit: (import.meta.env.VITE_GIT_COMMIT as string) || 'unknown',
      branch: (import.meta.env.VITE_GIT_BRANCH as string) || 'unknown',
    };

    // Format issue body
    const issueBody = formatIssueBody(description, gameLog, gitInfo);

    // Create GitHub issue
    const response = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Bug Report: ${truncateTitle(description)}`,
        body: issueBody,
        labels: ['bug', 'user-reported'],
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errorData.message || `GitHub API error: ${response.status}`);
    }

    const issue = (await response.json()) as { number: number; html_url: string };

    return {
      success: true,
      issueNumber: issue.number,
      url: issue.html_url,
    };
  } catch (error) {
    const err = error as Error;
    logger.general.error('Failed to submit bug report:', { error, message: err.message });
    return {
      success: false,
      error: err.message || 'Failed to submit bug report',
    };
  }
}

/**
 * Format the issue body with bug description, game log, and metadata
 */
function formatIssueBody(description: string, gameLog: string, gitInfo: GitInfo): string {
  const timestamp = new Date().toISOString();
  const userAgent = navigator.userAgent;

  return `## Bug Description

${description}

---

## Environment

- **Timestamp:** ${timestamp}
- **Branch:** ${gitInfo.branch}
- **Commit:** ${gitInfo.commit}
- **User Agent:** ${userAgent}

---

## Game Log

<details>
<summary>Click to expand game log (${gameLog.split('\n').length} entries)</summary>

\`\`\`
${gameLog || 'No game log available'}
\`\`\`

</details>

---

*This bug report was automatically submitted from the game client.*
`;
}

/**
 * Truncate title to fit GitHub's limits
 */
function truncateTitle(description: string): string {
  const maxLength = 100;
  const firstLine = description.split('\n')[0].trim();

  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  return firstLine.substring(0, maxLength - 3) + '...';
}
