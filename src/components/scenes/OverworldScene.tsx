import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import logger from '../../utils/logger';
import { useGameState } from '../../contexts/GameStateContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useGameLog } from '../../contexts/GameLogContext';
// import { useEventInfoBox } from '../../contexts/EventInfoBoxContext';
import { useMapGeneration } from '../../hooks/useMapGeneration';
import { useInfiniteTerrainExpansion } from '../../hooks/useInfiniteTerrainExpansion';
import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import { useHexInteraction } from '../../hooks/useHexInteraction';
import { TerrainGenerator } from '../../terrainGenerator';
import { TIME_COSTS, formatTime, getTimeOfDay } from '../../game/TimeManager';
import { DiceRoller } from '../../game/DiceRoller';
import {
  generateHexEntryFlavor,
  generateTimeTransitionFlavor,
  generateWeatherFlavor,
  generatePOIFlavor,
  generateCombatIntro,
} from '../../utils/flavorTextGenerator';
import { getXPForCR } from '../../game/Combat';
import { Enemy } from '../../game/Enemy';
import { Character } from '../../game/Character';
import { findPath } from '../../game/Pathfinding';
import SurvivalManager from '../../game/SurvivalManager';
import { FEATURES } from '../../constants/gameConstants';
import GameLog from '../ui/GameLog';
import CharacterStats from '../ui/CharacterStats';
import PartyList from '../ui/PartyList';
import Equipment from '../ui/Equipment';
import HexDetails from '../ui/HexDetails';
import InteriorInfoPane from '../ui/InteriorInfoPane';
import Settings from '../ui/Settings';
import RestMenu from '../ui/RestMenu';
import SurvivalMenu from '../ui/SurvivalMenu';
import QuestLog from '../ui/QuestLog';
import SaveSlotManager from '../ui/SaveSlotManager';
import HexGridCanvas from '../canvas/HexGridCanvas';
import InteriorHexCanvas from '../canvas/InteriorHexCanvas';
import CombatCanvas from '../canvas/CombatCanvas';
import ActionPanel from '../ui/combat/ActionPanel';
import TurnOrderDisplay from '../ui/combat/TurnOrderDisplay';
import AbilityMenu from '../ui/combat/AbilityMenu';
import MenuSidebar from '../ui/MenuSidebar';
import MenuPanel from '../ui/MenuPanel';
import { SaveManager } from '../../utils/SaveManager';
import { AIEngine } from '../../game/ai/AIEngine';
import AIInspector from '../debug/AIInspector';
import DevTools from '../debug/DevTools';
import type { Hex, LogMessageType } from '../../types/game';
import type { CombatTurnEntry } from '../../types/state';

interface Coord {
  col: number;
  row: number;
}

interface ScenePoi {
  type?: string;
  name?: string;
  cr?: number;
  creatures?: string;
  eventType?: string;
  description?: string;
}

interface SceneInteriorMap {
  hexes: SceneHex[];
  entrance?: Coord;
  encounters?: unknown[];
  loot?: unknown[];
  hazards?: unknown[];
  [key: string]: unknown;
}

/** Loosely-typed hex used across the overworld/interior UI. */
interface SceneHex {
  col: number;
  row: number;
  terrain?: { name?: string; key?: string; walkable?: boolean; isInteractive?: boolean };
  content?: string | null;
  poi?: ScenePoi | null;
  weather?: { condition?: string } | null;
  buildingType?: string;
  connectedFloor?: number;
}

interface CombatUIState {
  selectedAction: string | null;
  selectedTarget: unknown;
  hoveredHex: Coord | null;
  cameraOffset: { x: number; y: number };
  cameraZoom: number;
  attacksUsedThisTurn: number;
}

const CLASS_ICONS: Record<string, string> = {
  fighter: '⚔️',
  wizard: '✨',
  cleric: '✝️',
  rogue: '🗡️',
  ranger: '🏹',
  barbarian: '🪓',
  paladin: '🛡️',
  druid: '🌿',
  bard: '🎵',
  sorcerer: '🔥',
  warlock: '👁️',
  monk: '👊',
};

function OverworldScene() {
  const { state, dispatch, actions, isHexReachable, isPoiDiscovered, getHexDistance } =
    useGameState();
  const { settings } = useSettings();
  const { addMessage } = useGameLog();
  // const { showMessage, showEvent, dismissEvent, isBlockingMovement } = useEventInfoBox();
  const isBlockingMovement = !!state.combatState?.active;
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(state.playerCharacter);
  const [selectedHex, setSelectedHex] = useState<SceneHex | null>(null);
  const [selectedInteriorHex, setSelectedInteriorHex] = useState<SceneHex | null>(null);
  // True once the player has stepped onto an Exit Hex inside a non-town POI
  const [, setInteriorExitReady] = useState(false);
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Combat ability menu
  const [showAbilityMenu, setShowAbilityMenu] = useState(false);

  // AI Inspector toggle (via URL param)
  const [showAIInspector] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('aiInspector') === 'true';
  });

  // Combat UI state
  const [combatUIState, setCombatUIState] = useState<CombatUIState>({
    selectedAction: null,
    selectedTarget: null,
    hoveredHex: null,
    cameraOffset: { x: 50, y: 50 },
    cameraZoom: 1.0, // Locked at 1.0 - zoom disabled in combat
    attacksUsedThisTurn: 0,
  });

  const terrainGeneratorRef = useRef<TerrainGenerator | null>(null);

  // Initialize terrain generator
  useEffect(() => {
    if (!terrainGeneratorRef.current) {
      terrainGeneratorRef.current = new TerrainGenerator();
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Use custom hooks for map generation and expansion
  useMapGeneration(terrainGeneratorRef, viewportSize);
  useInfiniteTerrainExpansion(terrainGeneratorRef, viewportSize);

  // Update selected character when player character changes
  useEffect(() => {
    if (state.playerCharacter) {
      setSelectedCharacter(state.playerCharacter);
    }
  }, [state.playerCharacter]);

  const handlePartyMemberSelect = (member: Character | null, _index: number) => {
    setSelectedCharacter(member);
  };

  // Define menu items (memoized to prevent re-renders)
  const menuItems = useMemo(() => {
    const items = [
      {
        id: 'character',
        label: 'Character',
        icon: '👤',
        description: 'View character stats',
      },
      {
        id: 'party',
        label: 'Party',
        icon: '👥',
        description: 'Manage party members',
        badge: state.party?.npcs?.filter((npc: unknown) => npc).length || 0,
      },
      {
        id: 'equipment',
        label: 'Equipment',
        icon: '⚔️',
        description: 'Manage inventory & gear',
      },
      {
        id: 'rest',
        label: 'Rest',
        icon: '🏕️',
        description: 'Rest and recover',
      },
      ...(FEATURES.SURVIVAL_ENABLED
        ? [
            {
              id: 'survival',
              label: 'Survival',
              icon: '🌲',
              description: 'Forage and hunt',
              disabled: !!state.combatState?.active,
              disabledReason: 'Cannot forage during combat',
            },
          ]
        : []),
      {
        id: 'quests',
        label: 'Quests',
        icon: '📜',
        description: 'Track your quests',
        badge: state.activeQuests?.length || 0,
      },
      {
        id: 'save',
        label: 'Save',
        icon: '💾',
        description: 'Save your game',
      },
      {
        id: 'config',
        label: 'Config',
        icon: '⚙️',
        description: 'Game settings',
      },
    ];

    return items;
  }, [state.party?.npcs, state.activeQuests?.length, state.combatState]);

  const handleMenuItemClick = (item: { id: string }) => {
    // If survival is clicked, trigger foraging directly instead of opening panel
    if (item.id === 'survival' && FEATURES.SURVIVAL_ENABLED) {
      if (!state.inInterior) {
        handleForage();
      } else {
        addMessage('Cannot forage indoors.', 'warning');
      }
      return;
    }

    // If save is clicked, open save menu modal
    if (item.id === 'save') {
      setShowSaveMenu(true);
      return;
    }

    setOpenPanel(item.id);
  };

  const handleClosePanel = () => {
    setOpenPanel(null);
  };

  const handleHexClick = (hex: SceneHex) => {
    setSelectedHex(hex);
  };

  const handleHexDoubleClick = (hex: SceneHex) => {
    if (!settings.doubleClickMove) return;

    // Block movement if active event is in progress
    if (isBlockingMovement) {
      addMessage('You must resolve the current event first!', 'warning');
      return;
    }

    // Check if hex is reachable
    if (isHexReachable(hex.col, hex.row)) {
      handleMoveToHex(hex);
    } else {
      addMessage('That hex is too far away!', 'warning');
    }
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
        const updatedCharacter = Character.fromJSON(character.toJSON());

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
    const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());

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

  // Get current hex the player is on
  const getCurrentHex = () => {
    if (!state.mapData) return null;
    return state.mapData.find(
      h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
    );
  };

  // Get hex interaction handlers for current hex
  const currentHex = getCurrentHex();
  const { handleInteract, handleSearch } = useHexInteraction(currentHex ?? null);

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

  // Handle quick save (F5)
  const handleQuickSave = () => {
    try {
      const nextSlot = SaveManager.getNextQuicksaveSlot();
      const success = SaveManager.saveToSlot(nextSlot, state);

      if (success) {
        // Get slot letter for display (A, B, or C)
        const slotLetter =
          nextSlot === SaveManager.SAVE_SLOTS.QUICKSAVE_A
            ? 'A'
            : nextSlot === SaveManager.SAVE_SLOTS.QUICKSAVE_B
              ? 'B'
              : 'C';
        addMessage(`Quick saved to slot ${slotLetter}`, 'system');
      } else {
        addMessage('Quick save failed', 'error');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.storage.error('Quick save error:', { error, message: msg });
      addMessage('Quick save failed: ' + msg, 'error');
    }
  };

  // Unified keyboard control callbacks (works for both overworld and interior)
  const keyboardCallbacks = {
    onMoveUp: () => {
      if (state.inInterior) {
        const targetHex = getInteriorHexInDirection('up');
        if (targetHex && targetHex.terrain?.walkable) {
          handleInteriorHexDoubleClick(targetHex);
        }
      } else {
        const targetHex = getHexInDirection('up');
        if (targetHex && isHexReachable(targetHex.col, targetHex.row)) {
          handleMoveToHex(targetHex);
        }
      }
    },
    onMoveDown: () => {
      if (state.inInterior) {
        const targetHex = getInteriorHexInDirection('down');
        if (targetHex && targetHex.terrain?.walkable) {
          handleInteriorHexDoubleClick(targetHex);
        }
      } else {
        const targetHex = getHexInDirection('down');
        if (targetHex && isHexReachable(targetHex.col, targetHex.row)) {
          handleMoveToHex(targetHex);
        }
      }
    },
    onMoveLeft: () => {
      if (state.inInterior) {
        const targetHex = getInteriorHexInDirection('left');
        if (targetHex && targetHex.terrain?.walkable) {
          handleInteriorHexDoubleClick(targetHex);
        }
      } else {
        const targetHex = getHexInDirection('left');
        if (targetHex && isHexReachable(targetHex.col, targetHex.row)) {
          handleMoveToHex(targetHex);
        }
      }
    },
    onMoveRight: () => {
      if (state.inInterior) {
        const targetHex = getInteriorHexInDirection('right');
        if (targetHex && targetHex.terrain?.walkable) {
          handleInteriorHexDoubleClick(targetHex);
        }
      } else {
        const targetHex = getHexInDirection('right');
        if (targetHex && isHexReachable(targetHex.col, targetHex.row)) {
          handleMoveToHex(targetHex);
        }
      }
    },
    onInteract: () => {
      if (state.inInterior) {
        const currentHex = getInteriorHexAt(
          state.interiorPlayerPosition?.col ?? 0,
          state.interiorPlayerPosition?.row ?? 0
        );

        if (currentHex && currentHex.terrain?.isInteractive && currentHex.buildingType) {
          handleBuildingInteraction(currentHex);
        } else if (
          currentHex &&
          (currentHex.content === 'exit' ||
            currentHex.terrain?.key === 'exit' ||
            currentHex.terrain?.key === 'gate')
        ) {
          // Player is on the exit tile — leave the interior
          const settlementTypes = ['camp', 'village', 'town', 'city', 'metropolis'];
          const isSettlement = settlementTypes.includes(state.currentPOI?.poi?.type ?? '');
          if (isSettlement) {
            dispatch({ type: actions.EXIT_TOWN });
          } else {
            setInteriorExitReady(true);
            dispatch({ type: actions.EXIT_EXPLORATION });
          }
        } else if (
          currentHex &&
          currentHex.content === 'entrance' &&
          ['camp', 'village', 'town', 'city', 'metropolis'].includes(
            state.currentPOI?.poi?.type ?? ''
          )
        ) {
          // Entrance tile only exits for towns (legacy behaviour)
          dispatch({ type: actions.EXIT_TOWN });
        } else if (
          currentHex &&
          (currentHex.content === 'loot' || currentHex.content === 'chest')
        ) {
          // Space bar on a loot tile — same as double-clicking it
          const poiKey = state.currentPOI
            ? `${state.currentPOI.col},${state.currentPOI.row}`
            : null;
          const currentInteriorMap = poiKey ? state.interiorMaps[poiKey] : null;
          const lootItem = currentInteriorMap?.loot?.find(
            l => l.col === currentHex.col && l.row === currentHex.row
          );
          if (lootItem && !lootItem.collected) {
            dispatch({
              type: actions.COLLECT_LOOT,
              payload: { items: lootItem.items || [], gold: lootItem.gold || 0 },
            });
            dispatch({
              type: actions.DISCOVER_LOOT,
              payload: { poiKey, lootKey: `${currentHex.col},${currentHex.row}`, collected: true },
            });
            const parts = [];
            if (lootItem.gold > 0) parts.push(`${lootItem.gold} gold`);
            if (lootItem.items?.length > 0) {
              const itemNames = lootItem.items
                .map((it: { name?: string }) => it.name || it)
                .join(', ');
              parts.push(itemNames);
            }
            addMessage(
              lootItem.label
                ? `${lootItem.label}: ${lootItem.description || parts.join(' and ')}`
                : `You find ${parts.join(' and ')}.`,
              'info'
            );
          }
        }
      } else {
        const hex = getCurrentHex();
        if (hex && hex.poi) {
          // Check if POI is discovered first
          const discovered = isPoiDiscovered(hex.col, hex.row);

          // Directly trigger the appropriate action based on POI type
          const settlementTypes = ['camp', 'village', 'town', 'city', 'metropolis'];
          if (settlementTypes.includes(hex.poi.type)) {
            if (discovered || hex.poi.visibleWithoutDiscovery) {
              // Enter settlement - use handleInteract which will route to the correct handler
              handleInteract();
            }
          } else if (['cave', 'ruins', 'tower', 'dungeon'].includes(hex.poi.type)) {
            handleInteract();
          }
          // Note: shrines now use buttons in HexDetails panel
          // No spacebar action for them - player uses buttons
        }
      }
    },
    onSearch: () => {
      if (!state.inInterior) {
        const hex = getCurrentHex();
        if (hex && hex.poi) {
          handleSearch();
        }
      }
    },
    onRest: () => {
      setOpenPanel('rest');
    },
    onForage: () => {
      if (!state.inInterior) {
        handleForage();
      }
    },
    onInventory: () => {
      setOpenPanel('equipment');
    },
    onQuests: () => {
      setOpenPanel('quests');
    },
    onMap: () => {
      addMessage('Map view not yet implemented', 'info');
    },
    onQuickSave: () => {
      handleQuickSave();
    },
  };

  // Enable keyboard controls (works for both overworld and interior)
  useKeyboardControls(keyboardCallbacks, !isBlockingMovement);

  // Helper to get interior hex at position
  const getInteriorHexAt = (col: number, row: number): SceneHex | null => {
    if (!interiorMap) return null;
    return interiorMap.hexes.find(h => h.col === col && h.row === row) ?? null;
  };

  // Helper to get interior hex in direction
  const getInteriorHexInDirection = (direction: string): SceneHex | null => {
    if (!state.interiorPlayerPosition || !interiorMap) return null;

    const { col, row } = state.interiorPlayerPosition;
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

    return getInteriorHexAt(targetCol, targetRow);
  };

  // Interior handlers
  const handleInteriorHexClick = (hex: SceneHex) => {
    setSelectedInteriorHex(hex);
  };

  const handleInteriorHexDoubleClick = async (hex: SceneHex) => {
    logger.movement.debug('Interior hex double click', {
      hex,
      playerPosition: state.interiorPlayerPosition,
    });

    if (!hex.terrain?.walkable) {
      addMessage('Cannot move to unwalkable terrain', 'warning');
      return;
    }

    if (!state.interiorPlayerPosition) {
      logger.movement.error('No interior player position set!');
      return;
    }

    // Check distance (1 hex move at a time)
    const distance = getHexDistance(
      state.interiorPlayerPosition.col,
      state.interiorPlayerPosition.row,
      hex.col,
      hex.row
    );

    logger.movement.debug('Distance check', { distance });

    if (distance > 1) {
      addMessage('Too far to move in one turn', 'warning');
      return;
    }

    // Update interior player position
    dispatch({
      type: actions.SET_INTERIOR_PLAYER_POSITION,
      payload: { col: hex.col, row: hex.row },
    });

    setSelectedInteriorHex(hex);

    // Check for building interactions (towns)
    if (hex.terrain?.isInteractive && hex.buildingType) {
      handleBuildingInteraction(hex);
    }

    // Check for town gate exit
    if (hex.terrain?.key === 'gate') {
      if (state.currentPOI?.poi.type === 'town') {
        dispatch({ type: actions.EXIT_TOWN });
      }
    }

    // Check for Exit Hex (non-town POIs) — unlock the exit button
    if (hex.terrain?.key === 'exit' || hex.content === 'exit') {
      setInteriorExitReady(true);
      addMessage(
        `You reach the entrance of ${state.currentPOI?.poi?.name || 'this location'}. Click "← Exit Interior" to leave.`,
        'info'
      );
      return; // Don't process loot/other content on exit tile
    }

    // ── Stair transitions ────────────────────────────────────────────────────
    if (hex.content === 'stairsUp' || hex.content === 'stairsDown') {
      const targetFloor = hex.connectedFloor;
      const poiKey = state.currentPOI ? `${state.currentPOI.col},${state.currentPOI.row}` : null;
      if (poiKey == null || targetFloor == null) return;

      // Use a consistent "floor{N}" key format for all floors, including floor 0
      const floorKey = `${poiKey}:floor${targetFloor}`;
      let targetMap = state.interiorFloors?.[floorKey];

      // Before leaving the current floor, cache it if not already cached so we
      // can return to it later without regenerating (floor 0 lives in interiorMaps[poiKey]
      // initially, upper floors are generated lazily).
      const currentFloorIndex = state.currentFloor ?? 0;
      const currentFloorKey = `${poiKey}:floor${currentFloorIndex}`;
      if (!state.interiorFloors?.[currentFloorKey]) {
        const currentFloorMap = state.interiorMaps[poiKey];
        if (currentFloorMap) {
          dispatch({
            type: actions.SET_INTERIOR_FLOOR,
            payload: { key: currentFloorKey, map: currentFloorMap },
          });
        }
      }

      if (!targetMap) {
        // Lazily generate this floor
        const poi = state.currentPOI?.poi;
        const currentMap = state.interiorMaps[poiKey] as
          | { cr?: number; width?: number; height?: number; floorCount?: number }
          | undefined;
        const cr = currentMap?.cr || poi?.cr || 1;
        const width = currentMap?.width || 20;
        const height = currentMap?.height || 15;

        try {
          if (poi?.type === 'tower') {
            const { TowerGenerator } = await import('../../game/TowerGenerator');
            const gen = new TowerGenerator();
            gen.setSeed(`${poiKey}:floor${targetFloor}-${state.mapSeed}`);
            targetMap = gen.generateFloor(
              width,
              height,
              cr,
              targetFloor,
              currentMap?.floorCount || 6
            );
          } else if (poi?.type === 'dungeon') {
            const { DungeonGenerator } = await import('../../game/DungeonGenerator');
            const gen = new DungeonGenerator();
            gen.setSeed(`${poiKey}:boss-${state.mapSeed}`);
            targetMap = gen.generateBossFloor(width, height, cr);
          }

          if (targetMap) {
            dispatch({
              type: actions.SET_INTERIOR_FLOOR,
              payload: { key: floorKey, map: targetMap },
            });
          }
        } catch (_err) {
          addMessage('Could not generate next floor.', 'error');
          return;
        }
      }

      if (!targetMap) return;

      // Determine spawn position on the target floor.
      // Going UP   → player arrives at stairsDown (came from below).
      // Going DOWN → player arrives at stairsUp   (came from above).
      const goingUp = hex.content === 'stairsUp';
      const spawnPos = goingUp
        ? targetMap.spawnUp || targetMap.entrance
        : targetMap.spawnDown || targetMap.entrance;

      addMessage(
        goingUp
          ? `You ascend to floor ${targetFloor + 1}...`
          : `You descend to floor ${targetFloor + 1}...`,
        'info'
      );

      dispatch({
        type: actions.CHANGE_FLOOR,
        payload: { floor: targetFloor, spawnPosition: spawnPos },
      });

      // Swap which interior map is "active" so the canvas renders the new floor.
      // interiorMaps[poiKey] is the "live" map the renderer reads from;
      // we temporarily overwrite it with the target floor map.
      dispatch({
        type: actions.SET_INTERIOR_MAP,
        payload: { key: poiKey, map: targetMap },
      });

      return;
    }

    // Check for loot / chest — collect it
    if (hex.content === 'loot' || hex.content === 'chest') {
      const poiKey = state.currentPOI ? `${state.currentPOI.col},${state.currentPOI.row}` : null;
      const currentInteriorMap = poiKey ? state.interiorMaps[poiKey] : null;
      const lootItem = currentInteriorMap?.loot?.find(l => l.col === hex.col && l.row === hex.row);

      if (lootItem && !lootItem.collected) {
        // Collect the loot
        dispatch({
          type: actions.COLLECT_LOOT,
          payload: {
            items: lootItem.items || [],
            gold: lootItem.gold || 0,
          },
        });

        // Mark as collected in the interior map (grays out the chest icon)
        dispatch({
          type: actions.DISCOVER_LOOT,
          payload: {
            poiKey,
            lootKey: `${hex.col},${hex.row}`,
            collected: true,
          },
        });

        // Feedback message
        const parts = [];
        if (lootItem.gold > 0) parts.push(`${lootItem.gold} gold`);
        if (lootItem.items?.length > 0) {
          const itemNames = lootItem.items
            .map((it: { name?: string }) => it.name || it)
            .join(', ');
          parts.push(itemNames);
        }
        addMessage(
          lootItem.label
            ? `${lootItem.label}: ${lootItem.description || parts.join(' and ')}`
            : `You find ${parts.join(' and ')}.`,
          'info'
        );
      }
    }
  };

  // Handle building interactions in towns
  const handleBuildingInteraction = (hex: SceneHex) => {
    const buildingType = hex.buildingType;

    switch (buildingType) {
      case 'inn':
        setOpenPanel('rest');
        break;
      case 'shop':
        addMessage('Shop interface coming soon!', 'info');
        break;
      case 'questBoard':
        setOpenPanel('quests');
        break;
      case 'blacksmith':
      case 'temple':
      case 'house':
        addMessage(`${buildingType} services coming soon!`, 'info');
        break;
    }
  };

  // Get interior map if in interior — use optional chaining so undefined currentPOI
  // never crashes during a React batch render where inInterior flips before currentPOI is set
  const interiorMap = (
    state.inInterior && state.currentPOI?.col !== undefined
      ? (state.interiorMaps[`${state.currentPOI.col},${state.currentPOI.row}`] ?? null)
      : null
  ) as SceneInteriorMap | null;

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

  const forageStatus = FEATURES.SURVIVAL_ENABLED
    ? getForageStatus()
    : { ready: false, message: '' };

  // Check for victory/defeat in combat
  const combatEndHandledRef = useRef(false);
  const combatStartRoundRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state.combatState) {
      combatEndHandledRef.current = false;
      combatStartRoundRef.current = null;
      return;
    }

    // Don't check on the very first round/turn (combat just started)
    if (combatStartRoundRef.current === null) {
      combatStartRoundRef.current = state.combatState.round;
      logger.combat.debug('Combat started, skipping initial victory check');
      return;
    }

    // Already handled combat end
    if (combatEndHandledRef.current) return;

    const livingAllies = state.combatState.turnOrder.filter(c => c.isAlly && c.currentHP > 0);
    const livingEnemies = state.combatState.turnOrder.filter(c => c.isEnemy && c.currentHP > 0);

    logger.combat.debug('Victory check', {
      livingAllies: livingAllies.length,
      livingEnemies: livingEnemies.length,
      allAllies: state.combatState.turnOrder
        .filter(c => c.isAlly)
        .map(c => ({ name: c.name, hp: c.currentHP })),
      allEnemies: state.combatState.turnOrder
        .filter(c => c.isEnemy)
        .map(c => ({ name: c.name, hp: c.currentHP })),
    });

    if (livingEnemies.length === 0 && livingAllies.length > 0) {
      combatEndHandledRef.current = true;

      // Calculate XP from all defeated enemies
      const defeatedEnemies = state.combatState.turnOrder.filter(c => c.isEnemy && c.enemy);
      const totalXP = defeatedEnemies.reduce((sum, c) => sum + getXPForCR(c.enemy.cr ?? 0), 0);
      const livingAllyCount = livingAllies.length;
      const xpPerCharacter = livingAllyCount > 0 ? Math.floor(totalXP / livingAllyCount) : 0;

      addMessage('Victory! All enemies defeated!', 'success');

      if (defeatedEnemies.length > 0) {
        defeatedEnemies.forEach(c => {
          const xp = getXPForCR(c.enemy.cr ?? 0);
          addMessage(`  ${c.name} defeated — ${xp} XP (CR ${c.enemy.cr ?? 0})`, 'info');
        });
        addMessage(
          `Total XP: ${totalXP} / ${livingAllyCount} ally = ${xpPerCharacter} XP each`,
          'success'
        );
      }

      aiTimeoutRefs.current.victory = setTimeout(() => {
        if (xpPerCharacter > 0) {
          dispatch({ type: actions.AWARD_XP, payload: { xp: xpPerCharacter } });
        }
        dispatch({ type: actions.END_COMBAT, payload: { victory: true } });
        aiTimeoutRefs.current.victory = null;
      }, 2000);
    } else if (livingAllies.length === 0) {
      combatEndHandledRef.current = true;
      addMessage('Defeat! All party members have fallen...', 'error');
      aiTimeoutRefs.current.defeat = setTimeout(() => {
        dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'gameover' });
        aiTimeoutRefs.current.defeat = null;
      }, 2000);
    }

    return () => {
      if (aiTimeoutRefs.current.victory) {
        clearTimeout(aiTimeoutRefs.current.victory);
        aiTimeoutRefs.current.victory = null;
      }
      if (aiTimeoutRefs.current.defeat) {
        clearTimeout(aiTimeoutRefs.current.defeat);
        aiTimeoutRefs.current.defeat = null;
      }
    };
  }, [
    state.combatState?.currentTurnIndex,
    state.combatState?.round,
    // Re-run immediately when ally HP changes so defeat is caught as soon as
    // PROCESS_COMBAT_ACTION zeroes the last ally — not only after ADVANCE_COMBAT_TURN.
     
    state.combatState?.turnOrder?.filter(c => c.isAlly).reduce((sum, c) => sum + c.currentHP, 0),
    dispatch,
    actions,
    addMessage,
  ]);

  // Log initiative rolls when combat starts
  const initiativeLoggedRef = useRef(false);

  useEffect(() => {
    if (
      !state.combatState ||
      !state.combatState.turnOrder ||
      state.combatState.turnOrder.length === 0
    ) {
      initiativeLoggedRef.current = false;
      return;
    }

    // Only log once when combat starts (check round 1 and currentTurnIndex 0)
    if (state.combatState.round !== 1 || state.combatState.currentTurnIndex !== 0) {
      return;
    }

    // Check if already logged
    if (initiativeLoggedRef.current) {
      return;
    }

    initiativeLoggedRef.current = true;

    logger.combat.info('Logging initiative rolls', {
      turnOrderLength: state.combatState.turnOrder.length,
    });

    // Log initiative header
    addMessage('=== INITIATIVE ===', 'system');

    logger.combat.info('Starting initiative forEach loop', {
      count: state.combatState.turnOrder.length,
    });

    // Log each combatant's initiative
    state.combatState.turnOrder.forEach((combatant, index) => {
      logger.combat.debug('Processing combatant', {
        index,
        name: combatant.name,
        hasCharacter: !!combatant.character,
        hasEnemy: !!combatant.enemy,
        initiative: combatant.initiative,
      });

      if (!combatant.character && !combatant.enemy) {
        logger.combat.error('Combatant missing both character and enemy', {
          index,
          combatant,
        });
        return;
      }

      const char = combatant.character || combatant.enemy;

      if (!char || !char.abilities) {
        logger.combat.error('Character missing abilities', { index, char });
        return;
      }

      const dexMod = Math.floor((char.abilities.dexterity - 10) / 2);
      const itemBonus = char.initiativeBonus || 0;
      const initiative = combatant.initiative as number;
      const roll = initiative - dexMod - itemBonus;

      let modStr = `${dexMod >= 0 ? '+' : ''}${dexMod}`;
      if (itemBonus !== 0) {
        modStr += ` item+${itemBonus}`;
      }
      const logMessage = `${combatant.name}: ${initiative} (rolled ${roll}${modStr})`;

      logger.combat.info('Adding initiative message', { logMessage });
      addMessage(logMessage, 'system');
    });

    logger.combat.info('Finished initiative forEach loop');
    addMessage('', 'system'); // Blank line for spacing
  }, [
    state.combatState?.round,
    state.combatState?.currentTurnIndex,
    state.combatState?.turnOrder?.length,
    addMessage,
  ]);

  // Keep a ref that always holds the latest combatState so AI timers can read
  // current state without needing it as a useCallback dependency (which would
  // cause the cleanup to cancel in-flight timers on every state update).
  const combatStateRef = useRef(state.combatState);
  useEffect(() => {
    combatStateRef.current = state.combatState;
  });

  // ─── AI Turn System ──────────────────────────────────────────────────────────
  //
  // Design principles:
  //  1. A "turn token" (round:index string) is minted when an enemy's turn begins.
  //     Every timer callback checks it before doing anything — if the token no
  //     longer matches the live combat state the callback is a no-op (stale turn).
  //  2. Timers are NEVER cancelled by the useEffect cleanup.  Cancellation was the
  //     root cause of stuck turns: React's strict-mode double-invoke and mid-turn
  //     state updates (HP sync after attack) can retrigger the effect and wipe
  //     in-flight timers before they fire.
  //  3. The 5-second hard-fallback is cancelled on unmount only (via the ref the
  //     onAnimationComplete callback also holds), so it doesn't linger post-combat.

  // Tracks "round:index" of the turn currently being processed.
  const lastProcessedTurnRef = useRef<string | null>(null);
  // Holds the fallback timeout ID so onAnimationComplete can cancel it early.
  const aiTimeoutRefs = useRef<{
    turnTimeout: ReturnType<typeof setTimeout> | null;
    victory: ReturnType<typeof setTimeout> | null;
    defeat: ReturnType<typeof setTimeout> | null;
  }>({
    turnTimeout: null,
    victory: null,
    defeat: null,
  });
  // Set to true when an AI move animation is running; advance fires from onAnimationComplete.
  const pendingAIAdvanceRef = useRef(false);

  const processAITurn = useCallback(
    (combatant: CombatTurnEntry, turnToken: string) => {
      if (!combatant || !combatant.enemy) {
        logger.combat.error('Invalid combatant for AI turn', { combatant });
        return;
      }

      const currentCombatState = combatStateRef.current;
      if (!currentCombatState || !currentCombatState.battlefield) {
        logger.combat.error('Combat state invalid at AI turn start');
        return;
      }

      const enemy = combatant.enemy;
      addMessage(`${enemy.name} is thinking...`, 'encounter');
      pendingAIAdvanceRef.current = false;

      logger.combat.info('Processing AI turn', { name: enemy.name, turnToken });

      // Helper: check whether this turn is still the active one before acting.
      const isTokenStale = () => lastProcessedTurnRef.current !== turnToken;

      // Decide action synchronously so the closure captures it for the 800ms timer.
      let action: { type: string; [key: string]: unknown };
      try {
        action = AIEngine.decideAction(
          combatant as unknown as Parameters<typeof AIEngine.decideAction>[0],
          currentCombatState.battlefield,
          currentCombatState.turnOrder as unknown as Parameters<typeof AIEngine.decideAction>[2],
          currentCombatState.movementRemaining
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.combat.error('AIEngine.decideAction threw', { combatant: enemy.name, error: msg });
        addMessage(`${enemy.name} failed to act`, 'error');
        dispatch({ type: actions.ADVANCE_COMBAT_TURN });
        return;
      }

      logger.combat.debug('AI action decided', { action, turnToken });

      // 5-second hard fallback — fires if the normal path never advances the turn.
      if (aiTimeoutRefs.current.turnTimeout) clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
      aiTimeoutRefs.current.turnTimeout = setTimeout(() => {
        if (isTokenStale()) return; // already advanced
        logger.combat.warn('AI turn timeout – forcing advance', { combatant: enemy.name });
        addMessage(`${enemy.name}'s turn timed out`, 'warning');
        pendingAIAdvanceRef.current = false;
        dispatch({ type: actions.ADVANCE_COMBAT_TURN });
      }, 5000);

      // 800ms delay so the player can read the "thinking…" message.
      setTimeout(() => {
        if (isTokenStale()) {
          logger.combat.debug('AI action timer stale, skipping', { turnToken });
          return;
        }
        if (!combatStateRef.current) {
          logger.combat.warn('Combat ended during AI turn');
          clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
          return;
        }

        try {
          if (action.type === 'move') {
            const dest = action.destination as { col: number; row: number };
            addMessage(`${enemy.name} moves to (${dest.col}, ${dest.row})`, 'encounter');
            pendingAIAdvanceRef.current = true;
            dispatch({
              type: actions.PROCESS_COMBAT_MOVEMENT,
              payload: {
                path: action.path,
                cost: (action.moveCost as number) * 5,
              },
            });
            // Turn advance driven by onAnimationComplete — no advance timer here.
          } else if (action.type === 'attack') {
            const tgt = action.target as { character?: { name: string }; enemy?: { name: string } };
            const targetName = tgt.character?.name || tgt.enemy?.name;
            addMessage(`${enemy.name} attacks ${targetName}!`, 'encounter');
            dispatch({
              type: actions.PROCESS_COMBAT_ACTION,
              payload: { actionType: 'attack', target: action.target, attacker: combatant },
            });
          } else if (action.type === 'ability') {
            const tgt = action.target as
              | { character?: { name: string }; enemy?: { name: string } }
              | undefined;
            const targetName = tgt?.character?.name || tgt?.enemy?.name;
            addMessage(
              `${enemy.name} uses ${action.ability}${targetName ? ` on ${targetName}` : ''}!`,
              'encounter'
            );
            dispatch({
              type: actions.PROCESS_COMBAT_ACTION,
              payload: {
                actionType: 'ability',
                abilityName: action.ability,
                target: action.target,
                attacker: combatant,
              },
            });
          } else if (action.type === 'dodge') {
            dispatch({
              type: actions.PROCESS_COMBAT_ACTION,
              payload: {
                actionType: 'dodge',
                attacker: combatant,
                target: combatant,
              },
            });
          } else if (action.type === 'dash') {
            addMessage(`${enemy.name} takes the Dash action`, 'encounter');
          } else if (action.type === 'wait') {
            addMessage(`${enemy.name} waits`, 'encounter');
          } else {
            logger.combat.warn('AI returned unhandled action type — treating as wait', {
              combatant: enemy.name,
              actionType: action.type,
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.combat.error('AI action dispatch threw', { combatant: enemy.name, error: msg });
          pendingAIAdvanceRef.current = false;
          clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
          addMessage(`${enemy.name} failed to act`, 'error');
          dispatch({ type: actions.ADVANCE_COMBAT_TURN });
          return;
        }

        // Advance turn 500ms after non-move actions.
        if (!pendingAIAdvanceRef.current) {
          setTimeout(() => {
            if (isTokenStale()) return; // already advanced
            if (!combatStateRef.current) return;
            clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
            logger.combat.info('Advancing turn after AI action', { combatant: enemy.name });
            dispatch({ type: actions.ADVANCE_COMBAT_TURN });
          }, 500);
        }
      }, 800);
    },
    [dispatch, actions, addMessage]
  );

  useEffect(() => {
    if (!state.combatState?.active) return;

    const { currentTurnIndex, round, waitingForPlayerAction } = state.combatState;
    const turnKey = `${round}:${currentTurnIndex}`;

    // Already processed this exact turn — skip.
    if (lastProcessedTurnRef.current === turnKey) return;

    const currentCombatant = state.combatState.turnOrder[currentTurnIndex];
    if (!currentCombatant) return;

    logger.combat.debug('AI turn check', {
      combatant: currentCombatant.name,
      isEnemy: currentCombatant.isEnemy,
      waitingForPlayer: waitingForPlayerAction,
      turnKey,
    });

    if (currentCombatant.isEnemy && !waitingForPlayerAction) {
      lastProcessedTurnRef.current = turnKey;
      processAITurn(currentCombatant, turnKey);
    }

    // Only clean up the fallback timeout on unmount, not on every dep change.
    // Individual timer callbacks are self-guarded via isTokenStale().
    return () => {
      if (aiTimeoutRefs.current.turnTimeout) {
        clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
        aiTimeoutRefs.current.turnTimeout = null;
      }
    };
  }, [
    state.combatState?.active,
    state.combatState?.currentTurnIndex,
    state.combatState?.round,
    state.combatState?.waitingForPlayerAction,
    processAITurn,
  ]);

  // Combat handlers
  const handleCombatHexClick = useCallback(
    (hex: { col: number; row: number; [key: string]: unknown }) => {
      logger.combat.debug('Combat hex clicked', { hex, hasCombatState: !!state.combatState });

      if (!state.combatState) return;

      const currentCombatant = state.combatState.turnOrder[state.combatState.currentTurnIndex];
      if (!currentCombatant) {
        logger.combat.warn('No current combatant');
        return;
      }

      logger.combat.debug('Current combatant', {
        name: currentCombatant.name,
        isAlly: currentCombatant.isAlly,
        position: currentCombatant.position,
      });

      if (!currentCombatant.isAlly) {
        addMessage("It's not your turn!", 'warning');
        return;
      }

      // Check if hex is occupied by a combatant
      const targetCombatant = state.combatState.turnOrder.find(
        c => c.position?.col === hex.col && c.position?.row === hex.row
      );

      logger.combat.debug('Hex click routing', {
        selectedAction: combatUIState.selectedAction,
        hasTarget: !!targetCombatant,
        targetHex: { col: hex.col, row: hex.row },
      });

      // If "move" action is selected, try to move
      if (combatUIState.selectedAction === 'move') {
        logger.combat.info('Processing movement action');

        if (targetCombatant) {
          addMessage('Hex is occupied', 'warning');
          return;
        }

        // Calculate path using Pathfinding
        const path = findPath(
          currentCombatant.position as Parameters<typeof findPath>[0],
          hex as Parameters<typeof findPath>[1],
          state.combatState.battlefield as unknown as Parameters<typeof findPath>[2],
          state.combatState.turnOrder as unknown as Parameters<typeof findPath>[3]
        );

        if (!path || path.length === 0) {
          addMessage('No valid path to destination', 'warning');
          return;
        }

        const moveCost = path.length - 1; // First hex is current position
        const moveCostFeet = moveCost * 5;

        if (moveCostFeet > state.combatState.movementRemaining) {
          addMessage(
            `Not enough movement (need ${moveCostFeet} ft, have ${state.combatState.movementRemaining} ft)`,
            'warning'
          );
          return;
        }

        logger.combat.info('Dispatching PROCESS_COMBAT_MOVEMENT', {
          combatantId: currentCombatant.id,
          path,
          moveCost,
          moveCostFeet,
        });

        dispatch({
          type: actions.PROCESS_COMBAT_MOVEMENT,
          payload: {
            combatantId: currentCombatant.id,
            path,
            cost: moveCostFeet,
          },
        });

        addMessage(
          `Moved ${moveCost} hex${moveCost !== 1 ? 'es' : ''} to (${hex.col}, ${hex.row})`,
          'action'
        );

        // Clear selection
        setCombatUIState(prev => ({
          ...prev,
          selectedAction: null,
        }));
      } else if (
        combatUIState.selectedAction === 'attack' &&
        targetCombatant &&
        !targetCombatant.isAlly
      ) {
        // Attack action already selected, clicking enemy executes attack
        // Validate range before dispatching
        const weapon = currentCombatant.character?.equipment?.mainHand;
        const weaponRange = weapon?.range || 1;
        const attackDistance = getHexDistance(
          currentCombatant.position?.col ?? 0,
          currentCombatant.position?.row ?? 0,
          targetCombatant.position?.col ?? 0,
          targetCombatant.position?.row ?? 0
        );

        if (attackDistance > weaponRange) {
          if (weaponRange <= 1) {
            // Melee weapon or unarmed — target too far, no ranged option
            const weaponName = weapon?.name || 'your weapon';
            addMessage(
              `${weaponName} is a melee weapon. Equip a ranged weapon to attack at distance.`,
              'warning'
            );
          } else {
            addMessage(
              `Target out of range (${attackDistance} hexes, max ${weaponRange}).`,
              'warning'
            );
          }
          return;
        }

        logger.combat.info('Executing attack on target', {
          attacker: currentCombatant.name,
          target: targetCombatant.name,
          attackDistance,
          weaponRange,
        });

        dispatch({
          type: actions.PROCESS_COMBAT_ACTION,
          payload: {
            actionType: 'attack',
            attacker: currentCombatant,
            target: targetCombatant,
          },
        });

        addMessage(
          `${currentCombatant.name} attacks ${targetCombatant.enemy?.name || targetCombatant.name}!`,
          'action'
        );

        // Clear selection and increment attacks
        setCombatUIState(prev => ({
          ...prev,
          selectedAction: null,
          selectedTarget: null,
          attacksUsedThisTurn: prev.attacksUsedThisTurn + 1,
        }));
      } else if (targetCombatant && !targetCombatant.isAlly) {
        // Clicking an enemy without action selected - auto-select attack
        logger.combat.info('Auto-selecting attack for enemy click');
        setCombatUIState(prev => ({
          ...prev,
          selectedAction: 'attack',
          selectedTarget: targetCombatant,
        }));
        addMessage(`Targeting ${targetCombatant.enemy?.name || targetCombatant.name}`, 'action');
      } else {
        logger.combat.debug('No action taken for hex click');
      }
    },
    [state.combatState, combatUIState.selectedAction, dispatch, actions, addMessage]
  );

  const handleCombatEndTurn = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = state.combatState.turnOrder[state.combatState.currentTurnIndex];
    addMessage(`${currentCombatant.name} ended their turn`, 'action');

    setCombatUIState(prev => ({
      ...prev,
      attacksUsedThisTurn: 0,
      selectedAction: null,
      selectedTarget: null,
    }));

    dispatch({ type: actions.ADVANCE_COMBAT_TURN });
  }, [state.combatState, dispatch, actions, addMessage]);

  const getCurrentCombatant = () => {
    if (!state.combatState?.turnOrder || state.combatState.currentTurnIndex === undefined) {
      return null;
    }
    return state.combatState.turnOrder[state.combatState.currentTurnIndex];
  };

  // Guard: if we're transitioning into an interior but the position/map isn't
  // ready yet (can happen on the first render after ENTER_EXPLORATION fires),
  // show a brief loading state rather than crashing on null.col access.
  if (state.inInterior && (!state.interiorPlayerPosition || !state.currentPOI)) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          fontSize: '1.2rem',
        }}
      >
        Loading interior...
      </div>
    );
  }

  return (
    <div
      className="game-container"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
    >
      {/* Game Header with Time Display */}
      <div
        className="overworld-header"
        style={{
          backgroundColor: 'var(--panel-bg)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.25rem' }}>hexcrawler</h2>

          {/* Dev Tools */}
          <DevTools terrainGeneratorRef={terrainGeneratorRef} />
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            alignItems: 'center',
            color: 'var(--text-color)',
          }}
        >
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: '500',
              fontFamily: 'monospace',
              padding: '0.25rem 0.75rem',
              backgroundColor: 'var(--control-bg)',
              borderRadius: '4px',
            }}
          >
            {formatTime(state.gameTime)}
          </div>
          {FEATURES.SURVIVAL_ENABLED && (
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: '500',
                padding: '0.25rem 0.75rem',
                backgroundColor: 'var(--control-bg)',
                borderRadius: '4px',
                color: state.playerCharacter?.rations <= 2 ? '#e74c3c' : 'var(--text-color)',
              }}
            >
              Rations: {state.playerCharacter?.rations || 0}
            </div>
          )}
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: '500',
              padding: '0.25rem 0.75rem',
              backgroundColor: 'var(--control-bg)',
              borderRadius: '4px',
              color: '#f39c12',
            }}
          >
            Gold: {state.playerCharacter?.gold || 0}
          </div>
          {/* Forage Status Indicator */}
          {FEATURES.SURVIVAL_ENABLED && (
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: '500',
                color: forageStatus.ready ? '#2ecc71' : '#e74c3c',
                cursor: 'default',
                userSelect: 'none',
              }}
              title={forageStatus.message}
            >
              Forage
            </div>
          )}
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Position: ({state.playerPosition?.col ?? '?'}, {state.playerPosition?.row ?? '?'})
          </div>
        </div>
      </div>

      <div className="container" style={{ display: 'flex', flex: 1, gap: '1rem', padding: '1rem' }}>
        {/* Left Sidebar - Menu */}
        <div style={{ width: '280px', flexShrink: 0 }}>
          <MenuSidebar
            items={menuItems}
            onItemClick={handleMenuItemClick}
            selectedItem={menuItems.find(item => item.id === openPanel)}
          />
        </div>

        {/* Canvas Container */}
        <main
          className="canvas-container"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          {state.combatState?.battlefield ? (
            /* Combat Mode - Show battlefield fullscreen */
            <CombatCanvas
              battlefield={
                state.combatState.battlefield as unknown as Parameters<
                  typeof CombatCanvas
                >[0]['battlefield']
              }
              combatants={
                state.combatState.turnOrder as unknown as Parameters<
                  typeof CombatCanvas
                >[0]['combatants']
              }
              currentTurnIndex={state.combatState.currentTurnIndex}
              selectedAction={combatUIState.selectedAction ?? undefined}
              hoveredHex={combatUIState.hoveredHex}
              movementRemaining={state.combatState.movementRemaining}
              onHexClick={handleCombatHexClick}
              onHexHover={hex => setCombatUIState(prev => ({ ...prev, hoveredHex: hex }))}
              cameraOffset={combatUIState.cameraOffset}
              cameraZoom={combatUIState.cameraZoom}
              onCameraChange={(offset, zoom) =>
                setCombatUIState(prev => ({ ...prev, cameraOffset: offset, cameraZoom: zoom }))
              }
              pendingAnimation={
                (state.combatState.pendingAnimation ?? null) as unknown as Parameters<
                  typeof CombatCanvas
                >[0]['pendingAnimation']
              }
              onAnimationComplete={() => {
                // Clear the animation marker from state
                dispatch({ type: actions.CLEAR_COMBAT_ANIMATION });

                // If an AI move triggered this animation, advance the combat turn now
                if (pendingAIAdvanceRef.current) {
                  pendingAIAdvanceRef.current = false;
                  clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
                  aiTimeoutRefs.current.turnTimeout = null;
                  logger.combat.info('Advancing turn after AI movement animation completed');
                  dispatch({ type: actions.ADVANCE_COMBAT_TURN });
                }
              }}
            />
          ) : state.inInterior && interiorMap ? (
            /* Interior Mode */
            <InteriorHexCanvas
              interiorMap={
                interiorMap as unknown as Parameters<typeof InteriorHexCanvas>[0]['interiorMap']
              }
              playerPosition={state.interiorPlayerPosition}
              playerIcon={CLASS_ICONS[state.party?.player?.class ?? ''] ?? '🧍'}
              selectedHex={selectedInteriorHex}
              onHexClick={handleInteriorHexClick}
              onHexDoubleClick={handleInteriorHexDoubleClick}
            />
          ) : state.mapData && state.mapData.length > 0 ? (
            /* Overworld Mode */
            <HexGridCanvas
              hexes={state.mapData as unknown as Parameters<typeof HexGridCanvas>[0]['hexes']}
              onHexClick={handleHexClick}
              onHexDoubleClick={handleHexDoubleClick}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-color)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <h2>Generating Map...</h2>
                <p style={{ color: 'var(--text-muted)' }}>Seed: {state.mapSeed || 'Not set'}</p>
              </div>
            </div>
          )}
        </main>

        {/* Right Panel - Combat Actions, Hex Info, or Interior Info */}
        <aside
          style={{
            width: '280px',
            flexShrink: 0,
            backgroundColor: 'var(--bg-color)',
            borderRadius: '8px',
            padding: '0.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {state.combatState?.battlefield ? (
            /* Combat Actions Panel */
            <>
              {getCurrentCombatant()?.isAlly ? (
                <>
                  <ActionPanel
                    combatant={
                      getCurrentCombatant() as unknown as Parameters<typeof ActionPanel>[0]['combatant']
                    }
                    selectedAction={combatUIState.selectedAction ?? undefined}
                    movementRemaining={state.combatState.movementRemaining}
                    attacksUsedThisTurn={combatUIState.attacksUsedThisTurn}
                    turnState={state.combatState.turnState}
                    onActionSelect={action =>
                      setCombatUIState(prev => ({ ...prev, selectedAction: action }))
                    }
                    onAbilityClick={() => setShowAbilityMenu(true)}
                    onFreeAbilityClick={ability => {
                      const currentCombatant = getCurrentCombatant();
                      if (!currentCombatant) return;
                      dispatch({
                        type: actions.PROCESS_COMBAT_ACTION,
                        payload: {
                          actionType: 'ability',
                          attacker: currentCombatant,
                          target: currentCombatant,
                          ability,
                        },
                      });
                    }}
                    onBonusActionClick={ability => {
                      const currentCombatant = getCurrentCombatant();
                      const character = currentCombatant?.character;
                      if (!currentCombatant || !character) return;
                      dispatch({
                        type: actions.PROCESS_COMBAT_ACTION,
                        payload: {
                          actionType: 'ability',
                          attacker: currentCombatant,
                          target: currentCombatant,
                          ability,
                        },
                      });
                      addMessage(`${character.name} uses ${ability.name}!`, 'action');
                    }}
                    onSpellClick={() => addMessage('Spells not yet implemented', 'info')}
                    onDodgeClick={() => {
                      const currentCombatant = getCurrentCombatant();
                      if (!currentCombatant) return;
                      dispatch({
                        type: actions.PROCESS_COMBAT_ACTION,
                        payload: {
                          actionType: 'dodge',
                          attacker: currentCombatant,
                          target: currentCombatant,
                        },
                      });
                    }}
                    onDashClick={() => addMessage('Dash not yet implemented', 'info')}
                    onDisengageClick={() => addMessage('Disengage not yet implemented', 'info')}
                    onHideClick={() => addMessage('Hide not yet implemented', 'info')}
                    onEndTurn={handleCombatEndTurn}
                  />

                  {/* Ability Menu modal — rendered as a portal-like overlay */}
                  {showAbilityMenu && getCurrentCombatant()?.character && (
                    <AbilityMenu
                      character={getCurrentCombatant()?.character}
                      combatant={
                        getCurrentCombatant() as unknown as Parameters<typeof AbilityMenu>[0]['combatant']
                      }
                      onSelect={ability => {
                        const currentCombatant = getCurrentCombatant();
                        const character = currentCombatant?.character;
                        setShowAbilityMenu(false);
                        dispatch({
                          type: actions.PROCESS_COMBAT_ACTION,
                          payload: {
                            actionType: 'ability',
                            attacker: currentCombatant,
                            target: currentCombatant,
                            ability,
                          },
                        });
                        addMessage(`${character?.name} uses ${ability.name}!`, 'action');
                      }}
                      onClose={() => setShowAbilityMenu(false)}
                    />
                  )}
                </>
              ) : getCurrentCombatant()?.isEnemy ? (
                <div
                  style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-lighter)',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px',
                  }}
                >
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b', fontSize: '1.2rem' }}>
                    {getCurrentCombatant()?.name}&apos;s Turn
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Enemy is taking their turn...
                  </p>
                </div>
              ) : null}

              {/* Turn Order Display */}
              <TurnOrderDisplay
                turnOrder={state.combatState.turnOrder}
                currentTurnIndex={state.combatState.currentTurnIndex}
              />
            </>
          ) : state.inInterior && interiorMap ? (
            /* Interior Info */
            <InteriorInfoPane
              selectedHex={
                selectedInteriorHex as unknown as Parameters<typeof InteriorInfoPane>[0]['selectedHex']
              }
              playerPosition={state.interiorPlayerPosition}
              interiorMap={
                interiorMap as unknown as Parameters<typeof InteriorInfoPane>[0]['interiorMap']
              }
            />
          ) : (
            /* Hex Details */
            <HexDetails
              hex={selectedHex as unknown as Parameters<typeof HexDetails>[0]['hex']}
              terrainGenerator={terrainGeneratorRef.current}
              onMoveClick={handleMoveToHex as unknown as Parameters<typeof HexDetails>[0]['onMoveClick']}
            />
          )}
        </aside>
      </div>

      {/* Popup Panels */}
      <MenuPanel
        title="Character"
        isOpen={openPanel === 'character'}
        onClose={handleClosePanel}
        width="600px"
      >
        <CharacterStats character={state.playerCharacter} />
      </MenuPanel>

      <MenuPanel
        title="Party"
        isOpen={openPanel === 'party'}
        onClose={handleClosePanel}
        width="700px"
      >
        <PartyList
          party={state.party}
          onMemberSelect={
            handlePartyMemberSelect as unknown as Parameters<typeof PartyList>[0]['onMemberSelect']
          }
        />
      </MenuPanel>

      <MenuPanel
        title="Equipment"
        isOpen={openPanel === 'equipment'}
        onClose={handleClosePanel}
        width="1050px"
      >
        <Equipment character={selectedCharacter} />
      </MenuPanel>

      <MenuPanel
        title="Rest"
        isOpen={openPanel === 'rest'}
        onClose={handleClosePanel}
        width="600px"
      >
        <RestMenu />
      </MenuPanel>

      {FEATURES.SURVIVAL_ENABLED && (
        <MenuPanel
          title="Survival"
          isOpen={openPanel === 'survival'}
          onClose={handleClosePanel}
          width="600px"
        >
          <SurvivalMenu />
        </MenuPanel>
      )}

      <MenuPanel
        title="Quests"
        isOpen={openPanel === 'quests'}
        onClose={handleClosePanel}
        width="900px"
      >
        <QuestLog />
      </MenuPanel>

      <MenuPanel
        title="Settings"
        isOpen={openPanel === 'config'}
        onClose={handleClosePanel}
        width="600px"
      >
        <Settings />
      </MenuPanel>

      {/* Game Log - Always shown at bottom with fixed height */}
      <div
        className="game-log-container"
        style={{
          display: 'flex',
          position: 'relative',
          height: '150px',
          flexShrink: 0,
        }}
      >
        <GameLog />
      </div>

      {/* Save Menu Modal */}
      {showSaveMenu && (
        <div className="modal-overlay" onClick={() => setShowSaveMenu(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <SaveSlotManager mode="save" onClose={() => setShowSaveMenu(false)} />
          </div>
        </div>
      )}

      {/* AI Inspector (dev mode only) */}
      {showAIInspector && (
        <AIInspector
          combatState={
            state.combatState as unknown as Parameters<typeof AIInspector>[0]['combatState']
          }
        />
      )}
    </div>
  );
}

export default OverworldScene;
