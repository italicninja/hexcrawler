/**
 * QAAgent - Main test orchestrator
 * 
 * Coordinates test execution across browsers, manages drivers,
 * collects results, and generates reports.
 */

import { GameDriver } from './GameDriver.js';
import { Validators } from './Validators.js';
import { ReportGenerator } from './ReportGenerator.js';
import { TEST_SUITES, getTotalTestCount } from './TestSuites.js';
import { SMOKE_TESTS } from './SmokeTests.js';
import { REAL_TESTS, getRealTestCount } from './RealTests.js';
import { QA_CONFIG } from './config.js';

export class QAAgent {
  constructor(config = QA_CONFIG) {
    this.config = config;
    this.validators = Validators;
  }

  /**
   * Run all tests across all configured browsers
   */
  async run() {
    console.log('🤖 QA Agent Starting...\n');
    
    // Determine test mode
    const testMode = this.config.testSuites.smokeOnly ? 'Smoke Tests' : 'Full Test Suite';
    console.log(`Mode: ${testMode}`);
    console.log(`Browsers: ${this.config.browser.browsers.join(', ')}\n`);

    const allReports = [];

    // Run tests on each browser
    for (const browserType of this.config.browser.browsers) {
      console.log(`\n🌐 Testing on ${browserType}...`);
      
      const report = await this.runBrowser(browserType);
      allReports.push(report);
    }

    console.log('\n✨ All browsers tested!\n');
    
    // Print summary
    this.printSummary(allReports);
    
    return allReports;
  }

  /**
   * Run tests on a specific browser
   */
  async runBrowser(browserType) {
    const driver = new GameDriver(browserType, this.config);
    const reporter = new ReportGenerator(this.config);
    
    reporter.startTimer();
    reporter.setBrowser(browserType);

    try {
      // Launch browser
      console.log(`  Launching ${browserType}...`);
      await driver.launch();
      
      // Filter test suites based on config
      const suitesToRun = this.filterSuites(TEST_SUITES);
      
      // Run each test suite
      for (const suite of suitesToRun) {
        await this.runSuite(driver, reporter, suite);
      }
      
      // Collect console errors
      reporter.addConsoleErrors(driver.getConsoleErrors());
      
    } catch (error) {
      console.error(`  ❌ Fatal error: ${error.message}`);
      reporter.recordFail('Browser Launch', error);
    } finally {
      // Close browser
      await driver.close();
      
      // Generate reports
      reporter.endTimer();
      const reportPaths = await reporter.generate();
      
      console.log(`\n  📄 Reports generated:`);
      reportPaths.forEach(path => console.log(`     - ${path}`));
      
      return reporter.results;
    }
  }

  /**
   * Run a single test suite
   */
  async runSuite(driver, reporter, suite) {
    console.log(`\n  📦 ${suite.name}`);
    reporter.startPhase(suite.name, suite.description);

    for (const test of suite.tests) {
      await this.runTest(driver, reporter, test);
    }

    reporter.endPhase();
  }

  /**
   * Run a single test
   */
  async runTest(driver, reporter, test) {
    const startTime = Date.now();
    
    try {
      // Execute test
      await test.execute(driver, this.validators);
      
      const duration = Date.now() - startTime;
      reporter.recordPass(test.name, duration);
      
      console.log(`    ✅ ${test.name} (${duration}ms)`);
      
      // Capture screenshot if configured
      if (this.config.reporting.screenshotOnPass) {
        const screenshotPath = await driver.screenshot(`${test.id}-pass`);
        reporter.addScreenshot(screenshotPath, test.name);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.log(`    ❌ ${test.name} (${duration}ms)`);
      console.log(`       Error: ${error.message}`);
      
      // Capture screenshot on failure
      let screenshotPath = null;
      if (this.config.reporting.screenshotOnFail) {
        screenshotPath = await driver.screenshot(`${test.id}-fail`);
        reporter.addScreenshot(screenshotPath, `${test.name} - FAILED`);
      }
      
      reporter.recordFail(test.name, error, screenshotPath);
      
      // Check if we should continue or stop
      if (!this.config.validation.continueOnFailure) {
        throw error;
      }
    }
  }

  /**
   * Filter test suites based on configuration
   */
  filterSuites(allSuites) {
    // If smoke tests only, use those
    if (this.config.testSuites.smokeOnly && !this.config.testSuites.realTests) {
      console.log('  ✨ Running SMOKE TESTS only (4 tests, ~10 seconds)');
      console.log('  💡 For real tests, set REAL_TESTS=true or TEST_SUITE=real\n');
      return SMOKE_TESTS;
    }
    
    // If real tests requested, use those
    if (this.config.testSuites.realTests) {
      console.log(`  🧪 Running REAL TESTS (${getRealTestCount()} tests, ~2-3 minutes)`);
      console.log('  These tests validate actual game functionality\n');
      return REAL_TESTS;
    }

    let filtered = allSuites;

    // If specific suites requested, only run those
    if (!this.config.testSuites.runAll && this.config.testSuites.specific.length > 0) {
      filtered = allSuites.filter(suite => 
        this.config.testSuites.specific.includes(suite.id)
      );
      console.log(`  Running specific suites: ${filtered.map(s => s.name).join(', ')}\n`);
    } else {
      console.log(`  Running full test suite (${allSuites.length} suites)\n`);
    }

    // Remove skipped suites
    if (this.config.testSuites.skip.length > 0) {
      filtered = filtered.filter(suite => 
        !this.config.testSuites.skip.includes(suite.id)
      );
    }

    return filtered;
  }

  /**
   * Print summary of all browser results
   */
  printSummary(reports) {
    console.log('═══════════════════════════════════════════');
    console.log('               FINAL SUMMARY               ');
    console.log('═══════════════════════════════════════════\n');

    reports.forEach(report => {
      const passRate = report.totalTests > 0 
        ? ((report.passed / report.totalTests) * 100).toFixed(1) 
        : '0';
      
      const status = report.failed === 0 ? '✅ PASS' : '❌ FAIL';
      
      console.log(`${status} ${report.browser.toUpperCase()}`);
      console.log(`  Tests: ${report.passed}/${report.totalTests} passed (${passRate}%)`);
      console.log(`  Duration: ${this.formatDuration(report.duration)}`);
      console.log(`  Bugs: ${report.bugs.length}\n`);
    });

    // Aggregate stats
    const totalBugs = reports.reduce((sum, r) => sum + r.bugs.length, 0);
    const totalTests = reports.reduce((sum, r) => sum + r.totalTests, 0);
    const totalPassed = reports.reduce((sum, r) => sum + r.passed, 0);
    
    console.log('═══════════════════════════════════════════');
    console.log(`Overall: ${totalPassed}/${totalTests} tests passed`);
    console.log(`Total bugs found: ${totalBugs}`);
    console.log('═══════════════════════════════════════════\n');
  }

  /**
   * Format duration
   */
  formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
