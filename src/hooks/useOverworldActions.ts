/**
 * useOverworldActions — overworld movement, foraging, and combat engagement
 * extracted from OverworldScene (TODO #3): hex movement with terrain checks,
 * ration consumption, POI discovery, the forage action + cooldown status,
 * and starting a combat encounter from a POI.
 */
import logger from '../utils/logger';
import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import { TIME_COSTS, getTimeOfDay } from '../game/TimeManager';
import { DiceRoller } from '../game/DiceRoller';
import {
  generateHexEntryFlavor,
  generateTimeTransitionFlavor,
  generateWeatherFlavor,
  generatePOIFlavor,
  generateCombatIntro,
} from '../utils/flavorTextGenerator';
import { Enemy } from '../game/Enemy';
import SurvivalManager from '../game/SurvivalManager';
import { AIEngine } from '../game/ai/AIEngine';
import { FEATURES } from '../constants/gameConstants';
import type { Hex, LogMessageType } from '../types/game';
import type { SceneHex, ScenePoi } from '../types/scene';

export function useOverworldActions() {
  const { state, dispatch, actions, isHexReachable, isPoiDiscovered } = useGameState();
  const { addMessage } = useGameLog();

  const isBlockingMovement = !!state.combatState?.active;

  /**
   * Build consolidated hex entry message from multiple events
   * @param {Object} hex - The hex being entered
   * @param {string} oldTimeOfDay - Previous time of day
   * @param {string} newTimeOfDay - Current time of day
   * @returns {Object|null} { message: string, type: string } or null if no events
   */
  const buildHexEntryMessage = (
    hex: SceneHex,
    oldTimeOfDay: string,
    newTimeOfDay: string
  ): { message: string; type: LogMessageType } | null => {
    const parts: string[] = [];
    let messageType: LogMessageType = 'info';

    // Time transition (highest priority)
    if (oldTimeOfDay !== newTimeOfDay) {
      const timeFlavor = generateTimeTransitionFlavor(newTimeOfDay);
      if (timeFlavor) parts.push(timeFlavor);
    }

    // Weather warning (changes message type to 'warning')
    if (hex.weather) {
      const weatherFlavor = generateWeatherFlavor(hex.weather.condition ?? '');
      if (weatherFlavor) {
        parts.push(weatherFlavor);
        messageType = 'warning'; // Weather is important, use warning type
      }
    }

    // Hex entry flavor (15% chance)
    if (Math.random() < 0.15) {
      const flavor = generateHexEntryFlavor(hex.terrain?.key ?? '');
      if (flavor) parts.push(flavor);
    }

    if (parts.length === 0) return null;

    return {
      message: parts.join(' - '), // Hyphen separator
      type: messageType,
    };
  };

  // Get adjacent hexes (6 neighbors in hex grid) - Uses HexGrid spatial index for O(1) lookup
  const getAdjacentHexes = (col: number, row: number): Hex[] => {
    // Use HexGrid spatial index if available (much faster than linear search)
    if (state.hexGrid) {
      return state.hexGrid.getNeighbors(col, row);
    }

    // Fallback to manual lookup (only used if hexGrid not initialized)
    const isEvenRow = row % 2 === 0;
    const offsets = isEvenRow
      ? [
          { dc: -1, dr: 0 }, // left
          { dc: 1, dr: 0 }, // right
          { dc: -1, dr: -1 }, // top-left
          { dc: 0, dr: -1 }, // top-right
          { dc: -1, dr: 1 }, // bottom-left
          { dc: 0, dr: 1 }, // bottom-right
        ]
      : [
          { dc: -1, dr: 0 }, // left
          { dc: 1, dr: 0 }, // right
          { dc: 0, dr: -1 }, // top-left
          { dc: 1, dr: -1 }, // top-right
          { dc: 0, dr: 1 }, // bottom-left
          { dc: 1, dr: 1 }, // bottom-right
        ];

    const adjacent: Hex[] = [];
    offsets.forEach(({ dc, dr }) => {
      const hex = state.mapData?.find(h => h.col === col + dc && h.row === row + dr);
      if (hex) {
        adjacent.push(hex);
      }
    });

    return adjacent;
  };

  // Get current hex the player is on
  const getCurrentHex = () => {
    if (!state.mapData) return null;
    return state.mapData.find(
      h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
    );
  };

  // Helper function to get hex in a direction
  const getHexInDirection = (direction: string) => {
    if (!state.mapData) return null;

    const { col, row } = state.playerPosition;
    let targetCol = col;
    let targetRow = row;

    switch (direction) {
      case 'up':
        targetRow = row - 1;
        break;
      case 'down':
        targetRow = row + 1;
        break;
      case 'left':
        targetCol = col - 1;
        break;
      case 'right':
        targetCol = col + 1;
        break;
      default:
        return null;
    }

    return state.mapData.find(h => h.col === targetCol && h.row === targetRow);
  };

  // Handle engaging in combat with a POI
  const handleEngageCombat = async (poi: ScenePoi) => {
    addMessage(`You engage ${poi.name} in combat!`, 'encounter');

    // Get party members
    const allies = state.party?.getAllMembers().filter((m: unknown) => m) ?? [];

    // Parse enemies from POI
    const diceRoller = new DiceRoller();
    const enemies = Enemy.parseCreatureString(poi.creatures ?? '', poi.cr ?? 1, diceRoller);

    // Determine encounter type based on POI or terrain
    let encounterType = 'standard';
    if (poi.eventType === 'ambush') encounterType = 'ambush';
    if ((poi.cr ?? 0) >= 5) encounterType = 'boss';

    // Get terrain type from current hex
    const currentHex = state.mapData?.find(
      h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
    );
    const terrainType = currentHex?.terrain?.name || 'plains';

    // Pre-load AI for enemies before combat starts
    logger.combat.info('Loading AI for encounter', {
      encounterName: poi.name,
      enemyCount: enemies.length,
    });

    const aiLoadPromises = enemies.map(async enemy => {
      try {
        enemy.aiConfig = await AIEngine.loadAI(enemy.family, enemy.variant);
        logger.combat.debug('AI loaded', { name: enemy.name, family: enemy.family });
      } catch (error) {
        logger.combat.error('AI load failed', {
          name: enemy.name,
          error: error instanceof Error ? error.message : String(error),
        });
        enemy.aiConfig = AIEngine.getFallbackAI();
      }
    });

    await Promise.all(aiLoadPromises);
    logger.combat.info('All enemy AI loaded for encounter');

    // Dispatch START_COMBAT
    dispatch({
      type: actions.START_COMBAT,
      payload: {
        allies,
        enemies,
        encounterName: poi.name,
        encounterType,
        terrainType,
        gameLogger: addMessage,
      },
    });
  };

  const handleMoveToHex = (hex: SceneHex) => {
    // Null checks for safety
    if (!state.playerCharacter) {
      logger.movement.error('Cannot move: No player character');
      return;
    }

    if (!hex || hex.col === undefined || hex.row === undefined) {
      logger.movement.error('Cannot move: Invalid hex', { hex });
      return;
    }

    if (!isHexReachable(hex.col, hex.row)) return;

    // Don't move if already on this hex
    if (hex.col === state.playerPosition.col && hex.row === state.playerPosition.row) {
      return;
    }

    // Block movement if active event is in progress
    if (isBlockingMovement) {
      addMessage('You must resolve the current event first!', 'warning');
      return;
    }

    // Check terrain traversability
    const terrainKey = hex.terrain?.key;
    if (state.playerCharacter && !state.playerCharacter.canCrossTerrain(terrainKey)) {
      if (terrainKey === 'river') {
        addMessage('You need a raft or boat to cross the river!', 'warning');
      } else if (terrainKey === 'water') {
        addMessage('You need a boat to cross the water!', 'warning');
      } else {
        addMessage('You cannot traverse this terrain!', 'warning');
      }
      return;
    }

    // Consume rations for travel (only when survival mechanics are enabled)
    if (FEATURES.SURVIVAL_ENABLED) {
      const character = state.playerCharacter;
      if (character) {
        // Create immutable copy to avoid state mutation
        const updatedCharacter = character.clone();

        if (updatedCharacter.rations > 0) {
          updatedCharacter.rations--;
          updatedCharacter.daysWithoutFood = 0;
        } else {
          updatedCharacter.daysWithoutFood++;
        }

        // Update character state with immutable copy
        dispatch({
          type: actions.UPDATE_CHARACTER,
          payload: updatedCharacter,
        });
      }
    }

    // Capture old time before advancing (for time-of-day transition detection)
    const oldTime = { ...state.gameTime };

    // Update player position
    dispatch({
      type: actions.SET_PLAYER_POSITION,
      payload: { col: hex.col, row: hex.row },
    });

    // Advance time for movement (1 day per hex)
    dispatch({
      type: actions.ADVANCE_TIME,
      payload: TIME_COSTS.MOVEMENT,
    });

    // Reveal hexes around new position
    dispatch({
      type: actions.REVEAL_AROUND_PLAYER,
      payload: { col: hex.col, row: hex.row },
    });

    // Log movement to debug console (not to GameLog)
    logger.movement.debug('Player moved to hex', {
      col: hex.col,
      row: hex.row,
      terrain: hex.terrain?.name,
      timeCost: '1 day',
    });

    // Build and log consolidated hex entry message
    const newTime = state.gameTime; // This will be updated after ADVANCE_TIME dispatch
    const oldTimeOfDay = getTimeOfDay(oldTime.hour);
    const newTimeOfDay = getTimeOfDay(newTime.hour);

    const hexEntryMsg = buildHexEntryMessage(hex, oldTimeOfDay, newTimeOfDay);
    if (hexEntryMsg) {
      addMessage(hexEntryMsg.message, hexEntryMsg.type);
    }

    // Check for POI discovery
    if (hex.poi) {
      const discovered = isPoiDiscovered(hex.col, hex.row);

      if (!discovered) {
        // Mark as discovered
        dispatch({
          type: actions.DISCOVER_POI,
          payload: { col: hex.col, row: hex.row },
        });

        // Build discovery message with optional flavor (20% chance)
        let discoveryMsg = `You discovered: ${hex.poi.name}!`;

        // Add POI flavor inline (20% chance)
        if (Math.random() < 0.2) {
          const poiFlavor = generatePOIFlavor(hex.poi.type ?? '', hex.poi.cr || 1);
          if (poiFlavor) {
            discoveryMsg += ` - ${poiFlavor}`;
          }
        }

        addMessage(discoveryMsg, 'discovery');

        // Trigger event based on type
        if (hex.poi.eventType === 'active') {
          // Combat intro
          const combatIntro = generateCombatIntro(hex.poi.type ?? '');
          addMessage(combatIntro, 'encounter');

          // Trigger combat encounter directly
          handleEngageCombat(hex.poi);
        }
      } else if (hex.poi.eventType === 'active') {
        // Already discovered active event - trigger combat again
        const combatIntro = generateCombatIntro(hex.poi.type ?? '');
        addMessage(combatIntro, 'encounter');
        handleEngageCombat(hex.poi);
      }
    }
  };

  // Handle foraging
  const handleForage = () => {
    if (!FEATURES.SURVIVAL_ENABLED) return;

    // Block foraging in interiors
    if (state.inInterior) {
      addMessage('Cannot forage indoors.', 'warning');
      return;
    }

    if (!state.playerCharacter) {
      addMessage('No player character found.', 'error');
      return;
    }

    // Get current hex (use HexGrid for O(1) lookup if available)
    const currentHex = state.hexGrid
      ? state.hexGrid.get(state.playerPosition.col, state.playerPosition.row)
      : state.mapData?.find(
          hex => hex.col === state.playerPosition.col && hex.row === state.playerPosition.row
        );

    if (!currentHex) {
      addMessage('Cannot determine current hex.', 'error');
      return;
    }

    // Get current hex + adjacent hexes
    const adjacentHexes = getAdjacentHexes(state.playerPosition.col, state.playerPosition.row);
    const allHexes = [currentHex, ...adjacentHexes];

    // Check if any hex is on cooldown (3 days)
    const currentDay = state.gameTime.day;
    const FORAGE_COOLDOWN = 3;

    if (!state.playerCharacter.foragedHexes) {
      state.playerCharacter.foragedHexes = {};
    }

    const hexesOnCooldown = allHexes.filter(hex => {
      const hexKey = `${hex.col},${hex.row}`;
      const lastForaged = state.playerCharacter.foragedHexes[hexKey];
      return lastForaged && currentDay - lastForaged < FORAGE_COOLDOWN;
    });

    if (hexesOnCooldown.length === allHexes.length) {
      const daysRemaining =
        FORAGE_COOLDOWN -
        (currentDay - state.playerCharacter.foragedHexes[`${currentHex.col},${currentHex.row}`]);
      addMessage(
        `All hexes in this area have been foraged recently. Wait ${daysRemaining} more day(s).`,
        'warning'
      );
      return;
    }

    if (hexesOnCooldown.length > 0) {
      addMessage(
        `${hexesOnCooldown.length} of ${allHexes.length} hexes already foraged recently. Searching remaining hexes...`,
        'info'
      );
    }

    // Create a proper copy of the character
    const updatedCharacter = state.playerCharacter.clone();

    // Create dice roller with logger (no seed - we want random rolls, not deterministic)
    const diceRoller = new DiceRoller(null, addMessage);

    // Perform forage check
    const result = SurvivalManager.forage(updatedCharacter, allHexes, diceRoller, currentDay);

    // Mark all hexes as foraged with current day
    result.hexesForaged.forEach(hexKey => {
      updatedCharacter.foragedHexes[hexKey] = currentDay;
    });

    // Log for debugging
    logger.items.debug('Foraging complete', {
      currentDay,
      hexesForaged: result.hexesForaged,
      foragedHexes: updatedCharacter.foragedHexes,
    });

    // Update character state
    dispatch({
      type: actions.UPDATE_CHARACTER,
      payload: updatedCharacter,
    });

    // Advance time (foraging takes 4 hours)
    dispatch({
      type: actions.ADVANCE_TIME,
      payload: TIME_COSTS.FORAGE,
    });

    // Show foraging result (dice roll is already logged by DiceRoller)
    if (result.success) {
      addMessage(
        `Found ${result.rationsGained} rations (${result.goodHexCount} rich hexes)`,
        'info'
      );
    } else {
      addMessage(`No food found`, 'info');
    }
  };

  // Check foraging status for indicator
  const getForageStatus = () => {
    // Disable foraging in interiors
    if (state.inInterior) {
      return { ready: false, message: 'Cannot forage indoors' };
    }

    if (!state.playerCharacter || !state.mapData) {
      return { ready: false, message: 'Not ready' };
    }

    const currentHex = state.hexGrid
      ? state.hexGrid.get(state.playerPosition.col, state.playerPosition.row)
      : state.mapData?.find(
          hex => hex.col === state.playerPosition.col && hex.row === state.playerPosition.row
        );

    if (!currentHex) {
      return { ready: false, message: 'Invalid location' };
    }

    const adjacentHexes = getAdjacentHexes(state.playerPosition.col, state.playerPosition.row);
    const allHexes = [currentHex, ...adjacentHexes];
    const currentDay = state.gameTime.day;
    const FORAGE_COOLDOWN = 3;

    if (!state.playerCharacter.foragedHexes) {
      return { ready: true, message: 'Ready to forage' };
    }

    const hexesOnCooldown = allHexes.filter(hex => {
      const hexKey = `${hex.col},${hex.row}`;
      const lastForaged = state.playerCharacter.foragedHexes[hexKey];
      return lastForaged && currentDay - lastForaged < FORAGE_COOLDOWN;
    });

    if (hexesOnCooldown.length === allHexes.length) {
      const hexKey = `${currentHex.col},${currentHex.row}`;
      const daysRemaining =
        FORAGE_COOLDOWN - (currentDay - state.playerCharacter.foragedHexes[hexKey]);
      return { ready: false, message: `Cooldown: ${daysRemaining}d` };
    }

    if (hexesOnCooldown.length > 0) {
      return {
        ready: true,
        message: `Partial: ${allHexes.length - hexesOnCooldown.length}/${allHexes.length} hexes`,
      };
    }

    return { ready: true, message: 'Ready to forage' };
  };

  return {
    getCurrentHex,
    getHexInDirection,
    getAdjacentHexes,
    handleMoveToHex,
    handleEngageCombat,
    handleForage,
    getForageStatus,
  };
}

export type OverworldActions = ReturnType<typeof useOverworldActions>;
