/**
 * QA Agent Configuration
 * 
 * Settings for automated game testing with Playwright
 */

export const QA_CONFIG = {
  // Browser configuration
  browser: {
    // If QA_BROWSER env var is set, use only that browser (for CI)
    // Otherwise test on both browsers (for local testing)
    browsers: process.env.QA_BROWSER 
      ? [process.env.QA_BROWSER] 
      : ['chromium', 'firefox'],
    headless: process.env.HEADLESS === 'true',
    slowMo: process.env.DEBUG === 'true' ? 1000 : 100,
    viewport: { width: 1920, height: 1080 },
    devtools: false,
    recordVideo: process.env.RECORD_VIDEO === 'true' ? {
      dir: './tests/videos',
      size: { width: 1920, height: 1080 }
    } : undefined
  },

  // Game configuration
  game: {
    baseUrl: process.env.GAME_URL || 'http://localhost:3000',
    startupTimeout: 10000,
    actionTimeout: 5000,
    sceneTransitionTimeout: 3000,
    combatTimeout: 30000,  // Combat can take longer
    movementDelay: 500,    // Delay between movements to see animations
  },

  // Test data
  testData: {
    characterName: 'QA-Tester',
    characterClass: 'Paladin',
    // Use MAP_SEED env var if set (for CI), otherwise use default
    mapSeed: process.env.MAP_SEED || 'qa-test-seed-12345',
    freshStart: true,                // Clear localStorage before test
    
    // Alternative test characters for variety
    alternativeCharacters: [
      { name: 'QA-Fighter', class: 'Fighter' },
      { name: 'QA-Wizard', class: 'Wizard' },
      { name: 'QA-Rogue', class: 'Rogue' }
    ]
  },

  // Reporting configuration
  reporting: {
    screenshotOnFail: true,
    screenshotOnPass: false,        // Only capture failures
    captureConsoleErrors: true,
    outputDir: './tests/reports',
    screenshotDir: './tests/screenshots',
    videoDir: './tests/videos',
    
    // Discord webhook configuration
    discord: {
      enabled: process.env.DISCORD_WEBHOOK_URL ? true : false,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      notifyOnSuccess: true,
      notifyOnFailure: true,
      includeScreenshots: true,
      includeSummary: true
    },
    
    // Report formats
    formats: ['html', 'json', 'markdown']
  },

  // Validation settings
  validation: {
    continueOnFailure: true,        // Continue to find all bugs
    strictMode: true,               // Fail on warnings
    checkConsoleErrors: true,
    checkPerformance: false,        // Disable perf checks for now
    performanceThresholds: {
      sceneLoad: 1000,              // ms
      mapGeneration: 2000,
      autosave: 200
    }
  },

  // Test suite selection
  testSuites: {
    // In CI, default to smoke tests unless specified
    runAll: process.env.TEST_SUITE === 'all',
    specific: process.env.TEST_SUITE && process.env.TEST_SUITE !== 'all' 
      ? [process.env.TEST_SUITE] 
      : [],
    skip: process.env.SKIP_SUITES ? process.env.SKIP_SUITES.split(',') : [],
    smokeOnly: process.env.SMOKE_TESTS === 'true' || (!process.env.TEST_SUITE && process.env.HEADLESS === 'true'),
    realTests: process.env.REAL_TESTS === 'true' || process.env.TEST_SUITE === 'real'
  }
};

// Environment variable documentation
export const ENV_VARS = {
  HEADLESS: 'Run browsers in headless mode (true/false)',
  DEBUG: 'Enable debug mode with slow actions (true/false)',
  RECORD_VIDEO: 'Record video of test run (true/false)',
  GAME_URL: 'Base URL of the game (default: http://localhost:3000)',
  DISCORD_WEBHOOK_URL: 'Discord webhook for notifications',
  TEST_SUITE: 'Run specific test suite (combat, exploration, etc.)',
  SKIP_SUITES: 'Comma-separated list of suites to skip',
  QA_BROWSER: 'Run on single browser (chromium/firefox) instead of both',
  MAP_SEED: 'Map seed for reproducible terrain (default: qa-test-seed-12345)'
};
