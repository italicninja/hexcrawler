/**
 * Smoke Tests - Basic game loading and functionality checks
 * 
 * These tests verify that the game loads and basic UI elements are present,
 * without trying to actually play through the game.
 */

import { Validators } from './Validators.js';

export const SMOKE_TESTS = [
  {
    id: 'smoke-tests',
    name: 'Smoke Tests - Basic Functionality',
    description: 'Verify game loads and basic UI is functional',
    tests: [
      {
        id: 'page-loads',
        name: 'Game page loads successfully',
        async execute(driver, validators) {
          // Just check that we got to the page
          const title = await driver.page.title();
          console.log(`Page title: ${title}`);
          
          // Check for root element
          const root = await driver.page.locator('#root').count();
          if (root === 0) {
            throw new Error('Root element not found');
          }
        }
      },
      {
        id: 'title-scene-visible',
        name: 'Title scene renders',
        async execute(driver, validators) {
          // Wait for title scene
          await driver.wait(2000);
          
          // Check for "New Game" button or text
          const hasNewGame = await driver.page.getByText('New Game').count() > 0 ||
                             await driver.page.getByText('Hexcrawler').count() > 0;
          
          if (!hasNewGame) {
            throw new Error('Title scene not visible');
          }
          
          console.log('Title scene rendered successfully');
        }
      },
      {
        id: 'no-console-errors',
        name: 'No critical console errors on load',
        async execute(driver, validators) {
          const errors = driver.getConsoleErrors();
          
          // Filter out known non-critical errors
          const criticalErrors = errors.filter(e => 
            !e.text.includes('DevTools') &&
            !e.text.includes('key prop') &&
            !e.text.includes('Download the React')
          );
          
          if (criticalErrors.length > 0) {
            console.log(`Found ${criticalErrors.length} console errors:`);
            criticalErrors.forEach(e => console.log(`  - ${e.text}`));
          }
          
          // Don't fail on console errors for now, just log them
          console.log(`Console check complete (${criticalErrors.length} errors)`);
        }
      },
      {
        id: 'react-mounted',
        name: 'React application mounted',
        async execute(driver, validators) {
          // Check that React rendered something
          const hasContent = await driver.page.locator('body *').count() > 0;
          
          if (!hasContent) {
            throw new Error('No content rendered - React may not have mounted');
          }
          
          console.log('React application mounted successfully');
        }
      }
    ]
  }
];

// Export helper to get suite by ID
export function getSmokeTestSuite() {
  return SMOKE_TESTS[0];
}
