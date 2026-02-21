// @ts-nocheck
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
import { TIME_COSTS, formatTime, getCombatDuration, getTimeOfDay } from '../../game/TimeManager';
import { DiceRoller } from '../../game/DiceRoller';
import {
  generateHexEntryFlavor,
  generateTimeTransitionFlavor,
  generateWeatherFlavor,
  generatePOIFlavor,
  generateCombatIntro,
} from '../../utils/flavorTextGenerator';
import { Combat } from '../../game/Combat';
import { Enemy } from '../../game/Enemy';
import { Character } from '../../game/Character';
import { Party } from '../../game/Party';
import { findPath } from '../../game/Pathfinding';
import { getHexDistance } from '../../utils/hexMath';
import SurvivalManager from '../../game/SurvivalManager';
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
import MenuSidebar from '../ui/MenuSidebar';
import MenuPanel from '../ui/MenuPanel';
import { SaveManager } from '../../utils/SaveManager';
import { AIEngine } from '../../game/ai/AIEngine';
import AIInspector from '../debug/AIInspector';

function OverworldScene() {
  const { state, dispatch, actions, isHexReachable, isPoiDiscovered, getHexDistance } =
    useGameState();
  const { settings } = useSettings();
  const { addMessage } = useGameLog();
  // const { showMessage, showEvent, dismissEvent, isBlockingMovement } = useEventInfoBox();
  const isBlockingMovement = false;
  const [openPanel, setOpenPanel] = useState(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(state.playerCharacter);
  const [selectedHex, setSelectedHex] = useState(null);
  const [selectedInteriorHex, setSelectedInteriorHex] = useState(null);
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // AI Inspector toggle (via URL param)
  const [showAIInspector] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('aiInspector') === 'true';
  });

  // Combat UI state
  const [combatUIState, setCombatUIState] = useState({
    selectedAction: null,
    selectedTarget: null,
    hoveredHex: null,
    cameraOffset: { x: 50, y: 50 },
    cameraZoom: 1.0, // Locked at 1.0 - zoom disabled in combat
    attacksUsedThisTurn: 0,
  });

  const terrainGeneratorRef = useRef(null);

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

  const handlePartyMemberSelect = (member, index) => {
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
        badge: state.party?.npcs?.filter(npc => npc).length || 0,
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
      {
        id: 'survival',
        label: 'Survival',
        icon: '🌲',
        description: 'Forage and hunt',
      },
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
  }, [state.party?.npcs, state.activeQuests?.length]);

  const handleMenuItemClick = item => {
    // If survival is clicked, trigger foraging directly instead of opening panel
    if (item.id === 'survival') {
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

  const handleHexClick = hex => {
    setSelectedHex(hex);
  };

  const handleHexDoubleClick = hex => {
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

  const handleMoveToHex = hex => {
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

    // Consume rations for travel
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
      terrain: hex.terrain.name,
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
          const poiFlavor = generatePOIFlavor(hex.poi.type, hex.poi.cr || 1);
          if (poiFlavor) {
            discoveryMsg += ` - ${poiFlavor}`;
          }
        }

        addMessage(discoveryMsg, 'discovery');

        // Trigger event based on type
        if (hex.poi.eventType === 'active') {
          // Combat intro
          const combatIntro = generateCombatIntro(hex.poi.type);
          addMessage(combatIntro, 'encounter');

          // Trigger combat encounter directly
          handleEngageCombat(hex.poi);
        }
      } else if (hex.poi.eventType === 'active') {
        // Already discovered active event - trigger combat again
        const combatIntro = generateCombatIntro(hex.poi.type);
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
  const buildHexEntryMessage = (hex, oldTimeOfDay, newTimeOfDay) => {
    const parts = [];
    let messageType = 'info';

    // Time transition (highest priority)
    if (oldTimeOfDay !== newTimeOfDay) {
      const timeFlavor = generateTimeTransitionFlavor(newTimeOfDay);
      if (timeFlavor) parts.push(timeFlavor);
    }

    // Weather warning (changes message type to 'warning')
    if (hex.weather) {
      const weatherFlavor = generateWeatherFlavor(hex.weather.condition);
      if (weatherFlavor) {
        parts.push(weatherFlavor);
        messageType = 'warning'; // Weather is important, use warning type
      }
    }

    // Hex entry flavor (15% chance)
    if (Math.random() < 0.15) {
      const flavor = generateHexEntryFlavor(hex.terrain.key);
      if (flavor) parts.push(flavor);
    }

    if (parts.length === 0) return null;

    return {
      message: parts.join(' - '), // Hyphen separator
      type: messageType,
    };
  };

  // Get adjacent hexes (6 neighbors in hex grid) - Uses HexGrid spatial index for O(1) lookup
  const getAdjacentHexes = (col, row) => {
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

    const adjacent = [];
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

  // DEV ONLY: Force combat for rapid testing
  const handleForceCombat = async () => {
    addMessage('[DEV] Starting test combat...', 'system');

    // Get party members
    const allies = state.party.getAllMembers().filter(m => m);

    if (allies.length === 0) {
      addMessage('[DEV] No party members found!', 'error');
      return;
    }

    // Create test enemies (3 goblins CR 1)
    const diceRoller = new DiceRoller();
    const enemies = [
      new Enemy('Goblin Warrior', 0.25, 'goblinoid'),
      new Enemy('Goblin Archer', 0.25, 'goblinoid'),
      new Enemy('Goblin Warrior', 0.25, 'goblinoid'),
    ];

    // Get terrain type from current hex
    const currentHex = state.mapData.find(
      h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
    );
    const terrainType = currentHex?.terrain?.name || 'plains';

    logger.combat.info('DEV Force Combat', {
      allies: allies.map(a => a.name),
      enemies: enemies.map(e => e.name),
      terrainType,
    });

    // Pre-load AI for enemies before combat starts
    logger.combat.info('Pre-loading AI for enemies');
    const aiLoadPromises = enemies.map(async enemy => {
      try {
        enemy.aiConfig = await AIEngine.loadAI(enemy.family, enemy.variant);
        logger.combat.info('AI loaded for enemy', {
          name: enemy.name,
          family: enemy.family,
        });
      } catch (error) {
        logger.combat.error('Failed to load AI', {
          name: enemy.name,
          error: error.message,
        });
        enemy.aiConfig = AIEngine.getFallbackAI();
      }
    });

    await Promise.all(aiLoadPromises);
    logger.combat.info('All enemy AI loaded');

    // Dispatch START_COMBAT
    dispatch({
      type: actions.START_COMBAT,
      payload: {
        allies,
        enemies,
        encounterName: 'Test Combat (DEV)',
        encounterType: 'standard',
        terrainType,
        gameLogger: addMessage,
      },
    });
  };

  // Handle engaging in combat with a POI
  const handleEngageCombat = async poi => {
    addMessage(`You engage ${poi.name} in combat!`, 'encounter');

    // Get party members
    const allies = state.party.getAllMembers().filter(m => m);

    // Parse enemies from POI
    const diceRoller = new DiceRoller();
    const enemies = Enemy.parseCreatureString(poi.creatures, poi.cr, diceRoller);

    // Determine encounter type based on POI or terrain
    let encounterType = 'standard';
    if (poi.eventType === 'ambush') encounterType = 'ambush';
    if (poi.cr >= 5) encounterType = 'boss';

    // Get terrain type from current hex
    const currentHex = state.mapData.find(
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
        logger.combat.error('AI load failed', { name: enemy.name, error: error.message });
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

  // Handle event choice (combat, flee, etc.)
  const handleEventChoice = (action, poi) => {
    if (action === 'fight') {
      handleEngageCombat(poi);
    } else if (action === 'continue') {
      // Continue after combat results (if still using event system)
      // dismissEvent();
    } else if (action === 'gameover') {
      // Transition to game over screen
      // dismissEvent();
      dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'gameover' });
    }
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
  const { handleInteract, handleSearch, handleExplore, handleEnterTown } =
    useHexInteraction(currentHex);

  // Helper function to get hex in a direction
  const getHexInDirection = direction => {
    if (!state.mapData) return null;

    const { col, row } = state.playerPosition;
    let targetCol = col;
    let targetRow = row;

    // Hex grid movement offsets (offset coordinates)
    const isEvenRow = row % 2 === 0;

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
      logger.storage.error('Quick save error:', { error, message: error.message });
      addMessage('Quick save failed: ' + error.message, 'error');
    }
  };

  // Unified keyboard control callbacks (works for both overworld and interior)
  const keyboardCallbacks = {
    onMoveUp: () => {
      if (state.inInterior) {
        const targetHex = getInteriorHexInDirection('up');
        if (targetHex && targetHex.terrain.walkable) {
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
        if (targetHex && targetHex.terrain.walkable) {
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
        if (targetHex && targetHex.terrain.walkable) {
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
        if (targetHex && targetHex.terrain.walkable) {
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
          state.interiorPlayerPosition?.col,
          state.interiorPlayerPosition?.row
        );

        if (currentHex && currentHex.terrain.isInteractive && currentHex.buildingType) {
          handleBuildingInteraction(currentHex);
        } else if (
          currentHex &&
          (currentHex.content === 'entrance' || currentHex.terrain.key === 'gate')
        ) {
          // Player is on entrance/gate - exit the interior
          // Check if current POI is a settlement (town, camp, village, etc.)
          const settlementTypes = ['camp', 'village', 'town', 'city', 'metropolis'];
          const isSettlement = settlementTypes.includes(state.currentPOI?.poi?.type);

          if (isSettlement) {
            dispatch({ type: actions.EXIT_TOWN });
          } else {
            dispatch({ type: actions.EXIT_EXPLORATION });
          }
        } else if (state.inInterior) {
          // Player is inside but not on exit - provide helpful message
          addMessage('You must stand on the exit to leave this location', 'warning');
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
  const getInteriorHexAt = (col, row) => {
    if (!interiorMap) return null;
    return interiorMap.hexes.find(h => h.col === col && h.row === row);
  };

  // Helper to get interior hex in direction
  const getInteriorHexInDirection = direction => {
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
  const handleInteriorHexClick = hex => {
    setSelectedInteriorHex(hex);
  };

  const handleInteriorHexDoubleClick = hex => {
    logger.movement.debug('Interior hex double click', {
      hex,
      playerPosition: state.interiorPlayerPosition,
    });

    if (!hex.terrain.walkable) {
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
    if (hex.terrain.isInteractive && hex.buildingType) {
      handleBuildingInteraction(hex);
    }

    // Check for town gate exit
    if (hex.terrain.key === 'gate') {
      if (state.currentPOI?.poi.type === 'town') {
        dispatch({ type: actions.EXIT_TOWN });
      }
    }
  };

  // Handle building interactions in towns
  const handleBuildingInteraction = hex => {
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

  // Get interior map if in interior
  const interiorMap =
    state.inInterior && state.currentPOI
      ? state.interiorMaps[`${state.currentPOI.col},${state.currentPOI.row}`]
      : null;

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

  const forageStatus = getForageStatus();

  // Check for victory/defeat in combat
  const combatEndHandledRef = useRef(false);
  const combatStartRoundRef = useRef(null);

  useEffect(() => {
    if (!state.combatState) {
      combatEndHandledRef.current = false;
      combatStartRoundRef.current = null;
      return;
    }

    // Don't check on the very first round/turn (combat just started)
    if (combatStartRoundRef.current === null) {
      combatStartRoundRef.current = state.combatState.round;
      console.log('[Combat] Combat started, skipping initial victory check');
      return;
    }

    // Already handled combat end
    if (combatEndHandledRef.current) return;

    const livingAllies = state.combatState.turnOrder.filter(c => c.isAlly && c.currentHP > 0);
    const livingEnemies = state.combatState.turnOrder.filter(c => c.isEnemy && c.currentHP > 0);

    console.log('[Combat] Victory check:', {
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
      addMessage('Victory! All enemies defeated!', 'success');
      setTimeout(() => {
        dispatch({ type: actions.END_COMBAT, payload: { victory: true } });
      }, 2000);
    } else if (livingAllies.length === 0) {
      combatEndHandledRef.current = true;
      addMessage('Defeat! All party members have fallen...', 'error');
      setTimeout(() => {
        dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'gameover' });
      }, 2000);
    }
  }, [
    state.combatState?.currentTurnIndex,
    state.combatState?.round,
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
      const roll = combatant.initiative - dexMod - itemBonus;

      let modStr = `${dexMod >= 0 ? '+' : ''}${dexMod}`;
      if (itemBonus !== 0) {
        modStr += ` item+${itemBonus}`;
      }
      const logMessage = `${combatant.name}: ${combatant.initiative} (rolled ${roll}${modStr})`;

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

  // Process AI turn
  const processAITurn = useCallback(
    combatant => {
      if (!combatant || !combatant.enemy) {
        logger.combat.error('Invalid combatant for AI turn', { combatant });
        return;
      }

      // Read battlefield from the ref so we always have the current value
      // without requiring state.combatState as a useCallback dependency.
      const currentCombatState = combatStateRef.current;
      if (!currentCombatState || !currentCombatState.battlefield) {
        logger.combat.error('Combat state invalid');
        return;
      }

      const enemy = combatant.enemy;
      addMessage(`${enemy.name} is thinking...`, 'encounter');

      logger.combat.info('Processing AI turn', { name: enemy.name });

      // Timeout fallback: Force advance turn after 5 seconds
      aiTimeoutRefs.current.turnTimeout = setTimeout(() => {
        logger.combat.warn('AI turn timeout - forcing advance', {
          combatant: enemy.name,
        });
        clearTimeout(aiTimeoutRefs.current.action);
        clearTimeout(aiTimeoutRefs.current.advance);
        addMessage(`${enemy.name}'s turn timed out`, 'warning');
        dispatch({ type: actions.ADVANCE_COMBAT_TURN });
      }, 5000);

      try {
        // Use AIEngine to decide action — read from ref for fresh state
        const action = AIEngine.decideAction(
          combatant,
          currentCombatState.battlefield,
          currentCombatState.turnOrder,
          currentCombatState.movementRemaining
        );

        logger.combat.debug('AI action decided', { action });

        // Wait 800ms for player to see AI thinking
        aiTimeoutRefs.current.action = setTimeout(() => {
          // Read current state from ref — avoids stale closure
          if (!combatStateRef.current) {
            logger.combat.warn('Combat ended during AI turn');
            clearTimeout(aiTimeoutRefs.current.turnTimeout);
            return;
          }

          if (action.type === 'move') {
            addMessage(
              `${enemy.name} moves to (${action.destination.col}, ${action.destination.row})`,
              'encounter'
            );

            if (actions.PROCESS_COMBAT_MOVEMENT) {
              // Mark that we need to advance the turn after the movement animation completes.
              // The onAnimationComplete callback (below) will fire ADVANCE_COMBAT_TURN once
              // the canvas finishes animating the combatant hex-by-hex.
              pendingAIAdvanceRef.current = true;

              dispatch({
                type: actions.PROCESS_COMBAT_MOVEMENT,
                payload: {
                  path: action.path,
                  cost: action.moveCost * 5, // Convert hexes to feet
                },
              });

              // Skip the normal 500ms advance timer for move actions – animation drives it.
              // Clear the fallback turnTimeout: onAnimationComplete handles clean advance.
              // (The overall 5s safety timeout in aiTimeoutRefs.turnTimeout still guards against hangs.)
            }
          } else if (action.type === 'attack') {
            const targetName = action.target.character?.name || action.target.enemy?.name;
            addMessage(`${enemy.name} attacks ${targetName}!`, 'encounter');

            if (actions.PROCESS_COMBAT_ACTION) {
              dispatch({
                type: actions.PROCESS_COMBAT_ACTION,
                payload: {
                  actionType: 'attack',
                  target: action.target,
                  attacker: combatant,
                },
              });
            }
          } else if (action.type === 'ability') {
            const targetName = action.target?.character?.name || action.target?.enemy?.name;
            addMessage(
              `${enemy.name} uses ${action.ability}${targetName ? ` on ${targetName}` : ''}!`,
              'encounter'
            );

            if (actions.PROCESS_COMBAT_ACTION) {
              dispatch({
                type: actions.PROCESS_COMBAT_ACTION,
                payload: {
                  actionType: 'ability',
                  abilityName: action.ability,
                  target: action.target,
                  attacker: combatant,
                },
              });
            }
          } else if (action.type === 'wait') {
            addMessage(`${enemy.name} waits`, 'encounter');
          }

          // For move actions the turn advance is driven by onAnimationComplete (see below).
          // For all other actions (attack, ability, wait) use the normal 500ms timer.
          if (!pendingAIAdvanceRef.current) {
            aiTimeoutRefs.current.advance = setTimeout(() => {
              // Read from ref — avoids stale closure
              if (!combatStateRef.current) {
                clearTimeout(aiTimeoutRefs.current.turnTimeout);
                return;
              }

              // Clear timeout fallback
              clearTimeout(aiTimeoutRefs.current.turnTimeout);

              logger.combat.info('Advancing turn after AI action', { combatant: enemy.name });
              dispatch({ type: actions.ADVANCE_COMBAT_TURN });
            }, 500);
          }
        }, 800);
      } catch (error) {
        logger.combat.error('AI turn processing failed', {
          combatant: enemy.name,
          error: error.message,
        });

        // Clear timeouts on error
        clearTimeout(aiTimeoutRefs.current.turnTimeout);
        clearTimeout(aiTimeoutRefs.current.action);
        clearTimeout(aiTimeoutRefs.current.advance);

        // Advance turn even on error
        addMessage(`${enemy.name} failed to act`, 'error');
        dispatch({ type: actions.ADVANCE_COMBAT_TURN });
      }
    },
    // Remove state.combatState from deps — we read it via combatStateRef to avoid
    // the useCallback recreating on every action dispatch, which would trigger the
    // useEffect cleanup and cancel in-flight action/advance timers mid-turn.
    [dispatch, actions, addMessage]
  );

  // Auto-process AI turns
  const lastProcessedTurnRef = useRef(null);
  const aiTimeoutRefs = useRef({ action: null, advance: null, turnTimeout: null });
  // Set to true when an AI movement animation is playing and we need to advance
  // the turn once the animation finishes (instead of using the fixed 500ms timer)
  const pendingAIAdvanceRef = useRef(false);

  useEffect(() => {
    if (!state.combatState) {
      // Cleanup timeouts if combat ended
      if (aiTimeoutRefs.current.turnTimeout) {
        clearTimeout(aiTimeoutRefs.current.turnTimeout);
        aiTimeoutRefs.current.turnTimeout = null;
      }
      if (aiTimeoutRefs.current.action) {
        clearTimeout(aiTimeoutRefs.current.action);
        aiTimeoutRefs.current.action = null;
      }
      if (aiTimeoutRefs.current.advance) {
        clearTimeout(aiTimeoutRefs.current.advance);
        aiTimeoutRefs.current.advance = null;
      }
      return;
    }

    const currentTurnIndex = state.combatState.currentTurnIndex;
    const waitingForPlayer = state.combatState.waitingForPlayerAction;

    // Skip if already processed this turn
    if (lastProcessedTurnRef.current === currentTurnIndex) {
      return;
    }

    const currentCombatant = state.combatState.turnOrder[currentTurnIndex];
    if (!currentCombatant) return;

    console.log('[AI] Turn check:', {
      combatant: currentCombatant.name,
      isAlly: currentCombatant.isAlly,
      isEnemy: currentCombatant.isEnemy,
      waitingForPlayer,
      currentTurnIndex,
    });

    // Only process AI turns (enemies)
    if (currentCombatant.isEnemy && !waitingForPlayer) {
      lastProcessedTurnRef.current = currentTurnIndex;
      processAITurn(currentCombatant);
    }

    // Cleanup: only cancel timers when the turn index itself changes (new combatant's
    // turn started) — NOT on every state update. This prevents mid-turn state changes
    // (e.g. HP update from PROCESS_COMBAT_ACTION) from cancelling the advance timer.
    return () => {
      clearTimeout(aiTimeoutRefs.current.turnTimeout);
      aiTimeoutRefs.current.turnTimeout = null;
      clearTimeout(aiTimeoutRefs.current.action);
      aiTimeoutRefs.current.action = null;
      clearTimeout(aiTimeoutRefs.current.advance);
      aiTimeoutRefs.current.advance = null;
    };
  }, [
    // Only re-run (and clean up) when the turn changes, not on every state update.
    state.combatState?.currentTurnIndex,
    state.combatState?.waitingForPlayerAction,
    processAITurn,
  ]);

  // Combat handlers
  const handleCombatHexClick = useCallback(
    hex => {
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
        c => c.position.col === hex.col && c.position.row === hex.row
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
          currentCombatant.position,
          hex,
          state.combatState.battlefield,
          state.combatState.turnOrder
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
          currentCombatant.position.col,
          currentCombatant.position.row,
          targetCombatant.position.col,
          targetCombatant.position.row
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

          {/* Dev Tools Dropdown */}
          {import.meta.env.DEV && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setOpenPanel(openPanel === 'dev-tools' ? null : 'dev-tools');
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.85rem',
                  backgroundColor:
                    openPanel === 'dev-tools' ? 'var(--primary-color)' : 'var(--accent-color)',
                  color: 'var(--bg-color)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'background-color 0.2s',
                }}
              >
                🛠️ Dev Tools
              </button>

              {openPanel === 'dev-tools' && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '0.25rem',
                    backgroundColor: 'var(--panel-bg)',
                    border: '2px solid var(--border-color)',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    minWidth: '200px',
                    zIndex: 1000,
                  }}
                >
                  <button
                    onClick={() => {
                      handleForceCombat();
                      setOpenPanel(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      fontSize: '0.9rem',
                      backgroundColor: 'transparent',
                      color: 'var(--text-color)',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-lighter)')
                    }
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>⚔️</span>
                    <span>Force Combat</span>
                  </button>

                  {/* Placeholder for future dev tools */}
                  <div
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    More dev tools coming soon...
                  </div>
                </div>
              )}
            </div>
          )}
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
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Position: ({state.playerPosition.col}, {state.playerPosition.row})
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
              battlefield={state.combatState.battlefield}
              combatants={state.combatState.turnOrder}
              currentTurnIndex={state.combatState.currentTurnIndex}
              selectedAction={combatUIState.selectedAction}
              hoveredHex={combatUIState.hoveredHex}
              movementRemaining={state.combatState.movementRemaining}
              onHexClick={handleCombatHexClick}
              onHexHover={hex => setCombatUIState(prev => ({ ...prev, hoveredHex: hex }))}
              cameraOffset={combatUIState.cameraOffset}
              cameraZoom={combatUIState.cameraZoom}
              onCameraChange={(offset, zoom) =>
                setCombatUIState(prev => ({ ...prev, cameraOffset: offset, cameraZoom: zoom }))
              }
              pendingAnimation={state.combatState.pendingAnimation ?? null}
              onAnimationComplete={() => {
                // Clear the animation marker from state
                dispatch({ type: actions.CLEAR_COMBAT_ANIMATION });

                // If an AI move triggered this animation, advance the combat turn now
                if (pendingAIAdvanceRef.current) {
                  pendingAIAdvanceRef.current = false;
                  clearTimeout(aiTimeoutRefs.current.turnTimeout);
                  aiTimeoutRefs.current.turnTimeout = null;
                  logger.combat.info('Advancing turn after AI movement animation completed');
                  dispatch({ type: actions.ADVANCE_COMBAT_TURN });
                }
              }}
            />
          ) : state.inInterior && interiorMap ? (
            /* Interior Mode */
            <InteriorHexCanvas
              interiorMap={interiorMap}
              playerPosition={state.interiorPlayerPosition}
              selectedHex={selectedInteriorHex}
              onHexClick={handleInteriorHexClick}
              onHexDoubleClick={handleInteriorHexDoubleClick}
            />
          ) : state.mapData && state.mapData.length > 0 ? (
            /* Overworld Mode */
            <HexGridCanvas
              hexes={state.mapData}
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
              {getCurrentCombatant() && getCurrentCombatant().isAlly ? (
                <ActionPanel
                  combatant={getCurrentCombatant()}
                  selectedAction={combatUIState.selectedAction}
                  movementRemaining={state.combatState.movementRemaining}
                  attacksUsedThisTurn={combatUIState.attacksUsedThisTurn}
                  onActionSelect={action =>
                    setCombatUIState(prev => ({ ...prev, selectedAction: action }))
                  }
                  onAbilityClick={() => addMessage('Abilities not yet implemented', 'info')}
                  onSpellClick={() => addMessage('Spells not yet implemented', 'info')}
                  onDodgeClick={() => addMessage('Dodge not yet implemented', 'info')}
                  onDashClick={() => addMessage('Dash not yet implemented', 'info')}
                  onEndTurn={handleCombatEndTurn}
                />
              ) : getCurrentCombatant() && getCurrentCombatant().isEnemy ? (
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
                    {getCurrentCombatant().name}'s Turn
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
              selectedHex={selectedInteriorHex}
              playerPosition={state.interiorPlayerPosition}
              interiorMap={interiorMap}
            />
          ) : (
            /* Hex Details */
            <HexDetails
              hex={selectedHex}
              terrainGenerator={terrainGeneratorRef.current}
              onMoveClick={handleMoveToHex}
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
        <PartyList party={state.party} onMemberSelect={handlePartyMemberSelect} />
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

      <MenuPanel
        title="Survival"
        isOpen={openPanel === 'survival'}
        onClose={handleClosePanel}
        width="600px"
      >
        <SurvivalMenu />
      </MenuPanel>

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
      {showAIInspector && <AIInspector combatState={state.combatState} />}
    </div>
  );
}

export default OverworldScene;
