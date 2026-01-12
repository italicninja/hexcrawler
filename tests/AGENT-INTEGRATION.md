# QA Agent Integration Guide

**For Main Development Agent**

This guide explains how you (the main agent) can integrate with and use the QA Agent during development.

---

## When to Run QA Agent

### Automatically Trigger Testing

Run the QA Agent after:

1. **Major feature implementation**
   - New game mechanic added
   - UI component changes
   - State management updates

2. **Bug fixes**
   - After fixing a reported issue
   - To verify fix and check for regressions

3. **Before commits**
   - Especially for main branch commits
   - Before version bumps

4. **On user request**
   - User says "test the game"
   - User asks for QA feedback

---

## How to Run Tests

### Basic Usage

```bash
# In your agent workflow:
1. User makes a request (e.g., "fix combat bug")
2. You implement the fix
3. You run: npm run test:qa
4. Wait for completion (~30-45 min)
5. Parse report and inform user
```

### Example Integration

```
User: "I think there's a bug in the combat system where spells aren't working"

Agent: 
1. Investigates combat code
2. Finds issue in SpellMenu.jsx
3. Fixes the bug
4. Runs: npm run test:qa:combat (combat-specific tests)
5. Reviews report
6. Reports back: "Fixed the spell bug. QA tests show:
   - ✅ All 3 combat tests passed
   - ✅ No new bugs introduced
   - See full report: tests/reports/test-report-*.html"
```

---

## Reading Test Reports

### Quick Check (Console Output)

After test run, console shows:

```
═══════════════════════════════════════════
               FINAL SUMMARY               
═══════════════════════════════════════════

✅ PASS CHROMIUM
  Tests: 40/40 passed (100%)
  Duration: 22m 15s
  Bugs: 0

✅ PASS FIREFOX
  Tests: 38/40 passed (95%)
  Duration: 25m 03s
  Bugs: 2

═══════════════════════════════════════════
Overall: 78/80 tests passed
Total bugs found: 2
═══════════════════════════════════════════
```

**Quick interpretation:**
- If "Total bugs: 0" → All good, safe to commit
- If bugs found → Review HTML report for details

### Detailed Check (HTML Report)

```bash
# Read report programmatically
cat tests/reports/test-report-*-chromium.json | jq '.bugs'
```

Example output:
```json
[
  {
    "id": "bug-1",
    "testName": "Test combat turn actions",
    "error": "Spell menu doesn't close after casting",
    "severity": "critical",
    "screenshot": "tests/screenshots/combat-turn-actions-fail.png"
  }
]
```

---

## Integration Patterns

### Pattern 1: Post-Implementation Testing

```javascript
// After implementing a feature
async implementFeature(userRequest) {
  // 1. Write code
  await this.writeCode(featureCode);
  
  // 2. Run relevant tests
  const testSuite = this.identifyTestSuite(featureCode);
  const result = await this.runQA(testSuite);
  
  // 3. Check results
  if (result.bugs.length > 0) {
    await this.fixBugs(result.bugs);
    await this.runQA(testSuite); // Re-test
  }
  
  // 4. Report to user
  this.reportResults(result);
}
```

### Pattern 2: Regression Testing

```javascript
// After fixing a bug
async fixBug(bugReport) {
  // 1. Apply fix
  await this.applyFix(bugReport);
  
  // 2. Run full test suite to check for regressions
  const result = await this.runQA('all');
  
  // 3. Verify fix didn't break anything
  if (result.bugs.length > 0) {
    this.alert("Fix introduced new bugs!");
  }
}
```

### Pattern 3: Pre-Commit Validation

```javascript
// Before committing to main
async prepareCommit(changes) {
  // 1. Stage changes
  await this.gitAdd(changes);
  
  // 2. Run quick headless test
  const result = await this.runQA('headless');
  
  // 3. Only commit if tests pass
  if (result.bugs.length === 0) {
    await this.gitCommit();
    await this.gitPush();
  } else {
    this.alert("Tests failed, commit aborted");
  }
}
```

---

## Command Shortcuts

### Run Specific Suites Based on Code Changes

| Code Area Changed | Command to Run |
|-------------------|----------------|
| Combat.js, CombatScene.jsx | `npm run test:qa:combat` |
| ExplorationScene.jsx, *Generator.js | `npm run test:qa:exploration` |
| GameStateContext.jsx | Run all tests |
| UI components only | `TEST_SUITE=ui-ux npm run test:qa` |

### Environment Control

```bash
# Background testing (while working on other tasks)
HEADLESS=true npm run test:qa &

# Debug mode (when tests are failing)
DEBUG=true npm run test:qa:combat

# Quick check (skip long-running tests)
SKIP_SUITES=exploration-interiors,combat-system npm run test:qa
```

---

## Parsing Reports Programmatically

### Extract Bug Count

```bash
bugs=$(cat tests/reports/test-report-*-chromium.json | jq '.bugs | length')
if [ $bugs -gt 0 ]; then
  echo "Found $bugs bugs!"
fi
```

### Extract Failed Tests

```bash
jq '.suites[].tests[] | select(.status == "failed") | .name' \
  tests/reports/test-report-*-chromium.json
```

### Extract Console Errors

```bash
jq '.consoleErrors[] | .text' \
  tests/reports/test-report-*-chromium.json
```

---

## Discord Integration

### Setup

```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### Automatic Notifications

When tests complete, QA Agent will:
1. Post summary to Discord channel
2. Include pass/fail stats
3. List bugs (if < 5)
4. Link to full report

**Use this to:**
- Keep user informed of test progress
- Alert on failures in CI/CD
- Archive test results in Discord

---

## Best Practices

### 1. Run Tests Before Major Changes

```
❌ Bad: Implement 5 features → commit → discover bugs later
✅ Good: Implement feature → test → fix bugs → commit → repeat
```

### 2. Use Appropriate Test Scope

```
❌ Bad: Changed one line → run full 45-minute test suite
✅ Good: Changed combat code → run combat-specific tests (5 min)
```

### 3. Review Failures Immediately

```
❌ Bad: Tests fail → ignore → keep coding
✅ Good: Tests fail → read report → fix → re-test
```

### 4. Keep Test Data Fresh

```
# Clear old test artifacts weekly
rm -rf tests/screenshots/* tests/reports/*
```

---

## Troubleshooting QA Agent

### "Dev server not running"

```bash
# Terminal 1
npm run dev

# Terminal 2 (after server starts)
npm run test:qa
```

### "Tests hanging on character creation"

Issue: Character creation UI changed, agent can't find elements

Solution:
1. Check `GameDriver.js:startNewGame()`
2. Update selectors to match current UI
3. Re-run tests

### "All tests failing"

Likely causes:
1. Dev server not running
2. Port conflict (game not on 3000)
3. Major UI changes broke driver

Quick fix:
```bash
# Change port in config
edit tests/qa-agent/config.js
# Update baseUrl to match actual port
```

---

## Extending Test Coverage

### Add Test for New Feature

1. **Identify test suite** (e.g., "survival-mechanics")
2. **Add to TestSuites.js:**

```javascript
{
  id: 'test-new-feature',
  name: 'Test my new feature',
  async execute(driver, validators) {
    // Navigate to feature
    await driver.openInventory();
    
    // Perform action
    await driver.page.click('text=New Feature Button');
    
    // Validate result
    const logs = await driver.getGameLog();
    validators.validateLogMessage(logs, 'Feature activated');
  }
}
```

3. **Add GameDriver method if needed:**

```javascript
async activateNewFeature() {
  await this.page.click('text=Activate');
  await this.wait(500);
}
```

4. **Test it:**

```bash
npm run test:qa
```

---

## Response Templates

### When Tests Pass

```
✅ QA tests completed successfully!

Results:
- 40/40 tests passed (100%)
- No bugs found
- Tested on Chromium + Firefox
- Duration: 32 minutes

Full report: tests/reports/test-report-2026-01-12-chromium.html

Safe to commit!
```

### When Tests Fail

```
⚠️ QA tests found 2 bugs:

1. **Combat System** [MAJOR]
   - Test: "Test combat turn actions"
   - Error: Spell menu doesn't close after casting
   - Screenshot: tests/screenshots/bug-1.png

2. **Movement** [MINOR]
   - Test: "Test keyboard movement"
   - Error: WASD keys not responding in Firefox

I'll investigate these issues before committing.

Full report: tests/reports/test-report-2026-01-12-chromium.html
```

---

## Maintenance

### Weekly

- Clear old screenshots: `rm tests/screenshots/*`
- Clear old reports: `rm tests/reports/*`
- Review and update test scenarios

### After Major Refactors

- Update `GameDriver.js` selectors if UI changed
- Update `TestSuites.js` if game flow changed
- Re-run full test suite to verify

### When Adding New Scenes

- Add scene indicator to `GameDriver.waitForScene()`
- Add new test suite to `TestSuites.js`
- Test scene transitions

---

## Summary

**Remember:**
1. Run tests after significant changes
2. Review reports before committing
3. Fix bugs immediately
4. Keep test code updated with game changes
5. Use Discord notifications for async feedback

**Quick Commands:**
- `npm run test:qa` - Full test
- `npm run test:qa:headless` - Background test  
- `npm run test:qa:combat` - Combat only
- `npm run test:qa:debug` - Slow + visible

**Reports Location:**
- HTML: `tests/reports/*.html`
- JSON: `tests/reports/*.json`
- Screenshots: `tests/screenshots/`

---

**You're all set!** The QA Agent is ready to help you maintain high quality code. 🚀
