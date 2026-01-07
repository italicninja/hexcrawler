import { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useEventInfoBox } from '../../contexts/EventInfoBoxContext';
import { useMapGeneration } from '../../hooks/useMapGeneration';
import { useInfiniteTerrainExpansion } from '../../hooks/useInfiniteTerrainExpansion';
import { TerrainGenerator } from '../../terrainGenerator.js';
import { TIME_COSTS, formatTime, getCombatDuration } from '../../game/TimeManager.js';
import { DiceRoller } from '../../game/DiceRoller.js';
import { Combat } from '../../game/Combat.js';
import { Enemy } from '../../game/Enemy.js';
import { Character } from '../../game/Character.js';
import GameLog from '../ui/GameLog';
import CharacterStats from '../ui/CharacterStats';
import PartyList from '../ui/PartyList';
import Equipment from '../ui/Equipment';
import HexDetails from '../ui/HexDetails';
import Settings from '../ui/Settings';
import RestMenu from '../ui/RestMenu';
import SurvivalMenu from '../ui/SurvivalMenu';
import QuestLog from '../ui/QuestLog';
import HexGridCanvas from '../canvas/HexGridCanvas';
import EventInfoBox from '../ui/EventInfoBox';
import MenuSidebar from '../ui/MenuSidebar';
import MenuPanel from '../ui/MenuPanel';

function OverworldScene() {
  const { state, dispatch, actions, isHexReachable, isPoiDiscovered } = useGameState();
  const { settings } = useSettings();
  const { showMessage, showEvent, dismissEvent, isBlockingMovement } = useEventInfoBox();
  const [openPanel, setOpenPanel] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(state.playerCharacter);
  const [selectedHex, setSelectedHex] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const terrainGeneratorRef = useRef(null);
  const gameLogRef = useRef(null);

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
  useMapGeneration(terrainGeneratorRef, gameLogRef, viewportSize);
  useInfiniteTerrainExpansion(terrainGeneratorRef, gameLogRef, viewportSize);

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
      if (gameLogRef.current) {
        gameLogRef.current.addMessage('You must resolve the current event first!', 'warning');
      }
      return;
    }

    // Check if hex is reachable
    if (isHexReachable(hex.col, hex.row)) {
      handleMoveToHex(hex);
    } else if (gameLogRef.current) {
      gameLogRef.current.addMessage('That hex is too far away!', 'warning');
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
      if (gameLogRef.current) {
        gameLogRef.current.addMessage('You must resolve the current event first!', 'warning');
      }
      return;
    }

    // Update player position
    dispatch({
      type: actions.SET_PLAYER_POSITION,
      payload: { col: hex.col, row: hex.row }
    });

    // Advance time for movement (10 minutes per hex)
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
    if (gameLogRef.current) {
      gameLogRef.current.addMessage(
        `Moved to hex (${hex.col}, ${hex.row}) - ${hex.terrain.name}`,
        'action'
      );
    }

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
        if (gameLogRef.current) {
          gameLogRef.current.addMessage(
            `You discovered: ${hex.poi.name}!`,
            'discovery'
          );
        }

        // Show discovery message
        showMessage(
          '✨ DISCOVERY!',
          `You discovered: ${hex.poi.name}`,
          'info',
          true
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

  // Get choices for active events (combat)
  const getActiveEventChoices = (poi) => {
    return [
      { label: 'Fight', action: 'fight', style: 'danger' },
      { label: 'Flee', action: 'flee', style: 'warning' }
    ];
  };

  // Handle event choice (combat, flee, etc.)
  const handleEventChoice = (action, poi) => {
    if (action === 'fight') {
      if (gameLogRef.current) {
        gameLogRef.current.addMessage(
          `You engage ${poi.name} in combat!`,
          'encounter'
        );
      }

      // Get party members (player + NPCs)
      const characters = [state.playerCharacter];
      if (state.party) {
        characters.push(...state.party.npcs.filter(npc => npc && npc.currentHP > 0));
      }

      // Parse creature string into Enemy instances
      const diceRoller = new DiceRoller();
      const enemies = Enemy.parseCreatureString(poi.creatures, poi.cr, diceRoller);

      // Run combat simulation
      const combat = new Combat(characters, enemies, { canFlee: true });
      const result = combat.simulateCombat();

      // Get combat time
      const combatTime = getCombatDuration();

      // Show combat results
      const summary = combat.getCombatSummary(result);
      const fullLog = combat.generateCombatLog();

      showMessage(
        result.victory ? '⚔️ Victory!' : (result.fled ? '🏃 Fled!' : '💀 Defeat!'),
        `${summary}

--- Combat Log ---
${fullLog}`,
        result.victory ? 'info' : 'warning',
        true
      );

      // Update character HP from combat
      const updatedPlayerCharacter = Character.fromJSON(state.playerCharacter.toJSON());
      const playerState = result.characterStates.find(c => c.name === state.playerCharacter.name);
      if (playerState) {
        updatedPlayerCharacter.currentHP = playerState.currentHP;
      }

      // Update party
      let updatedParty = state.party;
      if (state.party) {
        updatedParty = { ...state.party };
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

      // Log result to game log
      if (gameLogRef.current) {
        if (result.victory) {
          gameLogRef.current.addMessage(
            `Victory! Defeated ${poi.creatures}.`,
            'success'
          );
          if (result.xpPerCharacter > 0) {
            gameLogRef.current.addMessage(
              `Earned ${result.xpPerCharacter} XP per party member.`,
              'info'
            );
          }
        } else if (result.fled) {
          gameLogRef.current.addMessage(
            `The party fled from ${poi.name}!`,
            'warning'
          );
        } else {
          gameLogRef.current.addMessage(
            `Defeat! The party was defeated by ${poi.creatures}.`,
            'error'
          );
        }
      }
    } else if (action === 'flee') {
      if (gameLogRef.current) {
        gameLogRef.current.addMessage(
          `You flee from ${poi.name}!`,
          'action'
        );
      }
      // Dismiss event without fighting
      dismissEvent();
    }
  };

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
          {state.mapData && state.mapData.length > 0 ? (
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

        {/* Right Panel - Hex Info (always visible) */}
        <aside style={{
          width: '280px',
          flexShrink: 0,
          backgroundColor: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <HexDetails
            hex={selectedHex}
            terrainGenerator={terrainGeneratorRef.current}
            onMoveClick={handleMoveToHex}
          />
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
        <GameLog ref={gameLogRef} />
        {/* EventInfoBox positioned in bottom right */}
        <EventInfoBox />
      </div>
    </div>
  );
}

OverworldScene.propTypes = {
  // This component doesn't receive any props, gets all data from hooks
};

export default OverworldScene;
