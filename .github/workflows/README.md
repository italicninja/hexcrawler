# GitHub Actions Workflows

## QA Tests Workflow

**File:** `qa-tests.yml`

Automated QA testing using the Hexcrawler QA Agent in CI/CD.

### Triggers

The workflow runs on:

1. **Push to main/develop branches** - Runs full test suite
2. **Pull requests** - Runs tests and comments results on PR
3. **Daily schedule** - 2 AM UTC every day
4. **Manual trigger** - Via GitHub Actions UI with optional test suite selection

### What It Does

1. Checks out code
2. Sets up Node.js 18
3. Installs dependencies
4. Installs Playwright browsers (Chromium + Firefox)
5. Builds the application
6. Starts preview server on port 4173
7. Runs QA tests in headless mode
8. Uploads test reports as artifacts
9. Uploads screenshots if tests fail
10. Comments on PRs with test results
11. Sends Discord notification (if configured)

### Configuration

#### Required Secrets

Add these to your repository secrets (Settings → Secrets and variables → Actions):

| Secret | Description | Required |
|--------|-------------|----------|
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | Optional |

#### Environment Variables

The workflow sets these automatically:

- `HEADLESS=true` - Run browsers in headless mode
- `GAME_URL=http://localhost:4173` - Preview server URL
- `TEST_SUITE=all` - Can be overridden via manual trigger

### Manual Trigger

1. Go to Actions tab in GitHub
2. Select "QA Tests" workflow
3. Click "Run workflow"
4. (Optional) Select specific test suite to run
5. Click "Run workflow"

### Viewing Results

#### Artifacts

After workflow completes, download artifacts:

1. Go to workflow run page
2. Scroll to "Artifacts" section
3. Download:
   - `qa-reports-chromium` - HTML/JSON/MD reports for Chromium
   - `qa-reports-firefox` - HTML/JSON/MD reports for Firefox
   - `qa-screenshots-chromium` - Screenshots if tests failed (Chromium)
   - `qa-screenshots-firefox` - Screenshots if tests failed (Firefox)

Artifacts are retained for:
- Reports: 30 days
- Screenshots: 14 days
- Videos: 7 days

#### PR Comments

On pull requests, the workflow automatically comments with:
- Pass/fail status
- Test summary (passed/failed/skipped)
- Duration
- Bug details (up to 5)
- Link to full reports

#### Discord Notifications

If webhook is configured, receives:
- Test completion status
- Repository and branch info
- Link to GitHub Actions run

### Customization

#### Change Schedule

Edit the cron expression in `qa-tests.yml`:

```yaml
schedule:
  - cron: '0 2 * * *'  # 2 AM UTC daily
  # Change to:
  - cron: '0 8 * * 1-5'  # 8 AM UTC, Monday-Friday
```

#### Add More Browsers

Add to the matrix in `qa-tests.yml`:

```yaml
matrix:
  browser: [chromium, firefox, webkit]  # Add WebKit
```

#### Change Timeout

Default is 60 minutes for the job, 50 minutes for tests:

```yaml
timeout-minutes: 60  # Job timeout

timeout 50m npm run test:qa:headless  # Test timeout
```

### Troubleshooting

#### "Server did not start"

The workflow waits 30 seconds for the preview server. If it fails:
- Check build succeeded
- Verify preview server starts correctly locally

#### "Tests timed out"

Tests take 30-45 minutes normally. If timing out:
- Increase timeout in workflow
- Check for hanging tests in reports

#### "No artifacts uploaded"

Ensure tests actually ran:
- Check workflow logs
- Verify reports directory exists
- Check test execution didn't crash early

#### "PR comment not posted"

Requires:
- `GITHUB_TOKEN` (automatically provided)
- Workflow triggered by PR event
- JSON report exists

### Cost Considerations

**GitHub Actions minutes:**
- Free tier: 2,000 minutes/month for private repos
- Each test run: ~1 hour × 2 browsers = 2 hours
- Daily runs: ~60 hours/month
- Stay under limit: Reduce schedule frequency or browser count

**Storage:**
- Free tier: 500 MB
- Reports: ~1-5 MB per run
- Screenshots: ~500 KB - 2 MB per run
- Artifacts auto-delete after retention period

### Best Practices

1. **Run on feature branches** - Add your feature branch to triggers
2. **Skip for docs** - Add path filters to skip doc-only changes
3. **Cache dependencies** - Already enabled with `npm ci` and cache
4. **Fail fast or not** - Currently `fail-fast: false` to test all browsers
5. **Review artifacts** - Download and review reports after failures

### Example: Path Filters

Only run tests when code changes:

```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'tests/**'
      - 'package.json'
      - 'vite.config.js'
```

### Example: Parallel Jobs

Run test suites in parallel:

```yaml
strategy:
  matrix:
    browser: [chromium, firefox]
    suite: [combat-system, exploration-interiors, survival-mechanics]
```

This creates 6 jobs (2 browsers × 3 suites) running simultaneously.

---

## Status Badge

Add to your README.md:

```markdown
![QA Tests](https://github.com/YOUR_USERNAME/hexcrawler/actions/workflows/qa-tests.yml/badge.svg)
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Need Help?

- Check workflow logs in GitHub Actions
- Review test reports in artifacts
- See main QA docs: `tests/README.md`
