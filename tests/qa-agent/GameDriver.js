/**
 * GameDriver - Playwright wrapper for Hexcrawler game interactions
 * 
 * Provides high-level methods for interacting with the game UI
 * and inspecting game state during automated testing.
 */

import { chromium, firefox } from 'playwright';
import { QA_CONFIG } from './config.js';

export class GameDriver {
  constructor(browserType = 'chromium', config = QA_CONFIG) {
    this.browserType = browserType;
    this.config = config;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.consoleErrors = [];
    this.consoleLogs = [];
  }

  /**
   * Launch browser and navigate to game
   */
  async launch() {
    const browserConfig = {
      headless: this.config.browser.headless,
      slowMo: this.config.browser.slowMo,
      devtools: this.config.browser.devtools,
    };

    // Launch browser based on type
    if (this.browserType === 'chromium') {
      this.browser = await chromium.launch(browserConfig);
    } else if (this.browserType === 'firefox') {
      this.browser = await firefox.launch(browserConfig);
    } else {
      throw new Error(`Unsupported browser: ${this.browserType}`);
    }

    // Create context with viewport
    this.context = await this.browser.newContext({
      viewport: this.config.browser.viewport,
      recordVideo: this.config.browser.recordVideo,
    });

    // Create page
    this.page = await this.context.newPage();

    // Setup console listeners
    this.setupConsoleListeners();

    // Navigate to game
    await this.page.goto(this.config.game.baseUrl, {
      waitUntil: 'networkidle',
      timeout: this.config.game.startupTimeout
    });

    // Wait for React to mount
    await this.page.waitForSelector('#root', { timeout: 5000 });
  }

  /**
   * Setup console log/error listeners
   */
  setupConsoleListeners() {
    this.page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      this.consoleLogs.push({ type, text, timestamp: Date.now() });
      
      if (type === 'error') {
        this.consoleErrors.push({ text, timestamp: Date.now() });
      }
    });

    this.page.on('pageerror', error => {
      this.consoleErrors.push({
        text: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Close browser
   */
  async close() {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Clear localStorage (fresh game state)
   */
  async clearLocalStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
    });
  }

  /**
   * Capture screenshot
   */
  async screenshot(name) {
    const path = `${this.config.reporting.screenshotDir}/${name}-${this.browserType}.png`;
    await this.page.screenshot({ path, fullPage: true });
    return path;
  }

  /**
   * Wait for a specific amount of time
   */
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }

  // =========================
  // NAVIGATION & SCENES
  // =========================

  /**
   * Start a new game with character creation
   */
  async startNewGame(characterName, characterClass, mapSeed = null) {
    // Wait for title screen
    await this.page.waitForSelector('text=New Game', { timeout: 5000 });
    
    // Click New Game button
    await this.page.click('text=New Game');
    
    // Wait for character creation scene
    await this.waitForScene('characterCreation');
    
    // Enter character name
    const nameInput = await this.page.waitForSelector('input[type="text"]', { timeout: 3000 });
    await nameInput.fill(characterName);
    
    // Select class
    const classButton = await this.page.waitForSelector(`text=${characterClass}`, { timeout: 3000 });
    await classButton.click();
    
    // If map seed provided, enter it (need to check if advanced options exist)
    if (mapSeed) {
      // This may require expanding advanced options - skip for now
      console.log(`Map seed ${mapSeed} requested but not yet implemented in UI`);
    }
    
    // Click "Begin Adventure"
    await this.page.click('text=Begin Adventure');
    
    // Wait for overworld scene to load
    await this.waitForScene('overworld', 10000);
    
    // Wait for map generation to complete
    await this.wait(2000);
  }

  /**
   * Wait for a specific scene to load
   */
  async waitForScene(sceneName, timeout = 3000) {
    // Different scenes have different indicators
    const sceneIndicators = {
      title: 'text=New Game',
      characterCreation: 'text=Begin Adventure',
      overworld: 'canvas',
      combat: 'text=End Turn',
      exploration: 'text=Exit Interior',
      town: 'text=Exit Town',
      gameover: 'text=Return to Title'
    };

    const selector = sceneIndicators[sceneName];
    if (!selector) {
      throw new Error(`Unknown scene: ${sceneName}`);
    }

    await this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Get current scene name (by inspecting UI)
   */
  async getCurrentScene() {
    // Check for scene-specific elements
    const indicators = {
      title: 'text=New Game',
      characterCreation: 'text=Begin Adventure',
      combat: 'text=End Turn',
      exploration: 'text=Exit Interior',
      town: 'text=Exit Town',
      gameover: 'text=Return to Title',
      overworld: 'canvas' // Default if nothing else matches
    };

    for (const [scene, selector] of Object.entries(indicators)) {
      const exists = await this.page.locator(selector).count() > 0;
      if (exists && scene !== 'overworld') {
        return scene;
      }
    }

    return 'overworld';
  }

  // =========================
  // PLAYER POSITION & MOVEMENT
  // =========================

  /**
   * Get player position from UI
   */
  async getPlayerPosition() {
    // Look for position display in UI (e.g., "Position: (15, 10)")
    const posText = await this.page.textContent('[class*="position"]').catch(() => null);
    
    if (posText) {
      const match = posText.match(/\((\d+),\s*(\d+)\)/);
      if (match) {
        return { col: parseInt(match[1]), row: parseInt(match[2]) };
      }
    }

    // Fallback: return null if can't find position
    return null;
  }

  /**
   * Click on a hex at specific coordinates
   */
  async clickHex(col, row) {
    // This requires calculating canvas coordinates from hex grid
    // For now, we'll use a simpler approach: click relative positions
    console.log(`Click hex (${col}, ${row}) - requires canvas coordinate calculation`);
    
    // Placeholder: just click center of canvas
    const canvas = await this.page.locator('canvas').first();
    await canvas.click();
  }

  /**
   * Move to adjacent hex using keyboard
   */
  async moveKeyboard(direction) {
    const keyMap = {
      up: 'w',
      down: 's',
      left: 'a',
      right: 'd'
    };

    const key = keyMap[direction];
    if (!key) {
      throw new Error(`Invalid direction: ${direction}`);
    }

    await this.page.keyboard.press(key);
    await this.wait(this.config.game.movementDelay);
  }

  /**
   * Click "Move Here" button
   */
  async clickMoveButton() {
    await this.page.click('text=Move Here');
    await this.wait(this.config.game.movementDelay);
  }

  // =========================
  // POI INTERACTIONS
  // =========================

  /**
   * Search POI (Shift key)
   */
  async searchPOI() {
    await this.page.keyboard.press('Shift');
    await this.wait(500);
  }

  /**
   * Explore POI (Spacebar or button)
   */
  async explorePOI() {
    await this.page.keyboard.press(' ');
    await this.wait(1000);
  }

  /**
   * Pray at shrine (button)
   */
  async prayAtShrine() {
    await this.page.click('text=Pray');
    await this.wait(500);
  }

  /**
   * Offer gold at shrine
   */
  async offerGold() {
    await this.page.click('text=Offer 10g');
    await this.wait(500);
  }

  /**
   * Enter town/settlement
   */
  async enterTown() {
    await this.page.keyboard.press(' ');
    await this.waitForScene('town');
  }

  /**
   * Exit town back to overworld
   */
  async exitTown() {
    // Walk to gate hex (requires movement)
    await this.page.click('text=Exit Town');
    await this.waitForScene('overworld');
  }

  /**
   * Exit interior/exploration back to overworld
   */
  async exitInterior() {
    await this.page.click('text=Exit Interior');
    await this.waitForScene('overworld');
  }

  // =========================
  // SURVIVAL ACTIONS
  // =========================

  /**
   * Forage for food (F key or menu)
   */
  async forage() {
    await this.page.keyboard.press('f');
    await this.wait(1000);
  }

  /**
   * Open rest menu (R key)
   */
  async openRestMenu() {
    await this.page.keyboard.press('r');
    await this.wait(500);
  }

  /**
   * Perform short rest
   */
  async shortRest(hitDice = 0) {
    await this.openRestMenu();
    
    // Set hit dice slider if needed
    if (hitDice > 0) {
      // Find slider and set value
      const slider = await this.page.locator('input[type="range"]').first();
      await slider.fill(hitDice.toString());
    }
    
    await this.page.click('text=Short Rest');
    await this.wait(1000);
  }

  /**
   * Perform long rest
   */
  async longRest() {
    await this.openRestMenu();
    await this.page.click('text=Long Rest');
    await this.wait(1000);
    
    // May trigger combat encounter
    const inCombat = await this.getCurrentScene() === 'combat';
    return inCombat;
  }

  /**
   * Rest at inn (in town)
   */
  async innRest() {
    // Must be at inn building
    await this.page.click('text=Rest (10g)');
    await this.wait(1000);
  }

  // =========================
  // COMBAT ACTIONS
  // =========================

  /**
   * Check if in combat
   */
  async isInCombat() {
    return await this.getCurrentScene() === 'combat';
  }

  /**
   * Get combat state (turn order, current turn, etc.)
   */
  async getCombatState() {
    if (!await this.isInCombat()) {
      return null;
    }

    // Extract combat info from UI
    const roundText = await this.page.textContent('text=/Round \\d+/').catch(() => 'Round 1');
    const round = parseInt(roundText.match(/\\d+/)?.[0] || '1');

    return {
      round,
      active: true
    };
  }

  /**
   * Perform attack action
   */
  async attack() {
    await this.page.click('text=Attack');
    
    // Click on enemy (first available)
    // This requires clicking on canvas - simplified for now
    const canvas = await this.page.locator('canvas').first();
    await canvas.click({ position: { x: 800, y: 400 } });
    
    await this.wait(1000);
  }

  /**
   * End combat turn
   */
  async endTurn() {
    await this.page.click('text=End Turn');
    await this.wait(500);
  }

  /**
   * Wait for combat to end
   */
  async waitForCombatEnd(timeout = 30000) {
    const startTime = Date.now();
    
    while (await this.isInCombat()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Combat timeout exceeded');
      }
      await this.wait(1000);
    }
  }

  // =========================
  // QUESTS
  // =========================

  /**
   * Open quest log (Q key)
   */
  async openQuestLog() {
    await this.page.keyboard.press('q');
    await this.wait(500);
  }

  /**
   * Accept quest from quest board
   */
  async acceptQuest(questName = null) {
    // If questName provided, click specific quest, otherwise first available
    if (questName) {
      await this.page.click(`text=${questName}`);
    } else {
      await this.page.click('button:has-text("Accept")').first();
    }
    await this.wait(500);
  }

  // =========================
  // INVENTORY & EQUIPMENT
  // =========================

  /**
   * Open inventory/equipment (I key)
   */
  async openInventory() {
    await this.page.keyboard.press('i');
    await this.wait(500);
  }

  /**
   * Get character gold amount
   */
  async getGold() {
    const goldText = await this.page.textContent('text=/\\d+ gold/i').catch(() => '0 gold');
    const match = goldText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get character rations
   */
  async getRations() {
    const rationText = await this.page.textContent('text=/\\d+ rations/i').catch(() => '0 rations');
    const match = rationText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  // =========================
  // GAME LOG
  // =========================

  /**
   * Get recent game log messages
   */
  async getGameLog(limit = 10) {
    const messages = await this.page.locator('[class*="log-message"]').allTextContents();
    return messages.slice(-limit);
  }

  /**
   * Wait for specific message in game log
   */
  async waitForMessage(text, timeout = 5000) {
    await this.page.waitForSelector(`text=${text}`, { timeout });
  }

  /**
   * Check if message exists in log
   */
  async hasLogMessage(text) {
    const count = await this.page.locator(`text=${text}`).count();
    return count > 0;
  }

  // =========================
  // SAVE/LOAD
  // =========================

  /**
   * Quick save (F5)
   */
  async quickSave() {
    await this.page.keyboard.press('F5');
    await this.wait(500);
  }

  /**
   * Save to specific slot
   */
  async saveGame(slotNumber) {
    // Open save menu (need to implement)
    console.log(`Save to slot ${slotNumber} - requires menu navigation`);
  }

  /**
   * Load game from slot
   */
  async loadGame(slotNumber) {
    console.log(`Load from slot ${slotNumber} - requires menu navigation`);
  }

  // =========================
  // VALIDATION HELPERS
  // =========================

  /**
   * Get console errors collected during test
   */
  getConsoleErrors() {
    return this.consoleErrors;
  }

  /**
   * Clear console error log
   */
  clearConsoleErrors() {
    this.consoleErrors = [];
  }

  /**
   * Check if page has React errors
   */
  async hasReactError() {
    const errorBoundary = await this.page.locator('text=/Something went wrong/i').count();
    return errorBoundary > 0;
  }
}
