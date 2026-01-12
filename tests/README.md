# QA Agent - Automated Testing System

Comprehensive automated testing system for the Hexcrawler game using Playwright browser automation.

## Overview

The QA Agent autonomously plays through the game, testing all major systems and generating detailed reports with screenshots, bug findings, and Discord notifications.

**Features:**
- Full playthrough automation (30-45 minutes runtime)
- Multi-browser testing (Chromium + Firefox)
- Detailed HTML/JSON/Markdown reports
- Discord webhook notifications
- Screenshot capture on failures
- Console error tracking
- Continue-on-failure mode to find all bugs

## Quick Start

### 1. Prerequisites

Ensure dev server is running:
```bash
npm run dev
```

### 2. Run Tests

**Default mode (visible browsers):**
```bash
npm run test:qa
```

**Headless mode (no browser windows):**
```bash
npm run test:qa:headless
```

**Debug mode (slow, visible):**
```bash
npm run test:qa:debug
```

**Specific test suite:**
```bash
npm run test:qa:combat        # Combat system only
npm run test:qa:exploration   # Exploration/interiors only
```

### 3. View Reports

Reports are generated in `tests/reports/`:
- `test-report-YYYY-MM-DD-chromium.html` - Styled HTML report
- `test-report-YYYY-MM-DD-chromium.json` - Machine-readable data
- `test-report-YYYY-MM-DD-chromium.md` - Markdown for docs

Open HTML report in browser:
```bash
# Windows
start tests/reports/test-report-*.html

# Mac/Linux
open tests/reports/test-report-*.html
```

## Test Coverage

### Test Suites (8 phases, 40+ tests)

1. **Character Creation & Setup** (4 tests)
   - Create character flow
   - Welcome message validation
   - Starting resources check
   - Autosave verification

2. **Overworld Movement** (3 tests)
   - Keyboard movement (WASD)
   - Multiple movements
   - Terrain variety

3. **POI Interactions** (2 tests)
   - POI discovery
   - Search mechanics

4. **Survival Mechanics** (3 tests)
   - Foraging system
   - Short rest
   - Long rest (with combat interruption)

5. **Combat System** (3 tests)
   - Combat entry detection
   - Turn-based actions
   - Combat completion

6. **Exploration & Interiors** (4 tests)
   - Find explorable POI
   - Enter interior
   - Interior movement
   - Exit back to overworld

7. **State Management** (3 tests)
   - Quick save functionality
   - Spam action stress test
   - Rapid menu toggle

8. **UI & UX** (3 tests)
   - Keyboard shortcuts
   - Game log scrolling
   - Console error validation

## Configuration

Edit `tests/qa-agent/config.js`:

```javascript
export const QA_CONFIG = {
  browser: {
    browsers: ['chromium', 'firefox'],  // Test on both
    headless: false,                     // Show browser
    slowMo: 100,                         // Action delay (ms)
  },
  
  game: {
    baseUrl: 'http://localhost:3000',
    actionTimeout: 5000,
    combatTimeout: 30000,
  },
  
  testData: {
    characterName: 'QA-Tester',
    characterClass: 'Paladin',
    mapSeed: 'qa-test-seed-12345',
  },
  
  reporting: {
    screenshotOnFail: true,
    screenshotOnPass: false,
    formats: ['html', 'json', 'markdown'],
    
    discord: {
      enabled: !!process.env.DISCORD_WEBHOOK_URL,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    }
  },
  
  validation: {
    continueOnFailure: true,  // Find all bugs
    checkConsoleErrors: true,
  }
};
```

## Environment Variables

```bash
# Browser settings
HEADLESS=true              # Run headless (no UI)
DEBUG=true                 # Slow motion + visible

# Test selection
TEST_SUITE=combat-system   # Run specific suite
SKIP_SUITES=ui-ux,state-management

# Recording
RECORD_VIDEO=true          # Record video of test run

# Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Game server
GAME_URL=http://localhost:3001
```

## Discord Notifications

### Setup

1. Create a Discord webhook:
   - Server Settings → Integrations → Webhooks
   - Create Webhook, copy URL

2. Set environment variable:
   ```bash
   export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
   ```

3. Run tests:
   ```bash
   npm run test:qa
   ```

### Notification Format

The agent sends an embed with:
- Test summary (passed/failed/skipped)
- Duration
- Bug count
- Browser tested
- Bug details (if < 5 bugs)

## Architecture

### Components

```
tests/qa-agent/
├── QAAgent.js           # Main orchestrator
├── GameDriver.js        # Playwright wrapper (browser automation)
├── Validators.js        # Assertion helpers
├── TestSuites.js        # Test scenario definitions
├── ReportGenerator.js   # HTML/JSON/Markdown/Discord reports
├── config.js            # Configuration
└── run.js               # CLI entry point

tests/fixtures/
├── test-seeds.json      # Reproducible map seeds
└── test-characters.json # Test character templates

tests/screenshots/       # Failure screenshots
tests/reports/           # Generated reports
tests/videos/            # Recorded videos (if enabled)
```

### Test Flow

```
QAAgent.run()
  └─> For each browser (chromium, firefox)
       └─> GameDriver.launch()
            └─> For each test suite
                 └─> For each test
                      ├─> test.execute(driver, validators)
                      ├─> On pass: log + optional screenshot
                      └─> On fail: screenshot + record bug
            └─> GameDriver.close()
       └─> ReportGenerator.generate()
            ├─> HTML report
            ├─> JSON report
            ├─> Markdown report
            └─> Discord notification
```

## Adding New Tests

### 1. Add to TestSuites.js

```javascript
{
  id: 'new-feature',
  name: 'New Feature Tests',
  description: 'Test the new feature',
  tests: [
    {
      id: 'test-something',
      name: 'Test something specific',
      async execute(driver, validators) {
        // Your test logic
        await driver.moveKeyboard('up');
        
        const logs = await driver.getGameLog();
        validators.validateLogMessage(logs, 'Expected message');
      }
    }
  ]
}
```

### 2. Add GameDriver method (if needed)

```javascript
// In GameDriver.js
async myNewAction() {
  await this.page.click('text=My Button');
  await this.wait(500);
}
```

### 3. Add Validator (if needed)

```javascript
// In Validators.js
static validateMyThing(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: Expected ${expected}, got ${actual}`);
  }
}
```

## Debugging Tests

### 1. Enable Debug Mode

```bash
DEBUG=true npm run test:qa
```

This:
- Shows browser window
- Slows down actions to 1000ms
- Keeps browser open on failure

### 2. Add Breakpoints

```javascript
async execute(driver, validators) {
  await driver.moveKeyboard('up');
  
  // Pause here
  await driver.page.pause();
  
  const logs = await driver.getGameLog();
}
```

### 3. Inspect Screenshots

Failed tests automatically capture screenshots to `tests/screenshots/`.

### 4. Check Console Logs

Review `consoleErrors` in JSON report:

```bash
cat tests/reports/test-report-*.json | jq '.consoleErrors'
```

## CI/CD Integration

### GitHub Actions (Included!)

A **complete GitHub Actions workflow is already configured** in `.github/workflows/qa-tests.yml`.

**Triggers:**
- Push to main/develop branches
- Pull requests
- Daily at 2 AM UTC
- Manual trigger with test suite selection

**Features:**
- ✅ Tests on Chromium + Firefox
- ✅ Uploads reports as artifacts
- ✅ Comments on PRs with results
- ✅ Discord notifications
- ✅ 30-day report retention

**Setup:**
1. Push to GitHub (workflow auto-runs)
2. (Optional) Add `DISCORD_WEBHOOK_URL` to repository secrets
3. View results in Actions tab

**See:** `.github/workflows/README.md` for full documentation

### Manual CI/CD Setup

If you need a custom setup:

```yaml
name: QA Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      
      - run: npm ci
      - run: npx playwright install --with-deps chromium firefox
      - run: npm run build
      - run: npm run preview &
      - run: npx wait-on http://localhost:4173 -t 30000
      
      - name: Run QA Tests
        env:
          HEADLESS: true
          GAME_URL: http://localhost:4173
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
        run: npm run test:qa:headless
      
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: qa-reports
          path: tests/reports/
          retention-days: 30
```

## Troubleshooting

### "Browser launch failed"

**Solution:** Re-install Playwright browsers
```bash
npx playwright install chromium firefox
```

### "Game server not responding"

**Solution:** Ensure dev server is running on port 3000
```bash
npm run dev
```

### "Tests timing out"

**Solution:** Increase timeouts in `config.js`:
```javascript
game: {
  actionTimeout: 10000,    // 10 seconds
  combatTimeout: 60000,    // 60 seconds
}
```

### "Screenshot directory not found"

**Solution:** Create directories manually:
```bash
mkdir -p tests/screenshots tests/reports tests/videos
```

### "Discord notifications not sending"

**Solution:** Verify webhook URL is set:
```bash
echo $DISCORD_WEBHOOK_URL
```

## Future Enhancements

- [ ] Visual regression testing (canvas screenshot comparison)
- [ ] Performance profiling (FPS, render times)
- [ ] AI-powered bug analysis (severity, root cause suggestions)
- [ ] Parallel test execution (run suites concurrently)
- [ ] Custom test scenarios (load from YAML/JSON)
- [ ] Chaos monkey mode (random actions, stress testing)
- [ ] Network condition simulation (slow/offline)
- [ ] Save state snapshots (test from mid-game states)

## License

Same as parent project.
