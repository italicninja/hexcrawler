#!/usr/bin/env node

/**
 * Simple Smoke Test for CI
 * 
 * Minimal test that just verifies the game loads without errors.
 * No complex framework, just pure Playwright.
 */

import { chromium, firefox } from 'playwright';

const GAME_URL = process.env.GAME_URL || 'http://localhost:4173';
const BROWSER_TYPE = process.env.QA_BROWSER || 'chromium';

async function runSmokeTest() {
  console.log(`\n🧪 Running smoke test on ${BROWSER_TYPE}...\n`);
  
  let browser, page;
  let exitCode = 0;
  
  try {
    // Launch browser
    console.log('  ⏳ Launching browser...');
    if (BROWSER_TYPE === 'firefox') {
      browser = await firefox.launch({ headless: true });
    } else {
      browser = await chromium.launch({ headless: true });
    }
    
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    // Navigate to game
    console.log(`  ⏳ Loading ${GAME_URL}...`);
    const response = await page.goto(GAME_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Test 1: Page loads with 200 status
    if (!response.ok()) {
      throw new Error(`Page returned ${response.status()}`);
    }
    console.log('  ✅ Page loads successfully (HTTP 200)');
    
    // Test 2: Root element exists
    const rootExists = await page.locator('#root').count() > 0;
    if (!rootExists) {
      throw new Error('Root element #root not found');
    }
    console.log('  ✅ Root element exists');
    
    // Test 3: Some content rendered
    await page.waitForTimeout(2000); // Give React time to mount
    const bodyHasContent = await page.locator('body *').count() > 10;
    if (!bodyHasContent) {
      throw new Error('Body has no content - React may not have mounted');
    }
    console.log('  ✅ React mounted successfully');
    
    // Test 4: Title scene or game UI visible
    const hasGameUI = (await page.getByText('New Game').count() > 0) ||
                       (await page.getByText('Hexcrawler').count() > 0) ||
                       (await page.locator('canvas').count() > 0);
    
    if (!hasGameUI) {
      throw new Error('No game UI elements found');
    }
    console.log('  ✅ Game UI rendered');
    
    // Test 5: Check console errors
    const criticalErrors = errors.filter(e => 
      !e.includes('DevTools') &&
      !e.includes('Download the React') &&
      !e.includes('key prop')
    );
    
    if (criticalErrors.length > 0) {
      console.log(`  ⚠️  Found ${criticalErrors.length} console errors (non-critical)`);
      criticalErrors.forEach(e => console.log(`     - ${e.substring(0, 100)}`));
    } else {
      console.log('  ✅ No console errors');
    }
    
    console.log(`\n✅ Smoke test PASSED on ${BROWSER_TYPE}!\n`);
    
  } catch (error) {
    console.error(`\n❌ Smoke test FAILED on ${BROWSER_TYPE}:`);
    console.error(`   ${error.message}\n`);
    exitCode = 1;
    
    // Take screenshot on failure
    if (page) {
      try {
        const screenshotPath = `tests/screenshots/smoke-test-${BROWSER_TYPE}-failure.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`   Screenshot saved: ${screenshotPath}\n`);
      } catch (e) {
        console.error(`   Could not save screenshot: ${e.message}`);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  process.exit(exitCode);
}

runSmokeTest();
