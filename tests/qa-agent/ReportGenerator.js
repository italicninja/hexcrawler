/**
 * ReportGenerator - Generate test reports in multiple formats
 * 
 * Generates HTML, JSON, and Markdown reports, and sends Discord notifications.
 */

import fs from 'fs/promises';
import path from 'path';
import { QA_CONFIG } from './config.js';

export class ReportGenerator {
  constructor(config = QA_CONFIG) {
    this.config = config;
    this.results = {
      startTime: null,
      endTime: null,
      duration: 0,
      browser: null,
      suites: [],
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      bugs: [],
      screenshots: [],
      consoleErrors: []
    };
    this.currentSuite = null;
  }

  /**
   * Start test run timer
   */
  startTimer() {
    this.results.startTime = new Date();
  }

  /**
   * End test run timer
   */
  endTimer() {
    this.results.endTime = new Date();
    this.results.duration = this.results.endTime - this.results.startTime;
  }

  /**
   * Set browser type
   */
  setBrowser(browserType) {
    this.results.browser = browserType;
  }

  /**
   * Start a new test suite
   */
  startPhase(name, description = '') {
    this.currentSuite = {
      name,
      description,
      tests: [],
      passed: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * End current test suite
   */
  endPhase() {
    if (this.currentSuite) {
      this.results.suites.push(this.currentSuite);
      this.currentSuite = null;
    }
  }

  /**
   * Record a passing test
   */
  recordPass(testName, duration = 0) {
    this.results.totalTests++;
    this.results.passed++;
    
    if (this.currentSuite) {
      this.currentSuite.passed++;
      this.currentSuite.tests.push({
        name: testName,
        status: 'passed',
        duration,
        error: null
      });
    }
  }

  /**
   * Record a failing test
   */
  recordFail(testName, error, screenshot = null) {
    this.results.totalTests++;
    this.results.failed++;
    
    const bug = {
      id: `bug-${this.results.bugs.length + 1}`,
      testName,
      error: error.message,
      stack: error.stack,
      screenshot,
      severity: this.categorizeSeverity(error)
    };
    
    this.results.bugs.push(bug);
    
    if (this.currentSuite) {
      this.currentSuite.failed++;
      this.currentSuite.tests.push({
        name: testName,
        status: 'failed',
        error: error.message,
        bugId: bug.id
      });
    }
  }

  /**
   * Record a skipped test
   */
  recordSkip(testName, reason = '') {
    this.results.totalTests++;
    this.results.skipped++;
    
    if (this.currentSuite) {
      this.currentSuite.skipped++;
      this.currentSuite.tests.push({
        name: testName,
        status: 'skipped',
        reason
      });
    }
  }

  /**
   * Add screenshot
   */
  addScreenshot(path, description = '') {
    this.results.screenshots.push({ path, description });
  }

  /**
   * Add console errors
   */
  addConsoleErrors(errors) {
    this.results.consoleErrors = errors;
  }

  /**
   * Categorize bug severity from error message
   */
  categorizeSeverity(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('crash') || message.includes('boundary') || message.includes('fatal')) {
      return 'critical';
    }
    if (message.includes('combat') || message.includes('save') || message.includes('quest')) {
      return 'major';
    }
    return 'minor';
  }

  /**
   * Generate all report formats
   */
  async generate() {
    const timestamp = this.results.startTime.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const basename = `test-report-${timestamp}-${this.results.browser}`;
    
    const reports = [];
    
    // Generate HTML
    if (this.config.reporting.formats.includes('html')) {
      const htmlPath = await this.generateHTML(basename);
      reports.push(htmlPath);
    }
    
    // Generate JSON
    if (this.config.reporting.formats.includes('json')) {
      const jsonPath = await this.generateJSON(basename);
      reports.push(jsonPath);
    }
    
    // Generate Markdown
    if (this.config.reporting.formats.includes('markdown')) {
      const mdPath = await this.generateMarkdown(basename);
      reports.push(mdPath);
    }
    
    // Send Discord notification
    if (this.config.reporting.discord.enabled) {
      await this.sendDiscordNotification();
    }
    
    return reports;
  }

  /**
   * Generate HTML report
   */
  async generateHTML(basename) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Test Report - Hexcrawler</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 { color: #2c3e50; margin-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
    h3 { color: #7f8c8d; margin-top: 20px; margin-bottom: 10px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card.pass { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .stat-card.fail { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
    .stat-card.skip { background: linear-gradient(135deg, #f2994a 0%, #f2c94c 100%); }
    .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
    .stat-label { font-size: 14px; opacity: 0.9; }
    .suite {
      background: #ecf0f1;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .suite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 10px;
    }
    .badge.pass { background: #2ecc71; color: white; }
    .badge.fail { background: #e74c3c; color: white; }
    .badge.skip { background: #f39c12; color: white; }
    .test {
      background: white;
      padding: 12px;
      border-left: 4px solid #3498db;
      margin-bottom: 8px;
      border-radius: 4px;
    }
    .test.passed { border-left-color: #2ecc71; }
    .test.failed { border-left-color: #e74c3c; }
    .test.skipped { border-left-color: #f39c12; }
    .bug {
      background: #fff5f5;
      border: 1px solid #e74c3c;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .bug-header {
      font-weight: bold;
      color: #c0392b;
      margin-bottom: 8px;
    }
    .severity {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .severity.critical { background: #c0392b; color: white; }
    .severity.major { background: #e67e22; color: white; }
    .severity.minor { background: #f39c12; color: white; }
    .error-details {
      background: #2c3e50;
      color: #ecf0f1;
      padding: 10px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      margin-top: 10px;
      overflow-x: auto;
    }
    .screenshot {
      max-width: 100%;
      border: 1px solid #bdc3c7;
      border-radius: 4px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 Hexcrawler QA Test Report</h1>
    <p><strong>Date:</strong> ${this.results.startTime.toLocaleString()}</p>
    <p><strong>Duration:</strong> ${this.formatDuration(this.results.duration)}</p>
    <p><strong>Browser:</strong> ${this.results.browser}</p>
    
    <h2>📊 Executive Summary</h2>
    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${this.results.totalTests}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card pass">
        <div class="stat-value">${this.results.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card fail">
        <div class="stat-value">${this.results.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card skip">
        <div class="stat-value">${this.results.skipped}</div>
        <div class="stat-label">Skipped</div>
      </div>
    </div>
    
    <h2>🧪 Test Results by Suite</h2>
    ${this.results.suites.map(suite => this.renderSuiteHTML(suite)).join('')}
    
    ${this.results.bugs.length > 0 ? `
      <h2>🐛 Bugs Found</h2>
      ${this.results.bugs.map(bug => this.renderBugHTML(bug)).join('')}
    ` : '<h2>✅ No Bugs Found!</h2>'}
    
    ${this.results.consoleErrors.length > 0 ? `
      <h2>⚠️ Console Errors</h2>
      <div class="error-details">
        ${this.results.consoleErrors.map(e => `${e.text}`).join('\n')}
      </div>
    ` : ''}
  </div>
</body>
</html>`;

    const outputPath = path.join(this.config.reporting.outputDir, `${basename}.html`);
    await fs.writeFile(outputPath, html);
    return outputPath;
  }

  renderSuiteHTML(suite) {
    const status = suite.failed > 0 ? 'fail' : suite.passed > 0 ? 'pass' : 'skip';
    
    return `
      <div class="suite">
        <div class="suite-header">
          <h3>${suite.name}</h3>
          <div>
            <span class="badge pass">${suite.passed} passed</span>
            ${suite.failed > 0 ? `<span class="badge fail">${suite.failed} failed</span>` : ''}
            ${suite.skipped > 0 ? `<span class="badge skip">${suite.skipped} skipped</span>` : ''}
          </div>
        </div>
        ${suite.tests.map(test => `
          <div class="test ${test.status}">
            <strong>${test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️'}</strong>
            ${test.name}
            ${test.error ? `<div style="color: #c0392b; font-size: 12px; margin-top: 5px;">${test.error}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  renderBugHTML(bug) {
    return `
      <div class="bug">
        <div class="bug-header">
          ${bug.id.toUpperCase()}: ${bug.testName}
          <span class="severity ${bug.severity}">${bug.severity}</span>
        </div>
        <div class="error-details">${this.escapeHTML(bug.error)}</div>
        ${bug.screenshot ? `<img src="${bug.screenshot}" class="screenshot" alt="Bug screenshot">` : ''}
      </div>
    `;
  }

  /**
   * Generate JSON report
   */
  async generateJSON(basename) {
    const outputPath = path.join(this.config.reporting.outputDir, `${basename}.json`);
    await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2));
    return outputPath;
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdown(basename) {
    const md = `# QA Test Report - Hexcrawler

**Date:** ${this.results.startTime.toLocaleString()}  
**Duration:** ${this.formatDuration(this.results.duration)}  
**Browser:** ${this.results.browser}

---

## Executive Summary

- **Total Tests:** ${this.results.totalTests}
- **Passed:** ${this.results.passed} (${this.getPercentage(this.results.passed, this.results.totalTests)}%)
- **Failed:** ${this.results.failed} (${this.getPercentage(this.results.failed, this.results.totalTests)}%)
- **Skipped:** ${this.results.skipped}

---

## Test Results by Suite

${this.results.suites.map(suite => this.renderSuiteMarkdown(suite)).join('\n')}

${this.results.bugs.length > 0 ? `---

## Bugs Found

${this.results.bugs.map((bug, i) => `### ${i + 1}. ${bug.testName} [${bug.severity.toUpperCase()}]

\`\`\`
${bug.error}
\`\`\`

${bug.screenshot ? `![Bug Screenshot](${bug.screenshot})` : ''}
`).join('\n')}` : '---\n\n## ✅ No Bugs Found!'}
`;

    const outputPath = path.join(this.config.reporting.outputDir, `${basename}.md`);
    await fs.writeFile(outputPath, md);
    return outputPath;
  }

  renderSuiteMarkdown(suite) {
    return `### ${suite.name} ${suite.failed > 0 ? '❌' : '✅'}

${suite.description ? `_${suite.description}_\n` : ''}
- ✅ Passed: ${suite.passed}
- ❌ Failed: ${suite.failed}
- ⏭️ Skipped: ${suite.skipped}

${suite.tests.map(test => 
  `- ${test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️'} ${test.name}`
).join('\n')}
`;
  }

  /**
   * Send Discord notification
   */
  async sendDiscordNotification() {
    if (!this.config.reporting.discord.webhookUrl) {
      console.log('Discord webhook URL not configured, skipping notification');
      return;
    }

    const embed = {
      title: '🎮 Hexcrawler QA Test Report',
      description: `Test run completed on ${this.results.browser}`,
      color: this.results.failed > 0 ? 0xe74c3c : 0x2ecc71,
      fields: [
        {
          name: '📊 Summary',
          value: `Total: ${this.results.totalTests} | ✅ Passed: ${this.results.passed} | ❌ Failed: ${this.results.failed} | ⏭️ Skipped: ${this.results.skipped}`,
          inline: false
        },
        {
          name: '⏱️ Duration',
          value: this.formatDuration(this.results.duration),
          inline: true
        },
        {
          name: '🐛 Bugs Found',
          value: this.results.bugs.length.toString(),
          inline: true
        }
      ],
      timestamp: this.results.endTime.toISOString()
    };

    if (this.results.bugs.length > 0 && this.results.bugs.length <= 5) {
      embed.fields.push({
        name: '🐛 Bug Details',
        value: this.results.bugs.map(bug => 
          `**${bug.severity.toUpperCase()}**: ${bug.testName}`
        ).join('\n'),
        inline: false
      });
    }

    const payload = {
      embeds: [embed]
    };

    try {
      const response = await fetch(this.config.reporting.discord.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('Failed to send Discord notification:', response.statusText);
      } else {
        console.log('Discord notification sent successfully');
      }
    } catch (error) {
      console.error('Error sending Discord notification:', error.message);
    }
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Calculate percentage
   */
  getPercentage(value, total) {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  }

  /**
   * Escape HTML entities
   */
  escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
