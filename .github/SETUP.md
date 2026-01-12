# GitHub Actions Setup Guide

## Quick Setup (5 minutes)

### Step 1: Push to GitHub

If you haven't already:

```bash
git add .
git commit -m "Add QA testing infrastructure"
git push origin main
```

The workflow will automatically run on this push!

### Step 2: View First Run

1. Go to your repository on GitHub
2. Click **Actions** tab
3. You'll see "QA Tests" workflow running
4. Click on the workflow run to see progress

### Step 3: Setup Discord (Optional)

1. In Discord, go to Server Settings → Integrations → Webhooks
2. Click "New Webhook"
3. Name it "Hexcrawler QA Bot"
4. Copy the webhook URL
5. In GitHub, go to Settings → Secrets and variables → Actions
6. Click "New repository secret"
7. Name: `DISCORD_WEBHOOK_URL`
8. Value: Paste your webhook URL
9. Click "Add secret"

Done! Future test runs will post to Discord.

---

## What Happens Automatically

### On Every Push to Main/Develop

```
1. Code pushed to GitHub
   ↓
2. Workflow triggered automatically
   ↓
3. Tests run on Chromium + Firefox
   ↓
4. Reports uploaded as artifacts
   ↓
5. Discord notification sent (if configured)
```

### On Every Pull Request

```
1. PR created/updated
   ↓
2. Tests run automatically
   ↓
3. Results posted as PR comment
   ↓
4. Pass/fail status shows on PR
```

### Daily at 2 AM UTC

```
1. Scheduled run triggers
   ↓
2. Full test suite runs
   ↓
3. Reports uploaded
   ↓
4. Discord notification sent
```

---

## Viewing Test Results

### In GitHub Actions

1. Go to **Actions** tab
2. Click on a workflow run
3. See test summary in logs
4. Download artifacts:
   - `qa-reports-chromium` - Test reports
   - `qa-reports-firefox` - Test reports
   - `qa-screenshots-chromium` - Failure screenshots (if any)
   - `qa-screenshots-firefox` - Failure screenshots (if any)

### In Pull Requests

PR comments show:
- ✅/❌ Pass/fail status
- Test summary (40/40 passed, etc.)
- Duration
- Bug details (if any)
- Link to full reports

### In Discord

Messages include:
- ✅/❌ Pass/fail emoji
- Repository and branch
- Trigger type (push/PR/schedule)
- Link to GitHub Actions run

---

## Manual Triggers

Want to run tests on-demand?

1. Go to **Actions** tab
2. Click "QA Tests" in the left sidebar
3. Click "Run workflow" button
4. (Optional) Select specific test suite:
   - `all` - Full suite (default)
   - `combat-system` - Combat only
   - `exploration-interiors` - Dungeon exploration
   - etc.
5. Click "Run workflow"

---

## Customization

### Change Daily Schedule

Edit `.github/workflows/qa-tests.yml`:

```yaml
schedule:
  - cron: '0 2 * * *'  # 2 AM UTC daily
```

**Examples:**
- `'0 8 * * 1-5'` - 8 AM UTC, Monday-Friday
- `'0 0 * * 0'` - Midnight UTC, Sundays only
- `'0 */6 * * *'` - Every 6 hours

**Cron helper:** [crontab.guru](https://crontab.guru)

### Skip Tests for Docs

Only run tests when code changes:

```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'tests/**'
      - 'package.json'
      - '!**.md'  # Ignore markdown
```

### Add Status Badge

Add to your `README.md`:

```markdown
![QA Tests](https://github.com/YOUR_USERNAME/hexcrawler/actions/workflows/qa-tests.yml/badge.svg)
```

Shows: ![QA Tests](https://img.shields.io/badge/QA%20Tests-passing-brightgreen)

---

## Cost & Limits

### GitHub Free Tier

**Public repositories:**
- ✅ Unlimited minutes
- ✅ Unlimited storage (with retention limits)

**Private repositories:**
- 2,000 minutes/month
- 500 MB storage

### This Project's Usage

**Minutes per run:**
- ~1 hour × 2 browsers = 2 hours per run

**Daily runs:**
- 2 hours/day × 30 days = 60 hours/month

**Total with pushes:**
- ~80-100 hours/month (well under free tier)

**Storage:**
- ~5 MB per run
- Auto-deletes after 30 days
- ~150 MB total (well under limit)

---

## Troubleshooting

### Workflow Not Triggering

**Check:**
- Workflow file is in `.github/workflows/`
- File has `.yml` or `.yaml` extension
- YAML syntax is valid
- Branch name matches trigger (`main` or `develop`)

**Fix:**
```bash
# Verify file exists
ls .github/workflows/

# Validate YAML syntax
yamllint .github/workflows/qa-tests.yml
```

### Tests Failing in CI But Pass Locally

**Common causes:**
- Different port (CI uses 4173, local uses 3000)
- Different environment (Linux vs Windows)
- Browser version differences

**Fix:**
```bash
# Test locally with same config as CI
export HEADLESS=true
export GAME_URL=http://localhost:4173
npm run build
npm run preview &
npm run test:qa:headless
```

### Artifacts Not Uploading

**Check:**
- Tests actually ran
- Reports directory exists (`tests/reports/`)
- Workflow has `upload-artifact` step

**Fix:**
```yaml
- name: Debug reports
  run: |
    ls -la tests/reports/
    ls -la tests/screenshots/
```

### Discord Not Working

**Check:**
- Secret `DISCORD_WEBHOOK_URL` is set
- Webhook URL is valid
- Webhook has channel permissions

**Test:**
```bash
curl -X POST "$DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test message"}'
```

---

## Advanced Usage

### Parallel Test Execution

Run suites in parallel (faster, more minutes used):

```yaml
strategy:
  matrix:
    browser: [chromium, firefox]
    suite: [combat-system, exploration-interiors, ui-ux]
```

Creates 6 jobs (2 browsers × 3 suites).

### Slack Instead of Discord

Replace Discord step with:

```yaml
- name: Post to Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "QA Tests ${{ job.status }}"
      }
```

### Email Notifications

Add to workflow:

```yaml
- name: Send email
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: QA Tests ${{ job.status }}
    to: your-email@example.com
    from: GitHub Actions
    body: Test run completed. See details at ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

---

## Next Steps

1. ✅ Push to GitHub
2. ✅ Watch first workflow run
3. ✅ Setup Discord webhook (optional)
4. ✅ Customize schedule (optional)
5. ✅ Add status badge to README

**You're done!** Tests now run automatically on every push, PR, and daily. 🎉

---

**Need help?** See `.github/workflows/README.md` for detailed docs.
