#!/usr/bin/env node

/**
 * QA Agent Runner
 * 
 * Main entry point for running automated game tests.
 * 
 * Usage:
 *   node tests/qa-agent/run.js
 *   npm run test:qa
 *   npm run test:qa:headless
 */

import { QAAgent } from './QAAgent.js';
import { QA_CONFIG } from './config.js';

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║     🎮 Hexcrawler QA Agent v1.0.0         ║
║     Automated Game Testing System         ║
╚════════════════════════════════════════════╝
  `);

  try {
    const agent = new QAAgent(QA_CONFIG);
    const results = await agent.run();
    
    // Exit code based on results
    const hasFailures = results.some(r => r.failed > 0);
    process.exit(hasFailures ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Fatal error running QA Agent:');
    console.error(error);
    process.exit(1);
  }
}

main();
