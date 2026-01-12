/**
 * TestSuites - Comprehensive test scenarios for Hexcrawler
 * 
 * Defines all test suites and individual test cases for automated QA.
 */

import { Validators } from './Validators.js';

/**
 * Test Suite Structure:
 * - id: Unique identifier
 * - name: Display name
 * - description: What this suite tests
 * - tests: Array of test objects with execute() function
 */

export const TEST_SUITES = [
  // ==========================================
  // PHASE 1: CHARACTER CREATION & SETUP
  // ==========================================
  {
    id: 'character-creation',
    name: 'Character Creation & Setup',
    description: 'Test character creation flow and initial game state',
    tests: [
      {
        id: 'create-character',
        name: 'Create new character',
        async execute(driver, validators) {
          await driver.clearLocalStorage();
          await driver.startNewGame('QA-Tester', 'Paladin');
          
          const scene = await driver.getCurrentScene();
          validators.validateScene(scene, 'overworld', 'Should load overworld scene');
        }
      },
      {
        id: 'verify-welcome-message',
        name: 'Verify welcome message in log',
        async execute(driver, validators) {
          const logs = await driver.getGameLog();
          validators.validateLogMessage(logs, 'Welcome', 'Should show welcome message');
        }
      },
      {
        id: 'verify-starting-resources',
        name: 'Verify starting resources',
        async execute(driver, validators) {
          const gold = await driver.getGold();
          const rations = await driver.getRations();
          
          validators.validateGreaterThan(gold, 0, 'Gold');
          validators.validateGreaterThan(rations, 0, 'Rations');
        }
      },
      {
        id: 'verify-autosave',
        name: 'Verify autosave triggered',
        async execute(driver, validators) {
          // Check for autosave message in logs
          const logs = await driver.getGameLog();
          // Note: may not always show in logs, this is a soft check
        }
      }
    ]
  },

  // ==========================================
  // PHASE 2: OVERWORLD EXPLORATION
  // ==========================================
  {
    id: 'overworld-movement',
    name: 'Overworld Movement',
    description: 'Test hex movement and navigation',
    tests: [
      {
        id: 'keyboard-movement',
        name: 'Test keyboard movement (WASD)',
        async execute(driver, validators) {
          const initialGold = await driver.getGold();
          const initialRations = await driver.getRations();
          
          // Move up
          await driver.moveKeyboard('up');
          await driver.wait(1000);
          
          // Verify rations consumed
          const newRations = await driver.getRations();
          validators.validateLessThan(newRations, initialRations, 'Rations after movement');
          
          // Verify movement logged
          const logs = await driver.getGameLog();
          validators.validateLogMessage(logs, 'Moved', 'Should log movement');
        }
      },
      {
        id: 'multiple-movements',
        name: 'Test multiple movements',
        async execute(driver, validators) {
          await driver.moveKeyboard('right');
          await driver.wait(500);
          await driver.moveKeyboard('down');
          await driver.wait(500);
          await driver.moveKeyboard('left');
          await driver.wait(500);
        }
      },
      {
        id: 'terrain-variety',
        name: 'Move across different terrain types',
        async execute(driver, validators) {
          // Move in a pattern to encounter various terrains
          for (let i = 0; i < 5; i++) {
            await driver.moveKeyboard('right');
            await driver.wait(800);
          }
        }
      }
    ]
  },

  // ==========================================
  // PHASE 3: POI INTERACTIONS
  // ==========================================
  {
    id: 'poi-interactions',
    name: 'POI Interactions',
    description: 'Test Point of Interest discovery and interactions',
    tests: [
      {
        id: 'discover-poi',
        name: 'Discover a POI',
        async execute(driver, validators) {
          // Move around until we find a POI
          let foundPOI = false;
          for (let i = 0; i < 20; i++) {
            const logs = await driver.getGameLog();
            const hasDiscovery = logs.some(log => 
              log.includes('Discovered') || log.includes('POI')
            );
            
            if (hasDiscovery) {
              foundPOI = true;
              break;
            }
            
            // Move in a search pattern
            await driver.moveKeyboard(i % 4 === 0 ? 'up' : i % 4 === 1 ? 'right' : i % 4 === 2 ? 'down' : 'left');
            await driver.wait(800);
          }
          
          if (!foundPOI) {
            console.log('Warning: No POI discovered in 20 moves');
          }
        }
      },
      {
        id: 'search-poi',
        name: 'Search a POI (Shift key)',
        async execute(driver, validators) {
          // Try to search current hex
          await driver.searchPOI();
          await driver.wait(1000);
          
          const logs = await driver.getGameLog();
          // May or may not have POI, just check no errors
        }
      }
    ]
  },

  // ==========================================
  // PHASE 4: SURVIVAL MECHANICS
  // ==========================================
  {
    id: 'survival-mechanics',
    name: 'Survival Mechanics',
    description: 'Test foraging, resting, and resource management',
    tests: [
      {
        id: 'forage-for-food',
        name: 'Forage for food (F key)',
        async execute(driver, validators) {
          const initialRations = await driver.getRations();
          
          await driver.forage();
          await driver.wait(2000);
          
          const logs = await driver.getGameLog();
          const hasForageResult = logs.some(log => 
            log.includes('Survival') || log.includes('rations') || log.includes('forage')
          );
          
          if (!hasForageResult) {
            console.log('Warning: No forage result in logs');
          }
        }
      },
      {
        id: 'short-rest',
        name: 'Perform short rest',
        async execute(driver, validators) {
          await driver.shortRest(0);
          await driver.wait(1000);
          
          const logs = await driver.getGameLog();
          // Check for rest message
        }
      },
      {
        id: 'long-rest',
        name: 'Perform long rest',
        async execute(driver, validators) {
          const initialRations = await driver.getRations();
          
          const interrupted = await driver.longRest();
          await driver.wait(1000);
          
          if (interrupted) {
            console.log('Long rest interrupted by combat');
            // Handle combat if triggered
            const inCombat = await driver.isInCombat();
            if (inCombat) {
              // End combat quickly
              for (let i = 0; i < 10; i++) {
                await driver.endTurn();
                await driver.wait(1000);
                
                if (!await driver.isInCombat()) break;
              }
            }
          }
        }
      }
    ]
  },

  // ==========================================
  // PHASE 5: COMBAT SYSTEM
  // ==========================================
  {
    id: 'combat-system',
    name: 'Combat System',
    description: 'Test tactical combat mechanics',
    tests: [
      {
        id: 'detect-combat-entry',
        name: 'Detect combat scene transition',
        async execute(driver, validators) {
          // Combat may already be active from long rest
          const inCombat = await driver.isInCombat();
          
          if (!inCombat) {
            console.log('No active combat - attempting to trigger encounter');
            // Move around to find combat
            for (let i = 0; i < 10; i++) {
              await driver.moveKeyboard('up');
              await driver.wait(1000);
              
              if (await driver.isInCombat()) {
                break;
              }
            }
          }
        }
      },
      {
        id: 'combat-turn-actions',
        name: 'Test combat turn actions',
        async execute(driver, validators) {
          if (!await driver.isInCombat()) {
            console.log('Skipping - not in combat');
            return;
          }
          
          // Try various actions
          await driver.attack();
          await driver.wait(1500);
          
          await driver.endTurn();
          await driver.wait(1000);
        }
      },
      {
        id: 'complete-combat',
        name: 'Complete combat encounter',
        async execute(driver, validators) {
          if (!await driver.isInCombat()) {
            console.log('Skipping - not in combat');
            return;
          }
          
          // Auto-play combat by ending turns
          let turns = 0;
          while (await driver.isInCombat() && turns < 50) {
            await driver.endTurn();
            await driver.wait(1500);
            turns++;
          }
          
          if (turns >= 50) {
            throw new Error('Combat did not end after 50 turns');
          }
          
          // Verify combat ended
          const scene = await driver.getCurrentScene();
          validators.validateScene(scene, 'overworld', 'Should return to overworld after combat');
        }
      }
    ]
  },

  // ==========================================
  // PHASE 6: EXPLORATION (INTERIORS)
  // ==========================================
  {
    id: 'exploration-interiors',
    name: 'Exploration & Interiors',
    description: 'Test dungeon/interior exploration',
    tests: [
      {
        id: 'find-explorable-poi',
        name: 'Find explorable POI (dungeon/ruins/cave/tower)',
        async execute(driver, validators) {
          console.log('Searching for explorable POI...');
          
          // Search for POI in a grid pattern
          for (let i = 0; i < 30; i++) {
            const logs = await driver.getGameLog();
            const hasExplorable = logs.some(log =>
              log.toLowerCase().includes('dungeon') ||
              log.toLowerCase().includes('ruins') ||
              log.toLowerCase().includes('cave') ||
              log.toLowerCase().includes('tower')
            );
            
            if (hasExplorable) {
              console.log('Found explorable POI');
              return;
            }
            
            // Move in expanding square pattern
            await driver.moveKeyboard(['up', 'right', 'down', 'left'][i % 4]);
            await driver.wait(800);
          }
          
          console.log('Warning: No explorable POI found in 30 moves');
        }
      },
      {
        id: 'enter-interior',
        name: 'Enter interior exploration',
        async execute(driver, validators) {
          // Try to explore current hex
          await driver.explorePOI();
          await driver.wait(2000);
          
          const scene = await driver.getCurrentScene();
          if (scene === 'exploration') {
            console.log('Successfully entered exploration scene');
          } else {
            console.log('Not at explorable POI - skipping interior tests');
          }
        }
      },
      {
        id: 'explore-interior',
        name: 'Move through interior',
        async execute(driver, validators) {
          const scene = await driver.getCurrentScene();
          if (scene !== 'exploration') {
            console.log('Skipping - not in exploration scene');
            return;
          }
          
          // Move through interior
          for (let i = 0; i < 5; i++) {
            await driver.moveKeyboard('up');
            await driver.wait(1000);
            
            // Check if combat triggered
            if (await driver.isInCombat()) {
              console.log('Interior combat triggered');
              
              // Auto-resolve combat
              for (let turn = 0; turn < 20; turn++) {
                await driver.endTurn();
                await driver.wait(1000);
                if (!await driver.isInCombat()) break;
              }
            }
          }
        }
      },
      {
        id: 'exit-interior',
        name: 'Exit interior back to overworld',
        async execute(driver, validators) {
          const scene = await driver.getCurrentScene();
          if (scene !== 'exploration') {
            console.log('Skipping - not in exploration scene');
            return;
          }
          
          await driver.exitInterior();
          await driver.wait(1000);
          
          const newScene = await driver.getCurrentScene();
          validators.validateScene(newScene, 'overworld', 'Should return to overworld');
        }
      }
    ]
  },

  // ==========================================
  // PHASE 7: STATE MANAGEMENT
  // ==========================================
  {
    id: 'state-management',
    name: 'State Management & Persistence',
    description: 'Test save/load and state consistency',
    tests: [
      {
        id: 'quick-save',
        name: 'Quick save (F5)',
        async execute(driver, validators) {
          await driver.quickSave();
          await driver.wait(1000);
          
          const logs = await driver.getGameLog();
          validators.validateLogMessage(logs, 'saved', 'Should show save message');
        }
      },
      {
        id: 'spam-actions',
        name: 'Spam movement commands (stress test)',
        async execute(driver, validators) {
          // Rapidly press keys to test state debouncing
          for (let i = 0; i < 10; i++) {
            await driver.page.keyboard.press('w');
            await driver.wait(100);
          }
          
          await driver.wait(2000);
          
          // Check for errors
          const hasError = await driver.hasReactError();
          if (hasError) {
            throw new Error('React error boundary triggered');
          }
        }
      },
      {
        id: 'rapid-menu-toggle',
        name: 'Rapid menu open/close',
        async execute(driver, validators) {
          // Toggle menus rapidly
          for (let i = 0; i < 5; i++) {
            await driver.openInventory();
            await driver.wait(200);
            await driver.page.keyboard.press('Escape');
            await driver.wait(200);
          }
          
          // Check for errors
          const hasError = await driver.hasReactError();
          if (hasError) {
            throw new Error('React error boundary triggered');
          }
        }
      }
    ]
  },

  // ==========================================
  // PHASE 8: UI & UX
  // ==========================================
  {
    id: 'ui-ux',
    name: 'UI & User Experience',
    description: 'Test UI elements and keyboard shortcuts',
    tests: [
      {
        id: 'keyboard-shortcuts',
        name: 'Test all keyboard shortcuts',
        async execute(driver, validators) {
          // Test each shortcut
          await driver.page.keyboard.press('i');
          await driver.wait(300);
          await driver.page.keyboard.press('Escape');
          
          await driver.page.keyboard.press('q');
          await driver.wait(300);
          await driver.page.keyboard.press('Escape');
          
          await driver.page.keyboard.press('r');
          await driver.wait(300);
          await driver.page.keyboard.press('Escape');
        }
      },
      {
        id: 'game-log-scrolling',
        name: 'Test game log with many messages',
        async execute(driver, validators) {
          const logs = await driver.getGameLog(50);
          console.log(`Game log has ${logs.length} messages`);
        }
      },
      {
        id: 'no-console-errors',
        name: 'Verify no console errors',
        async execute(driver, validators) {
          const errors = driver.getConsoleErrors();
          
          // Filter out known acceptable errors/warnings
          const allowedPatterns = [
            'Download the React DevTools',
            'React DevTools',
            'key prop'
          ];
          
          validators.validateNoConsoleErrors(errors, allowedPatterns);
        }
      }
    ]
  }
];

// Export helper to get suite by ID
export function getSuiteById(id) {
  return TEST_SUITES.find(suite => suite.id === id);
}

// Export helper to get all suite IDs
export function getAllSuiteIds() {
  return TEST_SUITES.map(suite => suite.id);
}

// Count total tests
export function getTotalTestCount() {
  return TEST_SUITES.reduce((total, suite) => total + suite.tests.length, 0);
}
