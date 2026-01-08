import { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useGameLog } from '../../contexts/GameLogContext';
// import { useEventInfoBox } from '../../contexts/EventInfoBoxContext';
import { useMapGeneration } from '../../hooks/useMapGeneration';
import { useInfiniteTerrainExpansion } from '../../hooks/useInfiniteTerrainExpansion';
import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import { useHexInteraction } from '../../hooks/useHexInteraction';
import { TerrainGenerator } from '../../terrainGenerator.js';
import { TIME_COSTS, formatTime, getCombatDuration } from '../../game/TimeManager.js';
import { DiceRoller } from '../../game/DiceRoller.js';
import { Combat } from '../../game/Combat.js';
import { Enemy } from '../../game/Enemy.js';
import { Character } from '../../game/Character.js';
import { Party } from '../../game/Party.js';
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
import HexGridCanvas from '../canvas/HexGridCanvas';
import InteriorHexCanvas from '../canvas/InteriorHexCanvas';
import MenuSidebar from '../ui/MenuSidebar';
import MenuPanel from '../ui/MenuPanel';

function OverworldScene() {
  const { state, dispatch, actions, isHexReachable, isPoiDiscovered, getHexDistance } = useGameState();
  const { settings } = useSettings();
  const { addMessage } = useGameLog();
  // const { showMessage, showEvent, dismissEvent, isBlockingMovement } = useEventInfoBox();
  const isBlockingMovement = false;
  const [openPanel, setOpenPanel] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(state.playerCharacter);
  const [selectedHex, setSelectedHex] = useState(null);
  const [selectedInteriorHex, setSelectedInteriorHex] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });

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

  // Define menu items
  const menuItems = [
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
      badge: state.party?.npcs?.filter(npc => npc).length || 0
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
      badge: state.activeQuests?.length || 0
    },
    {
      id: 'config',
      label: 'Config',
      icon: '⚙️',
      description: 'Game settings',
    }
  ];

  const handleMenuItemClick = (item) => {
    // If survival is clicked, trigger foraging directly instead of opening panel
    if (item.id === 'survival') {
      if (!state.inInterior) {
        handleForage();
      } else {
        addMessage('Cannot forage indoors.', 'warning');
      }
      return;
    }
    setOpenPanel(item.id);
  };

  const handleClosePanel = () => {
    setOpenPanel(null);
  };

  const handleHexClick = (hex) => {
    setSelectedHex(hex);
  };

  const handleHexDoubleClick = (hex) => {
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

  const handleMoveToHex = (hex) => {
    if (!hex || !isHexReachable(hex.col, hex.row)) return;

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
      if (character.rations > 0) {
        character.rations--;
        character.daysWithoutFood = 0;
        
        // Update character state
        dispatch({
          type: actions.UPDATE_CHARACTER,
          payload: character
        });
        
        addMessage(
          `Consumed 1 ration for travel. ${character.rations} days remaining.`,
          'info'
        );
      } else {
        character.daysWithoutFood++;
        
        // Update character state
        dispatch({
          type: actions.UPDATE_CHARACTER,
          payload: character
        });
        
        addMessage(
          `No rations available! Days without food: ${character.daysWithoutFood}`,
          'warning'
        );
      }
    }

    // Update player position
    dispatch({
      type: actions.SET_PLAYER_POSITION,
      payload: { col: hex.col, row: hex.row }
    });

    // Advance time for movement (1 day per hex)
    dispatch({
      type: actions.ADVANCE_TIME,
      payload: TIME_COSTS.MOVEMENT
    });

    // Reveal hexes around new position
    dispatch({
      type: actions.REVEAL_AROUND_PLAYER,
      payload: { col: hex.col, row: hex.row }
    });

    // Log movement
    addMessage(
      `Moved to hex (${hex.col}, ${hex.row}) - ${hex.terrain.name} (1 day)`,
      'action'
    );

    // Check for POI discovery
    if (hex.poi) {
      const discovered = isPoiDiscovered(hex.col, hex.row);

      if (!discovered) {
        // Mark as discovered
        dispatch({
          type: actions.DISCOVER_POI,
          payload: { col: hex.col, row: hex.row }
        });

        // Log discovery
        addMessage(
          `You discovered: ${hex.poi.name}!`,
          'discovery'
        );

        // Trigger event based on type
        if (hex.poi.eventType === 'active') {
          // Show active event
          const choices = getActiveEventChoices(hex.poi);
          showEvent(hex.poi, 'active', choices, (action) => handleEventChoice(action, hex.poi));
        }
      } else if (hex.poi.eventType === 'active') {
        // Already discovered active event - trigger again
        const choices = getActiveEventChoices(hex.poi);
        showEvent(hex.poi, 'active', choices, (action) => handleEventChoice(action, hex.poi));
      }
    }
  };

  // Get adjacent hexes (6 neighbors in hex grid)
  const getAdjacentHexes = (col, row) => {
    const isEvenRow = row % 2 === 0;
    const offsets = isEvenRow
      ? [
          { dc: -1, dr: 0 },  // left
          { dc: 1, dr: 0 },   // right
          { dc: -1, dr: -1 }, // top-left
          { dc: 0, dr: -1 },  // top-right
          { dc: -1, dr: 1 },  // bottom-left
          { dc: 0, dr: 1 }    // bottom-right
        ]
      : [
          { dc: -1, dr: 0 },  // left
          { dc: 1, dr: 0 },   // right
          { dc: 0, dr: -1 },  // top-left
          { dc: 1, dr: -1 },  // top-right
          { dc: 0, dr: 1 },   // bottom-left
          { dc: 1, dr: 1 }    // bottom-right
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

    // Get current hex
    const currentHex = state.mapData?.find(
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
      return lastForaged && (currentDay - lastForaged < FORAGE_COOLDOWN);
    });

    if (hexesOnCooldown.length === allHexes.length) {
      const daysRemaining = FORAGE_COOLDOWN - (currentDay - state.playerCharacter.foragedHexes[`${currentHex.col},${currentHex.row}`]);
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

    // Create dice roller (no seed - we want random rolls, not deterministic)
    const diceRoller = new DiceRoller();

    // Perform forage check
    const result = SurvivalManager.forage(updatedCharacter, allHexes, diceRoller, currentDay);

    // Mark all hexes as foraged with current day
    result.hexesForaged.forEach(hexKey => {
      updatedCharacter.foragedHexes[hexKey] = currentDay;
    });

    // Log for debugging
    console.log('Foraging complete:', {
      currentDay,
      hexesForaged: result.hexesForaged,
      foragedHexes: updatedCharacter.foragedHexes
    });

    // Update character state
    dispatch({
      type: actions.UPDATE_CHARACTER,
      payload: updatedCharacter
    });

    // Advance time (foraging takes 4 hours)
    dispatch({
      type: actions.ADVANCE_TIME,
      payload: TIME_COSTS.FORAGE
    });

    // Show result in game log
    if (result.success) {
      addMessage(`Survival ${result.roll.roll}+${result.roll.modifier}=${result.roll.total} vs DC ${result.roll.dc}: Found ${result.rationsGained} rations (${result.goodHexCount} rich hexes)`, 'success');
    } else {
      addMessage(`Survival ${result.roll.roll}+${result.roll.modifier}=${result.roll.total} vs DC ${result.roll.dc}: No food found`, 'warning');
    }
  };

  // Get choices for active events (combat)
  const getActiveEventChoices = (poi) => {
    return [
      { label: 'Fight', action: 'fight', style: 'danger' }
    ];
  };

  // Handle event choice (combat, flee, etc.)
  const handleEventChoice = (action, poi) => {
    if (action === 'fight') {
      addMessage(
        `You engage ${poi.name} in combat!`,
        'encounter'
      );

      // TODO: Future tactical combat will create a combat canvas here
      // For now, auto-win combat simulation

      // Get party members (player + NPCs)
      const characters = [state.playerCharacter];
      if (state.party) {
        characters.push(...state.party.npcs.filter(npc => npc && npc.currentHP > 0));
      }

      // Parse creature string into Enemy instances
      const diceRoller = new DiceRoller();
      const enemies = Enemy.parseCreatureString(poi.creatures, poi.cr, diceRoller);

      // Run combat simulation (auto-win for now)
      const combat = new Combat(characters, enemies, { canFlee: false });
      const result = combat.simulateCombat();

      // Get combat time
      const combatTime = getCombatDuration();

      // Update character HP from combat
      const updatedPlayerCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const playerState = result.characterStates.find(c => c.name === state.playerCharacter.name);
      if (playerState) {
        updatedPlayerCharacter.currentHP = playerState.currentHP;
      }

      // Update party
      let updatedParty = state.party;
      if (state.party) {
        // Properly reconstruct Party instance to preserve class methods
        updatedParty = Party.fromJSON(state.party.toJSON());
        updatedParty.npcs = updatedParty.npcs.map((npc, index) => {
          if (!npc) return null;
          const npcState = result.characterStates.find(c => c.name === npc.name);
          if (npcState) {
            const updatedNPC = Character.fromJSON(npc.toJSON());
            updatedNPC.currentHP = npcState.currentHP;
            return updatedNPC;
          }
          return npc;
        });
      }

      // Advance time for combat
      dispatch({
        type: actions.ADVANCE_TIME,
        payload: combatTime
      });

      // Update character states and award XP
      dispatch({
        type: actions.RESOLVE_COMBAT,
        payload: {
          playerCharacter: updatedPlayerCharacter,
          party: updatedParty,
          combatLog: result.combatLog,
          xpPerCharacter: result.xpPerCharacter || 0
        }
      });

      // Check for party wipe after updating character states
      const isWiped = updatedPlayerCharacter.currentHP <= 0 && 
                      (!updatedParty || updatedParty.isWiped());

      // Show combat results in EventInfoBox
      const summary = combat.getCombatSummary(result);
      const fullLog = combat.generateCombatLog();

      // Log result to game log
      if (result.victory) {
        addMessage(
          `Victory! Defeated ${poi.creatures}.`,
          'success'
        );
        if (result.xpPerCharacter > 0) {
          addMessage(
            `Earned ${result.xpPerCharacter} XP per party member.`,
            'info'
          );
        }
      } else {
        addMessage(
          `Defeat! The party was defeated by ${poi.creatures}.`,
          'error'
        );
      }

      if (isWiped) {
        // Party wiped - show defeat message then game over
        showEvent(
          {
            name: 'Defeat!',
            description: `${summary}\n\n--- Combat Log ---\n${fullLog}`,
            type: 'encounter',
            eventType: 'active'
          },
          'active',
          [{ label: 'Game Over', action: 'gameover', style: 'primary' }],
          () => {
            dismissEvent();
            dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'gameover' });
          }
        );
      } else if (result.victory) {
        // Victory - auto-dismiss after showing message
        showEvent(
          {
            name: 'Victory!',
            description: `${summary}\n\n--- Combat Log ---\n${fullLog}`,
            type: 'encounter',
            eventType: 'active'
          },
          'passive',
          [{ label: 'Continue', action: 'continue', style: 'primary' }],
          () => dismissEvent()
        );
        
        // Auto-dismiss after 2 seconds
        setTimeout(() => {
          dismissEvent();
        }, 2000);
      } else {
        // Defeat but party survived - show continue button
        showEvent(
          {
            name: 'Defeat!',
            description: `${summary}\n\n--- Combat Log ---\n${fullLog}`,
            type: 'encounter',
            eventType: 'active'
          },
          'active',
          [{ label: 'Continue', action: 'continue', style: 'primary' }],
          () => dismissEvent()
        );
      }
    } else if (action === 'continue') {
      // Continue after combat results
      dismissEvent();
    } else if (action === 'gameover') {
      // Transition to game over screen
      dismissEvent();
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
  const { handleInteract, handlePassiveChoice } = useHexInteraction(currentHex);

  // Helper function to get hex in a direction
  const getHexInDirection = (direction) => {
    if (!state.mapData) return null;
    
    const { col, row } = state.playerPosition;
    let targetCol = col;
    let targetRow = row;

    // Hex grid movement offsets (offset coordinates)
    const isEvenRow = row % 2 === 0;
    
    switch(direction) {
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
        const currentHex = getInteriorHexAt(state.interiorPlayerPosition?.col, state.interiorPlayerPosition?.row);
        if (currentHex && currentHex.terrain.isInteractive && currentHex.buildingType) {
          handleBuildingInteraction(currentHex);
        } else if (currentHex && currentHex.terrain.key === 'gate') {
          if (state.currentPOI?.poi.type === 'town') {
            dispatch({ type: actions.EXIT_TOWN });
          } else {
            dispatch({ type: actions.EXIT_EXPLORATION });
          }
        }
      } else {
        const hex = getCurrentHex();
        if (hex && hex.poi) {
          // Check if POI is discovered first
          const discovered = isPoiDiscovered(hex.col, hex.row);
          
          // Directly trigger the appropriate action based on POI type
          if (hex.poi.type === 'town') {
            if (discovered || hex.poi.visibleWithoutDiscovery) {
              // Enter town directly without showing dialog
              dispatch({
                type: actions.ENTER_TOWN,
                payload: { col: hex.col, row: hex.row, poi: hex.poi }
              });
            }
          } else if (['cave', 'ruins', 'tower', 'dungeon'].includes(hex.poi.type)) {
            handlePassiveChoice('explore', hex.poi);
          }
          // Note: shrines and camps now use buttons in HexDetails panel
          // No spacebar action for them - player uses buttons
        }
      }
    },
    onSearch: () => {
      if (!state.inInterior) {
        const hex = getCurrentHex();
        if (hex && hex.poi) {
          handlePassiveChoice('search', hex.poi);
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
    }
  };

  // Enable keyboard controls (works for both overworld and interior)
  useKeyboardControls(keyboardCallbacks, !isBlockingMovement);

  // Helper to get interior hex at position
  const getInteriorHexAt = (col, row) => {
    if (!interiorMap) return null;
    return interiorMap.hexes.find(h => h.col === col && h.row === row);
  };

  // Helper to get interior hex in direction
  const getInteriorHexInDirection = (direction) => {
    if (!state.interiorPlayerPosition || !interiorMap) return null;
    
    const { col, row } = state.interiorPlayerPosition;
    let targetCol = col;
    let targetRow = row;

    switch(direction) {
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
  const handleInteriorHexClick = (hex) => {
    setSelectedInteriorHex(hex);
  };

  const handleInteriorHexDoubleClick = (hex) => {
    console.log('Interior hex double click:', hex);
    console.log('Interior player position:', state.interiorPlayerPosition);
    
    if (!hex.terrain.walkable) {
      addMessage('Cannot move to unwalkable terrain', 'warning');
      return;
    }

    if (!state.interiorPlayerPosition) {
      console.error('No interior player position set!');
      return;
    }

    // Check distance (1 hex move at a time)
    const distance = getHexDistance(
      state.interiorPlayerPosition.col,
      state.interiorPlayerPosition.row,
      hex.col,
      hex.row
    );

    console.log('Distance:', distance);

    if (distance > 1) {
      addMessage('Too far to move in one turn', 'warning');
      return;
    }

    // Update interior player position
    dispatch({
      type: actions.SET_INTERIOR_PLAYER_POSITION,
      payload: { col: hex.col, row: hex.row }
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
  const handleBuildingInteraction = (hex) => {
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
  const interiorMap = state.inInterior && state.currentPOI 
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

    const currentHex = state.mapData?.find(
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
      return lastForaged && (currentDay - lastForaged < FORAGE_COOLDOWN);
    });

    if (hexesOnCooldown.length === allHexes.length) {
      const hexKey = `${currentHex.col},${currentHex.row}`;
      const daysRemaining = FORAGE_COOLDOWN - (currentDay - state.playerCharacter.foragedHexes[hexKey]);
      return { ready: false, message: `Cooldown: ${daysRemaining}d` };
    }

    if (hexesOnCooldown.length > 0) {
      return { ready: true, message: `Partial: ${allHexes.length - hexesOnCooldown.length}/${allHexes.length} hexes` };
    }

    return { ready: true, message: 'Ready to forage' };
  };

  const forageStatus = getForageStatus();

  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Game Header with Time Display */}
      <div style={{
        backgroundColor: 'var(--panel-bg)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.25rem' }}>
          hexcrawler
        </h2>
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center',
          color: 'var(--text-color)'
        }}>
          <div style={{
            fontSize: '1.1rem',
            fontWeight: '500',
            fontFamily: 'monospace',
            padding: '0.25rem 0.75rem',
            backgroundColor: 'var(--control-bg)',
            borderRadius: '4px'
          }}>
            {formatTime(state.gameTime)}
          </div>
          <div style={{
            fontSize: '0.95rem',
            fontWeight: '500',
            padding: '0.25rem 0.75rem',
            backgroundColor: 'var(--control-bg)',
            borderRadius: '4px',
            color: state.playerCharacter?.rations <= 2 ? '#e74c3c' : 'var(--text-color)'
          }}>
            Rations: {state.playerCharacter?.rations || 0}
          </div>
          <div style={{
            fontSize: '0.95rem',
            fontWeight: '500',
            padding: '0.25rem 0.75rem',
            backgroundColor: 'var(--control-bg)',
            borderRadius: '4px',
            color: '#f39c12'
          }}>
            Gold: {state.playerCharacter?.gold || 0}
          </div>
          {/* Forage Status Indicator */}
          <div style={{
            fontSize: '0.95rem',
            fontWeight: '500',
            color: forageStatus.ready ? '#2ecc71' : '#e74c3c',
            cursor: 'default',
            userSelect: 'none'
          }}
          title={forageStatus.message}>
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
        <main className="canvas-container" style={{ flex: 1 }}>
          {state.inInterior && interiorMap ? (
            <InteriorHexCanvas
              interiorMap={interiorMap}
              playerPosition={state.interiorPlayerPosition}
              selectedHex={selectedInteriorHex}
              onHexClick={handleInteriorHexClick}
              onHexDoubleClick={handleInteriorHexDoubleClick}
            />
          ) : state.mapData && state.mapData.length > 0 ? (
            <HexGridCanvas
              hexes={state.mapData}
              onHexClick={handleHexClick}
              onHexDoubleClick={handleHexDoubleClick}
            />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-color)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h2>Generating Map...</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  Seed: {state.mapSeed || 'Not set'}
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Panel - Hex Info or Interior Info */}
        <aside style={{
          width: '280px',
          flexShrink: 0,
          backgroundColor: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: state.inInterior ? 0 : '1rem',
          overflowY: 'auto'
        }}>
          {state.inInterior && interiorMap ? (
            <InteriorInfoPane
              selectedHex={selectedInteriorHex}
              playerPosition={state.interiorPlayerPosition}
              interiorMap={interiorMap}
            />
          ) : (
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
        <PartyList
          party={state.party}
          onMemberSelect={handlePartyMemberSelect}
        />
      </MenuPanel>

      <MenuPanel
        title="Equipment"
        isOpen={openPanel === 'equipment'}
        onClose={handleClosePanel}
        width="800px"
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

      {/* Game Log */}
      <div className="game-log-container" style={{ display: 'flex', position: 'relative' }}>
        <GameLog />
        {/* EventInfoBox positioned in bottom right */}
      </div>
    </div>
  );
}

OverworldScene.propTypes = {
  // This component doesn't receive any props, gets all data from hooks
};

export default OverworldScene;
