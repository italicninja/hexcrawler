# QA Agent - Quick Start Guide

## 1-Minute Setup

### Step 1: Start Game Server
```bash
npm run dev
```
Wait for server to start on http://localhost:3000

### Step 2: Run Tests (New Terminal)
```bash
npm run test:qa
```

That's it! Watch the agent play your game.

## Commands

| Command | Description |
|---------|-------------|
| `npm run test:qa` | Run full test suite (visible browsers) |
| `npm run test:qa:headless` | Run in background (no browser windows) |
| `npm run test:qa:debug` | Slow motion, visible (for debugging) |
| `npm run test:qa:combat` | Test combat system only |
| `npm run test:qa:exploration` | Test exploration/interiors only |

## Test Results

**Location:** `tests/reports/`

**Files:**
- `test-report-YYYY-MM-DD-chromium.html` ← Open this in browser
- `test-report-YYYY-MM-DD-firefox.html`
- `*.json` (machine-readable)
- `*.md` (markdown)

**Screenshots:** `tests/screenshots/` (failures only)

## Discord Setup (Optional)

1. Create webhook in Discord server settings
2. Set environment variable:
   ```bash
   export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
   ```
3. Run tests - notifications sent automatically

## What Gets Tested?

- ✅ Character creation
- ✅ Movement & navigation
- ✅ POI discovery & interaction
- ✅ Foraging & survival
- ✅ Short/long rest
- ✅ Combat encounters
- ✅ Interior exploration
- ✅ Quick save
- ✅ Keyboard shortcuts
- ✅ Console errors
- ✅ State management

**Total:** 40+ tests across 8 test suites

**Duration:** ~30-45 minutes (Chromium + Firefox)

## Reading Reports

### HTML Report

Open `tests/reports/test-report-*.html`:

- **Green cards** = Passed tests
- **Red cards** = Failed tests
- **Bug sections** = Detailed error info + screenshots
- **Severity badges** = Critical/Major/Minor

### Bug Format

```
BUG-1: Test name [CRITICAL]
Error message
Screenshot (if captured)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Browser launch failed" | `npx playwright install chromium firefox` |
| "Game server not responding" | Start dev server: `npm run dev` |
| "Permission denied" | `chmod +x tests/qa-agent/run.js` |
| Tests hanging | Increase timeouts in `tests/qa-agent/config.js` |

## Next Steps

1. Read full docs: `tests/README.md`
2. Customize config: `tests/qa-agent/config.js`
3. Add custom tests: `tests/qa-agent/TestSuites.js`
4. Setup CI/CD with GitHub Actions

## Need Help?

Check `tests/README.md` for:
- Full configuration options
- Adding new tests
- Debugging guide
- CI/CD setup
- Architecture details
