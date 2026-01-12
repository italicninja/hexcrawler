/**
 * GitHub API Integration
 * Handles bug report submission to GitHub issues
 * Requires VITE_GITHUB_PAT environment variable
 */

import logger from './logger.js';

const GITHUB_REPO = 'italicninja/hexcrawler';
const GITHUB_API_URL = 'https://api.github.com';

/**
 * Submit a bug report to GitHub Issues
 * @param {string} description - Bug description from user
 * @param {string} gameLog - Formatted game log
 * @returns {Promise<{success: boolean, issueNumber?: number, error?: string}>}
 */
export async function submitBugReport(description, gameLog) {
  const token = import.meta.env.VITE_GITHUB_PAT;

  if (!token) {
    return {
      success: false,
      error: 'GitHub PAT not configured. Please set VITE_GITHUB_PAT environment variable.'
    };
  }

  try {
    // Get git info for context
    const gitInfo = {
      commit: import.meta.env.VITE_GIT_COMMIT || 'unknown',
      branch: import.meta.env.VITE_GIT_BRANCH || 'unknown'
    };

    // Format issue body
    const issueBody = formatIssueBody(description, gameLog, gitInfo);

    // Create GitHub issue
    const response = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `Bug Report: ${truncateTitle(description)}`,
        body: issueBody,
        labels: ['bug', 'user-reported']
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub API error: ${response.status}`);
    }

    const issue = await response.json();
    
    return {
      success: true,
      issueNumber: issue.number,
      url: issue.html_url
    };
  } catch (error) {
    logger.general.error('Failed to submit bug report:', { error, message: error.message });
    return {
      success: false,
      error: error.message || 'Failed to submit bug report'
    };
  }
}

/**
 * Format the issue body with bug description, game log, and metadata
 * @param {string} description - Bug description
 * @param {string} gameLog - Game log entries
 * @param {object} gitInfo - Git commit and branch info
 * @returns {string} Formatted markdown issue body
 */
function formatIssueBody(description, gameLog, gitInfo) {
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
 * @param {string} description - Full description
 * @returns {string} Truncated title
 */
function truncateTitle(description) {
  const maxLength = 100;
  const firstLine = description.split('\n')[0].trim();
  
  if (firstLine.length <= maxLength) {
    return firstLine;
  }
  
  return firstLine.substring(0, maxLength - 3) + '...';
}
