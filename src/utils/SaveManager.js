import { SAVE } from '../constants/gameConstants';

/**
 * SaveManager - Handles game save/load operations with multiple save slots
 * 
 * Save Slot System:
 * - 3 quicksave slots (hexcrawl_quicksave_a, _b, _c)
 * - 3 manual save slots (hexcrawl_save_slot_1, _2, _3)
 * - 1 auto-save slot (hexcrawl_autosave)
 * - Active slot tracking (hexcrawl_active_slot)
 * - Last quicksave tracking (hexcrawl_last_quicksave_slot)
 */

export class SaveManager {
  static SAVE_SLOTS = {
    QUICKSAVE_A: 'hexcrawl_quicksave_a',
    QUICKSAVE_B: 'hexcrawl_quicksave_b',
    QUICKSAVE_C: 'hexcrawl_quicksave_c',
    SLOT_1: 'hexcrawl_save_slot_1',
    SLOT_2: 'hexcrawl_save_slot_2',
    SLOT_3: 'hexcrawl_save_slot_3',
    AUTOSAVE: 'hexcrawl_autosave'
  };

  static ACTIVE_SLOT_KEY = 'hexcrawl_active_slot';
  static LAST_QUICKSAVE_KEY = 'hexcrawl_last_quicksave_slot';
  static SAVE_VERSION = SAVE.VERSION; // From constants

  /**
   * Save game state to a specific slot
   * @param {string} slotKey - One of SAVE_SLOTS
   * @param {object} gameState - Full game state object
   * @returns {boolean} Success status
   */
  static saveToSlot(slotKey, gameState) {
    try {
      if (!gameState.playerCharacter) {
        console.warn('Cannot save: no player character');
        return false;
      }

      // Convert Sets to arrays for JSON serialization
      const serializeExplorationState = () => {
        const clearedEncounters = {};
        const collectedLoot = {};
        const triggeredHazards = {};

        Object.keys(gameState.explorationState.clearedEncounters).forEach(key => {
          clearedEncounters[key] = Array.from(gameState.explorationState.clearedEncounters[key]);
        });
        Object.keys(gameState.explorationState.collectedLoot).forEach(key => {
          collectedLoot[key] = Array.from(gameState.explorationState.collectedLoot[key]);
        });
        Object.keys(gameState.explorationState.triggeredHazards).forEach(key => {
          triggeredHazards[key] = Array.from(gameState.explorationState.triggeredHazards[key]);
        });

        return {
          searchedPOIs: Array.from(gameState.explorationState.searchedPOIs),
          clearedEncounters,
          collectedLoot,
          triggeredHazards
        };
      };

      // Generate metadata for save slot display
      const metadata = {
        characterName: gameState.playerCharacter.name,
        level: gameState.playerCharacter.level,
        class: gameState.playerCharacter.class,
        location: this._getCurrentLocationName(gameState),
        day: gameState.gameTime.day,
        playtime: gameState.playtime || 0
      };

      const saveData = {
        version: this.SAVE_VERSION,
        timestamp: Date.now(),
        metadata,
        gameData: {
          playerPosition: gameState.playerPosition,
          playerCharacter: gameState.playerCharacter?.toJSON(),
          party: gameState.party?.toJSON(),
          currentScene: gameState.currentScene,
          mapSeed: gameState.mapSeed,
          exploredHexes: Array.from(gameState.exploredHexes),
          discoveredPOIs: Array.from(gameState.discoveredPOIs),
          mapData: gameState.mapData,
          interiorMaps: gameState.interiorMaps,
          explorationState: serializeExplorationState(),
          gameTime: gameState.gameTime,
          playtime: gameState.playtime || 0,
          activeQuests: gameState.activeQuests.map(q => q.toJSON()),
          completedQuests: gameState.completedQuests.map(q => q.toJSON()),
          shopInventories: Object.fromEntries(
            Object.entries(gameState.shopInventories).map(([key, shop]) => [key, shop.toJSON()])
          )
        }
      };

      localStorage.setItem(slotKey, JSON.stringify(saveData));
      
      // Track last used quicksave slot
      if (slotKey === this.SAVE_SLOTS.QUICKSAVE_A || 
          slotKey === this.SAVE_SLOTS.QUICKSAVE_B || 
          slotKey === this.SAVE_SLOTS.QUICKSAVE_C) {
        this.setLastQuicksaveSlot(slotKey);
      }
      
      // Update active slot if this is a manual save (not autosave or quicksave)
      if (slotKey !== this.SAVE_SLOTS.AUTOSAVE &&
          slotKey !== this.SAVE_SLOTS.QUICKSAVE_A &&
          slotKey !== this.SAVE_SLOTS.QUICKSAVE_B &&
          slotKey !== this.SAVE_SLOTS.QUICKSAVE_C) {
        this.setActiveSlot(slotKey);
      }

      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      
      if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.error('Save Failed: Storage Quota Exceeded');
      }
      
      return false;
    }
  }

  /**
   * Load game state from a specific slot
   * @param {string} slotKey - One of SAVE_SLOTS
   * @returns {object|null} Game state or null if load fails
   */
  static loadFromSlot(slotKey) {
    try {
      const saveDataStr = localStorage.getItem(slotKey);
      if (!saveDataStr) {
        return null;
      }

      const saveData = JSON.parse(saveDataStr);
      
      // Version check (for future migrations)
      if (saveData.version !== this.SAVE_VERSION) {
        console.warn(`Save version mismatch: ${saveData.version} vs ${this.SAVE_VERSION}`);
        // For now, we don't support migration (fresh start required)
        return null;
      }

      // Update active slot
      if (slotKey !== this.SAVE_SLOTS.AUTOSAVE) {
        this.setActiveSlot(slotKey);
      }

      return saveData.gameData;
    } catch (error) {
      console.error('Failed to load save:', error);
      return null;
    }
  }

  /**
   * Get metadata for a save slot without loading full game state
   * @param {string} slotKey - One of SAVE_SLOTS
   * @returns {object|null} Metadata or null if slot is empty
   */
  static getSlotMetadata(slotKey) {
    try {
      const saveDataStr = localStorage.getItem(slotKey);
      if (!saveDataStr) {
        return null;
      }

      const saveData = JSON.parse(saveDataStr);
      return {
        ...saveData.metadata,
        timestamp: saveData.timestamp,
        version: saveData.version
      };
    } catch (error) {
      console.error('Failed to read slot metadata:', error);
      return null;
    }
  }

  /**
   * Delete a save slot
   * @param {string} slotKey - One of SAVE_SLOTS
   */
  static deleteSlot(slotKey) {
    try {
      localStorage.removeItem(slotKey);
      
      // Clear active slot if we deleted it
      if (this.getActiveSlot() === slotKey) {
        localStorage.removeItem(this.ACTIVE_SLOT_KEY);
      }
    } catch (error) {
      console.error('Failed to delete save slot:', error);
    }
  }

  /**
   * Get all save slots with metadata
   * @returns {object} Object with slot keys and their metadata
   */
  static getAllSlots() {
    return {
      autosave: this.getSlotMetadata(this.SAVE_SLOTS.AUTOSAVE),
      quicksaveA: this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_A),
      quicksaveB: this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_B),
      quicksaveC: this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_C),
      slot1: this.getSlotMetadata(this.SAVE_SLOTS.SLOT_1),
      slot2: this.getSlotMetadata(this.SAVE_SLOTS.SLOT_2),
      slot3: this.getSlotMetadata(this.SAVE_SLOTS.SLOT_3)
    };
  }

  /**
   * Get currently active save slot
   * @returns {string|null} Active slot key or null
   */
  static getActiveSlot() {
    return localStorage.getItem(this.ACTIVE_SLOT_KEY);
  }

  /**
   * Set active save slot
   * @param {string} slotKey - One of SAVE_SLOTS
   */
  static setActiveSlot(slotKey) {
    localStorage.setItem(this.ACTIVE_SLOT_KEY, slotKey);
  }

  /**
   * Check if any save exists
   * @returns {boolean}
   */
  static hasSaveData() {
    return !!(
      this.getSlotMetadata(this.SAVE_SLOTS.AUTOSAVE) ||
      this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_A) ||
      this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_B) ||
      this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_C) ||
      this.getSlotMetadata(this.SAVE_SLOTS.SLOT_1) ||
      this.getSlotMetadata(this.SAVE_SLOTS.SLOT_2) ||
      this.getSlotMetadata(this.SAVE_SLOTS.SLOT_3)
    );
  }

  /**
   * Get next quicksave slot in rotation (A -> B -> C -> A)
   * @returns {string} Next quicksave slot key
   */
  static getNextQuicksaveSlot() {
    const lastSlot = localStorage.getItem(this.LAST_QUICKSAVE_KEY) || this.SAVE_SLOTS.QUICKSAVE_C;
    
    // Cycle through A → B → C → A
    if (lastSlot === this.SAVE_SLOTS.QUICKSAVE_A) return this.SAVE_SLOTS.QUICKSAVE_B;
    if (lastSlot === this.SAVE_SLOTS.QUICKSAVE_B) return this.SAVE_SLOTS.QUICKSAVE_C;
    return this.SAVE_SLOTS.QUICKSAVE_A;
  }

  /**
   * Set last used quicksave slot for rotation tracking
   * @param {string} slotKey - One of QUICKSAVE_A, QUICKSAVE_B, QUICKSAVE_C
   */
  static setLastQuicksaveSlot(slotKey) {
    localStorage.setItem(this.LAST_QUICKSAVE_KEY, slotKey);
  }

  /**
   * Get human-readable location name from game state
   * @private
   */
  static _getCurrentLocationName(gameState) {
    if (gameState.inInterior && gameState.currentPOI) {
      return gameState.currentPOI.name || gameState.currentPOI.type;
    }

    const currentHex = gameState.mapData?.find(
      h => h.col === gameState.playerPosition.col && h.row === gameState.playerPosition.row
    );

    if (currentHex?.poi) {
      return currentHex.poi.name || currentHex.poi.type;
    }

    if (currentHex) {
      return currentHex.terrain.name;
    }

    return 'Unknown';
  }
}
