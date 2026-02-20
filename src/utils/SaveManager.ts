// @ts-nocheck
// TODO: Add proper types
import { SAVE } from '../constants/gameConstants';
import logger from './logger';
import { WeatherSystem } from '../WeatherSystem';

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
    AUTOSAVE: 'hexcrawl_autosave',
  };

  static ACTIVE_SLOT_KEY = 'hexcrawl_active_slot';
  static LAST_QUICKSAVE_KEY = 'hexcrawl_last_quicksave_slot';
  static SAVE_VERSION = SAVE.VERSION;

  static saveToSlot(slotKey, gameState) {
    try {
      if (!gameState.playerCharacter) {
        logger.storage.warn('Cannot save: no player character', { slotKey });
        return false;
      }

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
          triggeredHazards,
        };
      };

      const metadata = {
        characterName: gameState.playerCharacter.name,
        level: gameState.playerCharacter.level,
        class: gameState.playerCharacter.class,
        location: this._getCurrentLocationName(gameState),
        day: gameState.gameTime.day,
        playtime: gameState.playtime || 0,
      };

      const serializeRegions = () => {
        if (!gameState.regions || gameState.regions.length === 0) return null;

        return gameState.regions.map(region => ({
          ...region,
          boundaries: Array.from(region.boundaries),
        }));
      };

      const serializeHexToRegion = () => {
        if (!gameState.hexToRegion) return null;
        return Object.fromEntries(gameState.hexToRegion);
      };

      const serializeWeatherSystem = () => {
        if (!gameState.weatherSystem) return null;
        return gameState.weatherSystem.toJSON();
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
          regions: serializeRegions(),
          hexToRegion: serializeHexToRegion(),
          weatherSystem: serializeWeatherSystem(),
          interiorMaps: gameState.interiorMaps,
          explorationState: serializeExplorationState(),
          gameTime: gameState.gameTime,
          playtime: gameState.playtime || 0,
          activeQuests: gameState.activeQuests.map(q => q.toJSON()),
          completedQuests: gameState.completedQuests.map(q => q.toJSON()),
          shopInventories: Object.fromEntries(
            Object.entries(gameState.shopInventories).map(([key, shop]) => [key, shop.toJSON()])
          ),
        },
      };

      localStorage.setItem(slotKey, JSON.stringify(saveData));

      if (
        slotKey === this.SAVE_SLOTS.QUICKSAVE_A ||
        slotKey === this.SAVE_SLOTS.QUICKSAVE_B ||
        slotKey === this.SAVE_SLOTS.QUICKSAVE_C
      ) {
        this.setLastQuicksaveSlot(slotKey);
      }

      if (
        slotKey !== this.SAVE_SLOTS.AUTOSAVE &&
        slotKey !== this.SAVE_SLOTS.QUICKSAVE_A &&
        slotKey !== this.SAVE_SLOTS.QUICKSAVE_B &&
        slotKey !== this.SAVE_SLOTS.QUICKSAVE_C
      ) {
        this.setActiveSlot(slotKey);
      }

      return true;
    } catch (error) {
      logger.storage.error('Failed to save game', { error, slotKey });

      if (error.name === 'QuotaExceededError') {
        logger.storage.error('Save Failed: Storage Quota Exceeded', { slotKey });
      }

      return false;
    }
  }

  static loadFromSlot(slotKey) {
    try {
      const saveDataStr = localStorage.getItem(slotKey);
      if (!saveDataStr) {
        return null;
      }

      const saveData = JSON.parse(saveDataStr);

      if (saveData.version !== this.SAVE_VERSION) {
        logger.storage.warn('Save version mismatch', {
          savedVersion: saveData.version,
          currentVersion: this.SAVE_VERSION,
          slotKey,
        });
        return null;
      }

      if (slotKey !== this.SAVE_SLOTS.AUTOSAVE) {
        this.setActiveSlot(slotKey);
      }

      return saveData.gameData;
    } catch (error) {
      logger.storage.error('Failed to load save', { error, slotKey });
      return null;
    }
  }

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
        version: saveData.version,
      };
    } catch (error) {
      logger.storage.error('Failed to read slot metadata', { error, slotKey });
      return null;
    }
  }

  static deleteSlot(slotKey) {
    try {
      localStorage.removeItem(slotKey);

      if (this.getActiveSlot() === slotKey) {
        localStorage.removeItem(this.ACTIVE_SLOT_KEY);
      }
    } catch (error) {
      logger.storage.error('Failed to delete save slot', { error, slotKey });
    }
  }

  static getAllSlots() {
    return {
      autosave: this.getSlotMetadata(this.SAVE_SLOTS.AUTOSAVE),
      quicksaveA: this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_A),
      quicksaveB: this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_B),
      quicksaveC: this.getSlotMetadata(this.SAVE_SLOTS.QUICKSAVE_C),
      slot1: this.getSlotMetadata(this.SAVE_SLOTS.SLOT_1),
      slot2: this.getSlotMetadata(this.SAVE_SLOTS.SLOT_2),
      slot3: this.getSlotMetadata(this.SAVE_SLOTS.SLOT_3),
    };
  }

  static getActiveSlot() {
    return localStorage.getItem(this.ACTIVE_SLOT_KEY);
  }

  static setActiveSlot(slotKey) {
    localStorage.setItem(this.ACTIVE_SLOT_KEY, slotKey);
  }

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

  static getNextQuicksaveSlot() {
    const lastSlot = localStorage.getItem(this.LAST_QUICKSAVE_KEY) || this.SAVE_SLOTS.QUICKSAVE_C;

    if (lastSlot === this.SAVE_SLOTS.QUICKSAVE_A) return this.SAVE_SLOTS.QUICKSAVE_B;
    if (lastSlot === this.SAVE_SLOTS.QUICKSAVE_B) return this.SAVE_SLOTS.QUICKSAVE_C;
    return this.SAVE_SLOTS.QUICKSAVE_A;
  }

  static setLastQuicksaveSlot(slotKey) {
    localStorage.setItem(this.LAST_QUICKSAVE_KEY, slotKey);
  }

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
