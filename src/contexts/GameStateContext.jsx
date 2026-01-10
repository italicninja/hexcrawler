import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { Character } from '../game/Character.js';
import { Party } from '../game/Party.js';
import { createGameTime, advanceTime } from '../game/TimeManager.js';
import SurvivalManager from '../game/SurvivalManager.js';
import Quest from '../game/Quest.js';
import { Shop } from '../game/Shop.js';
import { Combat } from '../game/Combat.js';
import { CombatTerrainGenerator } from '../game/CombatTerrainGenerator.js';
import { EncounterPositions } from '../game/EncounterPositions.js';
import { SaveManager } from '../utils/SaveManager.js';
import { HexGrid } from '../utils/HexGrid';
import { getHexDistance, isHexReachable } from '../utils/hexMath';
import { GAME_DEFAULTS, TIME, COMBAT, SAVE } from '../constants/gameConstants';
import { combinedReducer } from './reducers/index';

// Create context
const GameStateContext = createContext(null);

// Action types
const ACTIONS = {
  SET_PLAYER_POSITION: 'SET_PLAYER_POSITION',
  SET_PLAYER_CHARACTER: 'SET_PLAYER_CHARACTER',
  SET_PARTY: 'SET_PARTY',
  SET_MAP_DATA: 'SET_MAP_DATA',
  SET_MAP_SEED: 'SET_MAP_SEED',
  ADD_EXPLORED_HEX: 'ADD_EXPLORED_HEX',
  REVEAL_AROUND_PLAYER: 'REVEAL_AROUND_PLAYER',
  DISCOVER_POI: 'DISCOVER_POI',
  LOAD_GAME: 'LOAD_GAME',
  SET_CURRENT_SCENE: 'SET_CURRENT_SCENE',
  NEW_GAME: 'NEW_GAME',
  // Event blocking
  SET_ACTIVE_EVENT: 'SET_ACTIVE_EVENT',
  // Exploration actions
  SEARCH_POI: 'SEARCH_POI',
  SET_INTERIOR_MAP: 'SET_INTERIOR_MAP',
  SET_INTERIOR_PLAYER_POSITION: 'SET_INTERIOR_PLAYER_POSITION',
  ENTER_EXPLORATION: 'ENTER_EXPLORATION',
  EXIT_EXPLORATION: 'EXIT_EXPLORATION',
  DEFEAT_ENCOUNTER: 'DEFEAT_ENCOUNTER',
  COLLECT_LOOT: 'COLLECT_LOOT',
  TRIGGER_HAZARD: 'TRIGGER_HAZARD',
  UPDATE_CHARACTER: 'UPDATE_CHARACTER',
  // Time tracking
  ADVANCE_TIME: 'ADVANCE_TIME',
  UPDATE_PLAYTIME: 'UPDATE_PLAYTIME',
  // Rest actions
  SHORT_REST: 'SHORT_REST',
  LONG_REST: 'LONG_REST',
  INN_REST: 'INN_REST',
  // Inventory actions
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  EQUIP_ITEM: 'EQUIP_ITEM',
  UNEQUIP_ITEM: 'UNEQUIP_ITEM',
  // Survival actions
  CONSUME_RATIONS: 'CONSUME_RATIONS',
  CONSUME_WATER: 'CONSUME_WATER',
  FORAGE: 'FORAGE',
  FIND_WATER: 'FIND_WATER',
  APPLY_EXHAUSTION: 'APPLY_EXHAUSTION',
  // Combat actions
  START_COMBAT: 'START_COMBAT',
  RESOLVE_COMBAT: 'RESOLVE_COMBAT',
  PROCESS_COMBAT_ACTION: 'PROCESS_COMBAT_ACTION',
  PROCESS_COMBAT_MOVEMENT: 'PROCESS_COMBAT_MOVEMENT',
  ADVANCE_COMBAT_TURN: 'ADVANCE_COMBAT_TURN',
  END_COMBAT: 'END_COMBAT',
  UPDATE_COMBAT_STATE: 'UPDATE_COMBAT_STATE',
  // XP and leveling actions
  AWARD_XP: 'AWARD_XP',
  LEVEL_UP_CHARACTER: 'LEVEL_UP_CHARACTER',
  // Quest actions
  ACCEPT_QUEST: 'ACCEPT_QUEST',
  UPDATE_QUEST_PROGRESS: 'UPDATE_QUEST_PROGRESS',
  COMPLETE_QUEST: 'COMPLETE_QUEST',
  FAIL_QUEST: 'FAIL_QUEST',
  GENERATE_TOWN_QUESTS: 'GENERATE_TOWN_QUESTS',
  REFRESH_QUESTS: 'REFRESH_QUESTS',
  // Shop actions
  GENERATE_SHOP_INVENTORY: 'GENERATE_SHOP_INVENTORY',
  BUY_ITEM: 'BUY_ITEM',
  SELL_ITEM: 'SELL_ITEM',
  // Town actions
  ENTER_TOWN: 'ENTER_TOWN',
  EXIT_TOWN: 'EXIT_TOWN'
};

// Initial state
const initialState = {
  playerPosition: GAME_DEFAULTS.START_POSITION,
  playerCharacter: null,
  party: null,
  mapData: null,
  mapSeed: '',
  hexGrid: null, // Spatial index for O(1) hex lookups
  exploredHexes: new Set(),
  discoveredPOIs: new Set(),
  currentScene: 'title',
  newGameSeed: null,
  characterCreationSeed: null, // Store seed for character creation
  hasActiveEvent: false, // Blocks movement during active events (combat, etc.)
  // Exploration state
  interiorMaps: {},
  currentPOI: null,
  interiorPlayerPosition: null, // Player position inside POI/town
  inInterior: false, // Whether player is currently inside a POI/town
  explorationState: {
    searchedPOIs: new Set(),
    clearedEncounters: {},
    collectedLoot: {},
    triggeredHazards: {}
  },
  // Time tracking
  gameTime: createGameTime(),
  playtime: 0, // Total playtime in milliseconds
  // Combat state
  combatLog: [],
  combatState: {
    active: false,
    combat: null, // Combat instance
    battlefield: null, // {hexes, width, height}
    turnOrder: [], // Combatants with positions
    currentTurnIndex: 0,
    round: 1,
    encounterName: '',
    encounterType: 'standard',
    waitingForPlayerAction: false,
    movementRemaining: COMBAT.DEFAULT_MOVEMENT_FEET
  },
  // Quest state
  activeQuests: [],
  completedQuests: [],
  townQuests: {}, // Available quests per town, keyed by location (e.g., "10,7")
  // Shop state
  shopInventories: {} // Keyed by POI location (e.g., "10,7" for hex coordinates)
};

// Reducer - Delegates to modular reducers
function gameStateReducer(state, action) {
  return combinedReducer(state, action, ACTIONS);
}

// Legacy monolithic reducer (DEPRECATED - kept for reference, will be removed)
function _legacyGameStateReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_PLAYER_POSITION:
      return {
        ...state,
        playerPosition: action.payload,
        exploredHexes: new Set([
          ...state.exploredHexes,
          `${action.payload.col},${action.payload.row}`
        ])
      };

    case ACTIONS.SET_PLAYER_CHARACTER:
      return { ...state, playerCharacter: action.payload };

    case ACTIONS.SET_PARTY:
      return { ...state, party: action.payload };

    case ACTIONS.SET_MAP_DATA:
      return {
        ...state,
        mapData: action.payload,
        hexGrid: new HexGrid(action.payload) // Create spatial index
      };

    case ACTIONS.SET_MAP_SEED:
      return { ...state, mapSeed: action.payload };

    case ACTIONS.ADD_EXPLORED_HEX:
      return {
        ...state,
        exploredHexes: new Set([...state.exploredHexes, action.payload])
      };

    case ACTIONS.REVEAL_AROUND_PLAYER: {
      const { col, row } = action.payload;
      const radius = 2; // View range
      const newExplored = new Set(state.exploredHexes);

      for (let r = row - radius; r <= row + radius; r++) {
        for (let c = col - radius; c <= col + radius; c++) {
          const distance = getHexDistance(col, row, c, r);
          if (distance <= radius) {
            newExplored.add(`${c},${r}`);
          }
        }
      }

      return { ...state, exploredHexes: newExplored };
    }

    case ACTIONS.DISCOVER_POI:
      return {
        ...state,
        discoveredPOIs: new Set([...state.discoveredPOIs, `${action.payload.col},${action.payload.row}`])
      };

    case ACTIONS.SET_ACTIVE_EVENT:
      return {
        ...state,
        hasActiveEvent: action.payload
      };

    case ACTIONS.SEARCH_POI:
      return {
        ...state,
        explorationState: {
          ...state.explorationState,
          searchedPOIs: new Set([...state.explorationState.searchedPOIs, action.payload])
        }
      };

    case ACTIONS.SET_INTERIOR_MAP:
      return {
        ...state,
        interiorMaps: {
          ...state.interiorMaps,
          [action.payload.key]: action.payload.map
        }
      };

    case ACTIONS.SET_INTERIOR_PLAYER_POSITION:
      return {
        ...state,
        interiorPlayerPosition: action.payload
      };

    case ACTIONS.ENTER_EXPLORATION: {
      const poi = action.payload;

      // Update quest progress for visit objectives
      const updatedActiveQuests = [...state.activeQuests];
      let questsModified = false;

      if (poi && poi.type) {
        updatedActiveQuests.forEach((quest, index) => {
          const questCopy = Quest.fromJSON(quest.toJSON());
          const updated = questCopy.updateObjectivesByTarget('visit', poi.type, 1);
          if (updated) {
            updatedActiveQuests[index] = questCopy;
            questsModified = true;
          }
        });
      }

      // Get interior map to set player position
      const poiKey = `${poi.col},${poi.row}`;
      const interiorMap = state.interiorMaps[poiKey];
      const entrancePos = interiorMap?.entrance || { col: 0, row: 0 };

      return {
        ...state,
        inInterior: true,
        currentPOI: poi,
        interiorPlayerPosition: entrancePos,
        activeQuests: questsModified ? updatedActiveQuests : state.activeQuests
      };
    }

    case ACTIONS.EXIT_EXPLORATION:
      return {
        ...state,
        inInterior: false,
        currentPOI: null,
        interiorPlayerPosition: null
      };

    case ACTIONS.DEFEAT_ENCOUNTER: {
      const { poiKey, encounterKey, enemies } = action.payload;
      const clearedEncounters = { ...state.explorationState.clearedEncounters };
      if (!clearedEncounters[poiKey]) {
        clearedEncounters[poiKey] = new Set();
      } else {
        clearedEncounters[poiKey] = new Set(clearedEncounters[poiKey]);
      }
      clearedEncounters[poiKey].add(encounterKey);

      // Also update the interior map to mark encounter as defeated
      const updatedInteriorMaps = { ...state.interiorMaps };
      if (updatedInteriorMaps[poiKey]) {
        const interiorMap = { ...updatedInteriorMaps[poiKey] };
        interiorMap.encounters = interiorMap.encounters.map(e => {
          if (`${e.col},${e.row}` === encounterKey) {
            return { ...e, defeated: true };
          }
          return e;
        });
        updatedInteriorMaps[poiKey] = interiorMap;
      }

      // Update quest progress for kill objectives
      const updatedActiveQuests = [...state.activeQuests];
      let questsModified = false;

      if (enemies && enemies.length > 0) {
        enemies.forEach(enemy => {
          updatedActiveQuests.forEach((quest, index) => {
            const questCopy = Quest.fromJSON(quest.toJSON());
            const updated = questCopy.updateObjectivesByTarget('kill', enemy.name, 1);
            if (updated) {
              updatedActiveQuests[index] = questCopy;
              questsModified = true;
            }
          });
        });
      }

      return {
        ...state,
        interiorMaps: updatedInteriorMaps,
        explorationState: {
          ...state.explorationState,
          clearedEncounters
        },
        activeQuests: questsModified ? updatedActiveQuests : state.activeQuests
      };
    }

    case ACTIONS.COLLECT_LOOT: {
      const { poiKey, lootKey, loot } = action.payload;

      // Add items and gold to character
      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());

      // Add gold
      if (loot.gold > 0) {
        updatedCharacter.addGold(loot.gold);
      }

      // Add items (Item instances)
      if (loot.items && loot.items.length > 0) {
        loot.items.forEach(item => {
          updatedCharacter.addItem(item);
        });
      }

      // Mark loot as collected
      const collectedLoot = { ...state.explorationState.collectedLoot };
      if (!collectedLoot[poiKey]) {
        collectedLoot[poiKey] = new Set();
      } else {
        collectedLoot[poiKey] = new Set(collectedLoot[poiKey]);
      }
      collectedLoot[poiKey].add(lootKey);

      // Also update the interior map to mark loot as collected
      const updatedInteriorMaps = { ...state.interiorMaps };
      if (updatedInteriorMaps[poiKey]) {
        const interiorMap = { ...updatedInteriorMaps[poiKey] };
        interiorMap.loot = interiorMap.loot.map(l => {
          if (`${l.col},${l.row}` === lootKey) {
            return { ...l, collected: true };
          }
          return l;
        });
        updatedInteriorMaps[poiKey] = interiorMap;
      }

      // Update quest progress for collect objectives
      const updatedActiveQuests = [...state.activeQuests];
      let questsModified = false;

      if (loot.items && loot.items.length > 0) {
        loot.items.forEach(item => {
          updatedActiveQuests.forEach((quest, index) => {
            const questCopy = Quest.fromJSON(quest.toJSON());
            const updated = questCopy.updateObjectivesByTarget('collect', item.name, 1);
            if (updated) {
              updatedActiveQuests[index] = questCopy;
              questsModified = true;
            }
          });
        });
      }

      return {
        ...state,
        playerCharacter: updatedCharacter,
        interiorMaps: updatedInteriorMaps,
        explorationState: {
          ...state.explorationState,
          collectedLoot
        },
        activeQuests: questsModified ? updatedActiveQuests : state.activeQuests
      };
    }

    case ACTIONS.TRIGGER_HAZARD: {
      const { poiKey, hazardKey } = action.payload;
      const triggeredHazards = { ...state.explorationState.triggeredHazards };
      if (!triggeredHazards[poiKey]) {
        triggeredHazards[poiKey] = new Set();
      } else {
        triggeredHazards[poiKey] = new Set(triggeredHazards[poiKey]);
      }
      triggeredHazards[poiKey].add(hazardKey);

      // Also update the interior map to mark hazard as triggered
      const updatedInteriorMaps = { ...state.interiorMaps };
      if (updatedInteriorMaps[poiKey]) {
        const interiorMap = { ...updatedInteriorMaps[poiKey] };
        interiorMap.hazards = interiorMap.hazards.map(h => {
          if (`${h.col},${h.row}` === hazardKey) {
            return { ...h, triggered: true };
          }
          return h;
        });
        updatedInteriorMaps[poiKey] = interiorMap;
      }

      return {
        ...state,
        interiorMaps: updatedInteriorMaps,
        explorationState: {
          ...state.explorationState,
          triggeredHazards
        }
      };
    }

    case ACTIONS.UPDATE_CHARACTER:
      return {
        ...state,
        playerCharacter: action.payload
      };

    case ACTIONS.ADVANCE_TIME:
      return {
        ...state,
        gameTime: advanceTime(state.gameTime, action.payload)
      };

    case ACTIONS.UPDATE_PLAYTIME:
      return {
        ...state,
        playtime: state.playtime + action.payload
      };

    case ACTIONS.SHORT_REST: {
      // Short rest handled by RestManager, just update character and time
      const { character } = action.payload;
      return {
        ...state,
        playerCharacter: character,
        gameTime: advanceTime(state.gameTime, TIME.SHORT_REST_MINUTES)
      };
    }

    case ACTIONS.LONG_REST: {
      // Long rest handled by RestManager, just update character and time
      const { character } = action.payload;

      // Consume rations during long rest (water removed from survival system)
      const rationResult = SurvivalManager.consumeRations(character);

      // Apply exhaustion if no food available
      if (!rationResult.success) {
        SurvivalManager.applyStarvation(character);
      }

      // Reduce exhaustion if food was consumed
      if (rationResult.success) {
        SurvivalManager.reduceExhaustion(character);
      }

      return {
        ...state,
        playerCharacter: character,
        gameTime: advanceTime(state.gameTime, TIME.LONG_REST_MINUTES)
      };
    }

    case ACTIONS.INN_REST: {
      // Inn rest: guaranteed safe long rest with no interruption
      // Does NOT consume rations or water (included in inn price)
      // Handled by RestManager.innRest(), just update character and time
      const { character } = action.payload;

      // NOTE: Food and water are NOT consumed during inn rest (included in price)
      // No interruption check needed (guaranteed safe)
      // Gold already deducted by RestManager.innRest()

      return {
        ...state,
        playerCharacter: updatedCharacter,
        gameTime: advanceTime(state.gameTime, TIME.INN_REST_MINUTES)
      };
    }

    case ACTIONS.LOAD_GAME: {
      // Deserialize exploration state from arrays back to Sets
      const deserializeExplorationState = (savedState) => {
        if (!savedState) {
          return {
            searchedPOIs: new Set(),
            clearedEncounters: {},
            collectedLoot: {},
            triggeredHazards: {}
          };
        }

        const clearedEncounters = {};
        const collectedLoot = {};
        const triggeredHazards = {};

        // Convert arrays back to Sets
        Object.keys(savedState.clearedEncounters || {}).forEach(key => {
          clearedEncounters[key] = new Set(savedState.clearedEncounters[key]);
        });
        Object.keys(savedState.collectedLoot || {}).forEach(key => {
          collectedLoot[key] = new Set(savedState.collectedLoot[key]);
        });
        Object.keys(savedState.triggeredHazards || {}).forEach(key => {
          triggeredHazards[key] = new Set(savedState.triggeredHazards[key]);
        });

        return {
          searchedPOIs: new Set(savedState.searchedPOIs || []),
          clearedEncounters,
          collectedLoot,
          triggeredHazards
        };
      };

      // Deserialize quests from JSON
      const activeQuests = (action.payload.activeQuests || []).map(q => Quest.fromJSON(q));
      const completedQuests = (action.payload.completedQuests || []).map(q => Quest.fromJSON(q));

      // Deserialize shop inventories from JSON
      const shopInventories = {};
      if (action.payload.shopInventories) {
        Object.entries(action.payload.shopInventories).forEach(([key, shopData]) => {
          shopInventories[key] = Shop.fromJSON(shopData);
        });
      }

      return {
        ...state,
        ...action.payload,
        exploredHexes: new Set(action.payload.exploredHexes || []),
        discoveredPOIs: new Set(action.payload.discoveredPOIs || []),
        interiorMaps: action.payload.interiorMaps || {},
        explorationState: deserializeExplorationState(action.payload.explorationState),
        currentPOI: null, // Always reset to null (never load mid-exploration/town)
        inInterior: false, // Always reset to false
        interiorPlayerPosition: null, // Always reset to null
        gameTime: action.payload.gameTime || createGameTime(), // Load saved time or create new
        activeQuests,
        completedQuests,
        shopInventories
      };
    }

    case ACTIONS.SET_CURRENT_SCENE:
      return { ...state, currentScene: action.payload };

    case ACTIONS.NEW_GAME: {
      const mapSeed = action.payload;

      // Transition to character creation scene instead of creating default character
      return {
        ...initialState,
        mapSeed,
        characterCreationSeed: mapSeed,
        currentScene: 'characterCreation',
        gameTime: createGameTime() // Initialize game time for new game
      };
    }

    case ACTIONS.ADD_ITEM: {
      const { item } = action.payload;
      if (!state.playerCharacter) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      updatedCharacter.addItem(item);

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.REMOVE_ITEM: {
      const { itemId } = action.payload;
      if (!state.playerCharacter) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      updatedCharacter.removeItem(itemId);

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.EQUIP_ITEM: {
      const { itemId, slot } = action.payload;
      if (!state.playerCharacter) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const success = updatedCharacter.equipItem(itemId, slot);

      if (!success) {
        console.warn('Failed to equip item');
        return state;
      }

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.UNEQUIP_ITEM: {
      const { slot } = action.payload;
      if (!state.playerCharacter) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const success = updatedCharacter.unequipItem(slot);

      if (!success) {
        console.warn('Failed to unequip item');
        return state;
      }

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.CONSUME_RATIONS: {
      if (!state.playerCharacter) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const result = SurvivalManager.consumeRations(updatedCharacter);

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.CONSUME_WATER: {
      if (!state.playerCharacter) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const result = SurvivalManager.consumeWater(updatedCharacter);

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.FORAGE: {
      const { terrainKey, diceRoller } = action.payload;
      if (!state.playerCharacter || !diceRoller) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const result = SurvivalManager.forage(updatedCharacter, terrainKey, diceRoller);

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.FIND_WATER: {
      const { terrainKey, diceRoller } = action.payload;
      if (!state.playerCharacter || !diceRoller) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const result = SurvivalManager.findWater(updatedCharacter, terrainKey, diceRoller);

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.APPLY_EXHAUSTION: {
      const { terrain } = action.payload;
      if (!state.playerCharacter) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());

      // Apply starvation and dehydration
      const starvationResult = SurvivalManager.applyStarvation(updatedCharacter);
      const dehydrationResult = SurvivalManager.applyDehydration(updatedCharacter, terrain);

      return {
        ...state,
        playerCharacter: updatedCharacter
      };
    }


    case ACTIONS.START_COMBAT: {
      // Legacy combat log support (keep for backward compatibility)
      if (action.payload.combatLog) {
        return {
          ...state,
          combatLog: action.payload.combatLog
        };
      }
      
      // New tactical combat system
      const { allies, enemies, encounterName, encounterType, terrainType } = action.payload;
      
      if (!allies || !enemies) {
        console.error('START_COMBAT requires allies and enemies');
        return state;
      }
      
      // Generate battlefield
      const battlefield = CombatTerrainGenerator.generate(encounterType, terrainType, state.mapSeed);
      
      // Create combat instance
      const combat = new Combat(allies, enemies, battlefield);
      
      // Roll initiative
      const turnOrder = combat.rollInitiative();
      
      // Place combatants on battlefield
      const { allies: placedAllies, enemies: placedEnemies } = EncounterPositions.placeForEncounter(
        encounterType,
        turnOrder.filter(c => !c.isEnemy),
        turnOrder.filter(c => c.isEnemy),
        battlefield
      );
      
      // Merge positions back into turnOrder
      const updatedTurnOrder = turnOrder.map(combatant => {
        const placed = combatant.isEnemy 
          ? placedEnemies.find(e => e.id === combatant.id)
          : placedAllies.find(a => a.id === combatant.id);
        return { ...combatant, position: placed.position };
      });
      
      // Update combat instance with positioned combatants
      combat.turnOrder = updatedTurnOrder;
      combat.allies = updatedTurnOrder.filter(c => !c.isEnemy);
      combat.enemies = updatedTurnOrder.filter(c => c.isEnemy);
      
      // Get first combatant's movement distance (default to 30 feet if not available)
      const firstCombatant = updatedTurnOrder[0];
      const moveDistance = firstCombatant?.character?.moveDistance || GAME_DEFAULTS.MOVE_DISTANCE;
      
      return {
        ...state,
        combatState: {
          active: true,
          combat,
          battlefield,
          turnOrder: updatedTurnOrder,
          currentTurnIndex: 0,
          round: 1,
          encounterName: encounterName || 'Combat',
          encounterType: encounterType || 'standard',
          waitingForPlayerAction: !firstCombatant?.isEnemy,
          movementRemaining: moveDistance * 5 // Convert hexes to feet
        },
        currentScene: 'combat'
      };
    }

    case ACTIONS.RESOLVE_COMBAT: {
      const { playerCharacter, party, combatLog, xpPerCharacter } = action.payload;

      // Award XP if provided and combat was victorious
      if (xpPerCharacter && xpPerCharacter > 0) {
        // Award XP to player character
        if (playerCharacter && playerCharacter.currentHP > 0) {
          playerCharacter.awardXP(xpPerCharacter);
        }

        // Award XP to living party members
        if (party && party.npcs) {
          party.npcs.forEach(npc => {
            if (npc && npc.currentHP > 0) {
              npc.awardXP(xpPerCharacter);
            }
          });
        }
      }

      return {
        ...state,
        playerCharacter,
        party,
        combatLog
      };
    }

    case ACTIONS.PROCESS_COMBAT_MOVEMENT: {
      const { combatantId, path, cost } = action.payload;
      
      if (!state.combatState.combat) {
        console.error('No active combat for movement');
        return state;
      }
      
      const result = state.combatState.combat.processMovement(combatantId, path, cost);
      
      if (result.success) {
        return {
          ...state,
          combatState: {
            ...state.combatState,
            movementRemaining: state.combatState.movementRemaining - cost,
            turnOrder: [...state.combatState.combat.turnOrder] // Trigger re-render
          }
        };
      }
      
      return state;
    }

    case ACTIONS.PROCESS_COMBAT_ACTION: {
      const { actionType, attacker, target, ability, spell, spellLevel } = action.payload;
      
      if (!state.combatState.combat) {
        console.error('No active combat for action');
        return state;
      }
      
      let result;
      const combat = state.combatState.combat;
      
      if (actionType === 'attack') {
        result = combat.processAttack(attacker, target);
      } else if (actionType === 'ability') {
        result = combat.processAbility(attacker, ability, target);
      } else if (actionType === 'spell') {
        result = combat.processSpell(attacker, spell, target, spellLevel);
      } else if (actionType === 'dodge') {
        result = combat.processDodge(attacker);
      } else if (actionType === 'dash') {
        result = combat.processDash(attacker);
      }
      
      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnOrder: [...combat.turnOrder] // Trigger re-render with updated HP
        }
      };
    }

    case ACTIONS.ADVANCE_COMBAT_TURN: {
      if (!state.combatState.combat) {
        console.error('No active combat for turn advancement');
        return state;
      }
      
      const combat = state.combatState.combat;
      let nextIndex = state.combatState.currentTurnIndex + 1;
      let newRound = state.combatState.round;
      
      if (nextIndex >= state.combatState.turnOrder.length) {
        nextIndex = 0;
        newRound++;
      }
      
      // Tick status effects for combatant ending turn
      const currentCombatant = state.combatState.turnOrder[state.combatState.currentTurnIndex];
      combat.tickStatusEffects(currentCombatant);
      
      const nextCombatant = state.combatState.turnOrder[nextIndex];
      const nextMovement = (nextCombatant?.character?.moveDistance || GAME_DEFAULTS.MOVE_DISTANCE) * 5;
      
      return {
        ...state,
        combatState: {
          ...state.combatState,
          currentTurnIndex: nextIndex,
          round: newRound,
          waitingForPlayerAction: !nextCombatant.isEnemy,
          movementRemaining: nextMovement
        }
      };
    }

    case ACTIONS.END_COMBAT: {
      const { victory, xp } = action.payload;
      
      if (!state.combatState.combat || !state.party) {
        console.error('No active combat or party to end combat');
        return state;
      }
      
      // Award XP if victory
      if (victory && xp) {
        const livingAllies = state.party.getAllMembers().filter(char => char.hp > 0);
        const xpPerMember = Math.floor(xp / livingAllies.length);
        
        livingAllies.forEach(char => {
          char.gainXP(xpPerMember);
        });
      }
      
      // Update party HP from combat
      state.combatState.turnOrder.filter(c => !c.isEnemy).forEach(combatant => {
        const partyMember = state.party.getAllMembers().find(m => m.name === combatant.character.name);
        if (partyMember) {
          partyMember.hp = combatant.hp;
        }
      });
      
      return {
        ...state,
        combatState: {
          ...initialState.combatState
        },
        currentScene: state.inInterior ? 'exploration' : 'overworld'
      };
    }

    case ACTIONS.UPDATE_COMBAT_STATE: {
      const updates = action.payload;
      
      return {
        ...state,
        combatState: {
          ...state.combatState,
          ...updates
        }
      };
    }

    case ACTIONS.AWARD_XP: {
      const { characterId, amount } = action.payload;
      const updatedPlayerCharacter = state.playerCharacter ? Character.fromJSON(state.playerCharacter.toJSON()) : null;
      const updatedParty = state.party ? Party.fromJSON(state.party.toJSON()) : null;

      if (characterId === 'player' && updatedPlayerCharacter) {
        updatedPlayerCharacter.awardXP(amount);
      } else if (updatedParty) {
        const npcIndex = parseInt(characterId);
        if (!isNaN(npcIndex) && updatedParty.npcs[npcIndex]) {
          updatedParty.npcs[npcIndex] = Character.fromJSON(updatedParty.npcs[npcIndex].toJSON());
          updatedParty.npcs[npcIndex].awardXP(amount);
        }
      }

      return {
        ...state,
        playerCharacter: updatedPlayerCharacter,
        party: updatedParty
      };
    }

    case ACTIONS.LEVEL_UP_CHARACTER: {
      const { characterId } = action.payload;
      const updatedPlayerCharacter = state.playerCharacter ? Character.fromJSON(state.playerCharacter.toJSON()) : null;
      const updatedParty = state.party ? Party.fromJSON(state.party.toJSON()) : null;

      let levelUpResult = null;

      if (characterId === 'player' && updatedPlayerCharacter) {
        levelUpResult = updatedPlayerCharacter.levelUp();
        // Level up notification logged to game log
      } else if (updatedParty) {
        const npcIndex = parseInt(characterId);
        if (!isNaN(npcIndex) && updatedParty.npcs[npcIndex]) {
          updatedParty.npcs[npcIndex] = Character.fromJSON(updatedParty.npcs[npcIndex].toJSON());
          levelUpResult = updatedParty.npcs[npcIndex].levelUp();
          // Level up notification logged to game log
        }
      }

      return {
        ...state,
        playerCharacter: updatedPlayerCharacter,
        party: updatedParty
      };
    }

    case ACTIONS.ACCEPT_QUEST: {
      const { quest } = action.payload;
      const questInstance = quest instanceof Quest ? quest : Quest.fromJSON(quest);
      questInstance.status = 'active';

      return {
        ...state,
        activeQuests: [...state.activeQuests, questInstance]
      };
    }

    case ACTIONS.UPDATE_QUEST_PROGRESS: {
      const { questId, type, target, amount } = action.payload;

      const updatedActiveQuests = state.activeQuests.map(quest => {
        if (quest.id === questId) {
          const updatedQuest = Quest.fromJSON(quest.toJSON());
          updatedQuest.updateObjectivesByTarget(type, target, amount);
          return updatedQuest;
        }
        return quest;
      });

      return {
        ...state,
        activeQuests: updatedActiveQuests
      };
    }

    case ACTIONS.COMPLETE_QUEST: {
      const { questId } = action.payload;

      // Find the quest
      const questIndex = state.activeQuests.findIndex(q => q.id === questId);
      if (questIndex === -1) return state;

      const quest = state.activeQuests[questIndex];
      const completedQuest = Quest.fromJSON(quest.toJSON());
      completedQuest.status = 'completed';

      // Remove from active quests
      const updatedActiveQuests = [...state.activeQuests];
      updatedActiveQuests.splice(questIndex, 1);

      // Award rewards
      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());

      // Award XP
      if (quest.rewards.xp > 0) {
        updatedCharacter.awardXP(quest.rewards.xp);
        // Quest complete logged to game log
      }

      // Award gold
      if (quest.rewards.gold > 0) {
        updatedCharacter.addGold(quest.rewards.gold);
      }

      // Award items
      if (quest.rewards.items && quest.rewards.items.length > 0) {
        quest.rewards.items.forEach(item => {
          updatedCharacter.addItem(item);
        });
      }

      return {
        ...state,
        activeQuests: updatedActiveQuests,
        completedQuests: [...state.completedQuests, completedQuest],
        playerCharacter: updatedCharacter
      };
    }

    case ACTIONS.FAIL_QUEST: {
      const { questId } = action.payload;

      // Find the quest
      const questIndex = state.activeQuests.findIndex(q => q.id === questId);
      if (questIndex === -1) return state;

      const quest = state.activeQuests[questIndex];
      const failedQuest = Quest.fromJSON(quest.toJSON());
      failedQuest.status = 'failed';

      // Remove from active quests
      const updatedActiveQuests = [...state.activeQuests];
      updatedActiveQuests.splice(questIndex, 1);

      // Quest failed logged to game log

      return {
        ...state,
        activeQuests: updatedActiveQuests,
        completedQuests: [...state.completedQuests, failedQuest]
      };
    }

    case ACTIONS.GENERATE_TOWN_QUESTS: {
      const { location, quests } = action.payload;
      const locationKey = `${location.col},${location.row}`;

      // Store quests for this town location
      return {
        ...state,
        townQuests: {
          ...state.townQuests,
          [locationKey]: {
            quests,
            lastGenerated: state.gameTime.day
          }
        }
      };
    }

    case ACTIONS.REFRESH_QUESTS: {
      const { location, quests } = action.payload;
      const locationKey = `${location.col},${location.row}`;

      // Refresh quests for this town (called after X days)
      return {
        ...state,
        townQuests: {
          ...state.townQuests,
          [locationKey]: {
            quests,
            lastGenerated: state.gameTime.day
          }
        }
      };
    }

    case ACTIONS.GENERATE_SHOP_INVENTORY: {
      const { poiKey, shopType, level } = action.payload;

      // Don't regenerate if shop already exists
      if (state.shopInventories[poiKey]) {
        return state;
      }

      // Generate shop name based on type
      const shopNames = {
        weapon: 'Blacksmith',
        armor: 'Armory',
        general: 'General Store',
        magic: 'Magic Shop'
      };

      const shop = new Shop({
        name: shopNames[shopType] || 'General Store',
        type: shopType,
        level: level || state.playerCharacter?.level || 1
      });

      return {
        ...state,
        shopInventories: {
          ...state.shopInventories,
          [poiKey]: shop
        }
      };
    }

    case ACTIONS.BUY_ITEM: {
      const { poiKey, itemId } = action.payload;
      if (!state.playerCharacter || !state.shopInventories[poiKey]) return state;

      const shop = Shop.fromJSON(state.shopInventories[poiKey].toJSON());
      const item = shop.inventory.find(i => i.id === itemId);

      if (!item) {
        // Item not found - logged to game log
        return state;
      }

      const price = shop.getBuyPrice(item);

      // Check if player has enough gold
      if (state.playerCharacter.gold < price) {
        // Not enough gold - logged to game log
        return state;
      }

      // Remove item from shop
      const purchasedItem = shop.buyItem(itemId);
      if (!purchasedItem) return state;

      // Update player character
      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      updatedCharacter.removeGold(price);
      updatedCharacter.addItem(purchasedItem);

      // Purchase logged to game log

      return {
        ...state,
        playerCharacter: updatedCharacter,
        shopInventories: {
          ...state.shopInventories,
          [poiKey]: shop
        }
      };
    }

    case ACTIONS.SELL_ITEM: {
      const { poiKey, itemId } = action.payload;
      if (!state.playerCharacter || !state.shopInventories[poiKey]) return state;

      const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const item = updatedCharacter.inventory.find(i => i.id === itemId);

      if (!item) {
        // Item not found - logged to game log
        return state;
      }

      // Check if item is equipped
      const isEquipped = Object.values(updatedCharacter.equipment).some(
        equipped => equipped && equipped.id === itemId
      );

      if (isEquipped) {
        // Cannot sell equipped items - logged to game log
        return state;
      }

      const shop = Shop.fromJSON(state.shopInventories[poiKey].toJSON());
      const price = shop.getSellPrice(item);

      // Remove item from player and add gold
      updatedCharacter.removeItem(itemId);
      updatedCharacter.addGold(price);

      // Add item to shop
      shop.sellItem(item);

      // Sale logged to game log

      return {
        ...state,
        playerCharacter: updatedCharacter,
        shopInventories: {
          ...state.shopInventories,
          [poiKey]: shop
        }
      };
    }

    case ACTIONS.ENTER_TOWN: {
      const { col, row, poi } = action.payload;
      const poiKey = `${col},${row}`;

      // Interior should already be generated by useHexInteraction before this action
      const townInterior = state.interiorMaps[poiKey];
      
      if (!townInterior) {
        console.error('ENTER_TOWN called but interior not found! This should not happen.');
        return state;
      }

      const entrancePos = townInterior.entrance || { col: 0, row: 0 };

      return {
        ...state,
        inInterior: true,
        currentPOI: { col, row, poi },
        interiorPlayerPosition: entrancePos
      };
    }

    case ACTIONS.EXIT_TOWN:
      return {
        ...state,
        inInterior: false,
        currentPOI: null,
        interiorPlayerPosition: null
      };

    default:
      return state;
  }
}

// Helper function - hex distance calculation
// Re-export hex math functions for backward compatibility
export { getHexDistance, isHexReachable } from '../utils/hexMath';

// Helper function - simple string hash
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Provider component
export function GameStateProvider({ children }) {
  const [state, dispatch] = useReducer(gameStateReducer, initialState);
  const playtimeStartRef = useRef(Date.now());
  const playtimeIntervalRef = useRef(null);

  // Playtime tracking - update every second
  useEffect(() => {
    if (state.currentScene !== 'title' && state.playerCharacter) {
      playtimeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - playtimeStartRef.current;
        playtimeStartRef.current = Date.now();
        
        dispatch({
          type: ACTIONS.UPDATE_PLAYTIME,
          payload: elapsed
        });
      }, 1000);

      return () => {
        if (playtimeIntervalRef.current) {
          clearInterval(playtimeIntervalRef.current);
        }
      };
    }
  }, [state.currentScene, state.playerCharacter]);

  // Event-based auto-save - triggers on specific state changes
  useEffect(() => {
    if (!state.playerCharacter || state.currentScene === 'title') {
      return; // Don't save on title screen or without character
    }

    // Auto-save to AUTOSAVE slot
    const shouldAutoSave = 
      state.currentScene === 'overworld' || 
      state.currentScene === 'exploration' ||
      state.currentScene === 'town';

    if (shouldAutoSave) {
      // Debounce auto-save (wait 500ms after last state change)
      const timeoutId = setTimeout(() => {
        SaveManager.saveToSlot(SaveManager.SAVE_SLOTS.AUTOSAVE, state);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [
    state.currentScene,
    state.playerCharacter,
    state.gameTime, // Saves on time advancement (rest, travel)
    state.completedQuests.length, // Saves when quest completed
    state.combatState.active // Saves when combat state changes (end of combat)
  ]);

  // Helper functions
  const helpers = {
    isHexExplored: (col, row) => state.exploredHexes.has(`${col},${row}`),

    isHexVisible: (col, row) => {
      if (!state.playerCharacter) return false;
      const distance = getHexDistance(
        state.playerPosition.col,
        state.playerPosition.row,
        col,
        row
      );
      return distance <= state.playerCharacter.viewDistance;
    },

    isHexReachable: (col, row) => {
      if (!state.playerCharacter) return false;
      const distance = getHexDistance(state.playerPosition.col, state.playerPosition.row, col, row);
      return distance <= state.playerCharacter.moveDistance;
    },

    isPoiDiscovered: (col, row) => state.discoveredPOIs.has(`${col},${row}`),

    shouldShowPOI: (poi, col, row) => {
      if (!poi) return false;
      // Towns are always visible
      if (poi.visibleWithoutDiscovery) return true;
      // Other POIs only visible if discovered
      return state.discoveredPOIs.has(`${col},${row}`);
    },

    isPoiSearched: (col, row) => state.explorationState.searchedPOIs.has(`${col},${row}`),

    getHexDistance,

    hasSave: () => SaveManager.hasSaveData(),

    loadGame: () => {
      // Note: This is kept for backward compatibility but SaveSlotManager handles loading now
      try {
        // Try to load from auto-save slot first
        const gameData = SaveManager.loadFromSlot(SaveManager.SAVE_SLOTS.AUTOSAVE);
        
        if (!gameData) {
          // Try slot 1 as fallback
          const slot1Data = SaveManager.loadFromSlot(SaveManager.SAVE_SLOTS.SLOT_1);
          if (!slot1Data) return false;
          
          dispatch({ type: ACTIONS.LOAD_GAME, payload: slot1Data });
          return true;
        }

        dispatch({ type: ACTIONS.LOAD_GAME, payload: gameData });
        return true;
      } catch (error) {
        console.error('Failed to load game:', error);
        return false;
      }
    },

    deleteSave: () => {
      // Delete old save format if it exists
      localStorage.removeItem('hexcrawl_save');
    }
  };

  const value = {
    state,
    dispatch,
    actions: ACTIONS,
    ...helpers
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

// Custom hook to use game state
export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return context;
}

// Export ACTIONS for use in components
export { ACTIONS };
