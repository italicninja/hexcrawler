import { useEffect, useState, useRef, useMemo } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useGameLog } from '../../contexts/GameLogContext';
// import { useEventInfoBox } from '../../contexts/EventInfoBoxContext';
import { useMapGeneration } from '../../hooks/useMapGeneration';
import { useInfiniteTerrainExpansion } from '../../hooks/useInfiniteTerrainExpansion';
import { useCombatOrchestration } from '../../hooks/useCombatOrchestration';
import { useInteriorNavigation } from '../../hooks/useInteriorNavigation';
import { useOverworldActions } from '../../hooks/useOverworldActions';
import { useOverworldInput } from '../../hooks/useOverworldInput';
import { TerrainGenerator } from '../../terrainGenerator';
import { formatTime } from '../../game/TimeManager';
import { Character } from '../../game/Character';
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
import { CombatCanvasPane, CombatActionPane } from './CombatSceneWrapper';
import MenuSidebar from '../ui/MenuSidebar';
import MenuPanel from '../ui/MenuPanel';
import AIInspector from '../debug/AIInspector';
import DevTools from '../debug/DevTools';
import type { SceneHex } from '../../types/scene';

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
  const { state, isHexReachable } = useGameState();
  const { settings } = useSettings();
  const { addMessage } = useGameLog();
  // const { showMessage, showEvent, dismissEvent, isBlockingMovement } = useEventInfoBox();
  const isBlockingMovement = !!state.combatState?.active;
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(state.playerCharacter);
  const [selectedHex, setSelectedHex] = useState<SceneHex | null>(null);
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // AI Inspector toggle (via URL param)
  const [showAIInspector] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('aiInspector') === 'true';
  });

  // Combat behaviour: victory/defeat detection, initiative logging, AI turns,
  // and the player-facing combat handlers. Must stay mounted scene-wide.
  const combat = useCombatOrchestration();

  // Interior exploration: active interior map, hex selection, movement
  // (stairs, loot, lazy floor generation), and building interactions.
  const interior = useInteriorNavigation({ openPanel: setOpenPanel });

  // Overworld movement, foraging, and combat engagement.
  const overworld = useOverworldActions();

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
        overworld.handleForage();
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
      overworld.handleMoveToHex(hex);
    } else {
      addMessage('That hex is too far away!', 'warning');
    }
  };

  // Keyboard controls (movement, interact, search, panels, quicksave) for
  // both overworld and interior; disabled while combat blocks movement.
  useOverworldInput({
    overworld,
    interior,
    openPanel: setOpenPanel,
    enabled: !isBlockingMovement,
  });

  const forageStatus = FEATURES.SURVIVAL_ENABLED
    ? overworld.getForageStatus()
    : { ready: false, message: '' };

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
            <CombatCanvasPane combat={combat} />
          ) : state.inInterior && interior.interiorMap ? (
            /* Interior Mode */
            <InteriorHexCanvas
              interiorMap={
                interior.interiorMap as unknown as Parameters<typeof InteriorHexCanvas>[0]['interiorMap']
              }
              playerPosition={state.interiorPlayerPosition}
              playerIcon={CLASS_ICONS[state.party?.player?.class ?? ''] ?? '🧍'}
              selectedHex={interior.selectedInteriorHex}
              onHexClick={interior.handleInteriorHexClick}
              onHexDoubleClick={interior.handleInteriorHexDoubleClick}
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
            <CombatActionPane combat={combat} />
          ) : state.inInterior && interior.interiorMap ? (
            /* Interior Info */
            <InteriorInfoPane
              selectedHex={
                interior.selectedInteriorHex as unknown as Parameters<typeof InteriorInfoPane>[0]['selectedHex']
              }
              playerPosition={state.interiorPlayerPosition}
              interiorMap={
                interior.interiorMap as unknown as Parameters<typeof InteriorInfoPane>[0]['interiorMap']
              }
            />
          ) : (
            /* Hex Details */
            <HexDetails
              hex={selectedHex as unknown as Parameters<typeof HexDetails>[0]['hex']}
              terrainGenerator={terrainGeneratorRef.current}
              onMoveClick={overworld.handleMoveToHex as unknown as Parameters<typeof HexDetails>[0]['onMoveClick']}
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
