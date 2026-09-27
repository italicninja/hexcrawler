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
import { useQuestTracker } from '../../hooks/useQuestTracker';
import { TerrainGenerator } from '../../terrainGenerator';
import { formatTime, getTimeOfDay } from '../../game/TimeManager';
import { Character } from '../../game/Character';
import { FEATURES } from '../../constants/gameConstants';
import GameLog from '../ui/GameLog';
import CharacterStats from '../ui/CharacterStats';
import PartyList from '../ui/PartyList';
import Equipment from '../ui/Equipment';
import HexActions from '../ui/HexActions';
import InteriorActions from '../ui/InteriorActions';
import Settings from '../ui/Settings';
import RestMenu from '../ui/RestMenu';
import QuestLog from '../ui/QuestLog';
import SaveSlotManager from '../ui/SaveSlotManager';
import HexGridCanvas from '../canvas/HexGridCanvas';
import InteriorHexCanvas from '../canvas/InteriorHexCanvas';
import { CombatCanvasPane, CombatActionPane } from './CombatSceneWrapper';
import AIInspector from '../debug/AIInspector';
import DevTools from '../debug/DevTools';
import type { SceneHex } from '../../types/scene';
import PixelIcon from '../ui/PixelIcon';

// Right-page panels opened from the bookmark tabs (and keyboard shortcuts).
const PAGES: Record<string, { title: string; kicker: string }> = {
  character: { title: 'The hero', kicker: 'Abilities & feats' },
  party: { title: 'Companions', kicker: 'Those who travel with you' },
  equipment: { title: 'Pack & gear', kicker: 'What you carry' },
  rest: { title: 'Rest', kicker: 'Catch your breath' },
  quests: { title: 'Quests', kicker: 'Tasks & promises' },
  save: { title: 'Save the tale', kicker: 'Bookmarks' },
  config: { title: 'Settings', kicker: 'Margins & notes' },
};

function OverworldScene() {
  const { state, isHexReachable } = useGameState();
  const { settings } = useSettings();
  const { addMessage } = useGameLog();
  // const { showMessage, showEvent, dismissEvent, isBlockingMovement } = useEventInfoBox();
  const isBlockingMovement = !!state.combatState?.active;
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState(state.playerCharacter);
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // AI Inspector toggle (via URL param)
  const [showAIInspector] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return import.meta.env.DEV && params.get('aiInspector') === 'true';
  });

  // Combat behaviour: victory/defeat detection, initiative logging, AI turns,
  // and the player-facing combat handlers. Must stay mounted scene-wide.
  const combat = useCombatOrchestration();
  useQuestTracker();

  // Overworld movement, foraging, and combat engagement.
  const overworld = useOverworldActions();

  // Interior exploration: active interior map, hex selection, movement
  // (stairs, loot, encounters, lazy floor generation), and building interactions.
  const interior = useInteriorNavigation({
    openPanel: setOpenPanel,
    engageCombat: overworld.handleEngageCombat,
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
  useMapGeneration(terrainGeneratorRef);
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
        id: 'journal',
        label: 'Journal',
        icon: <PixelIcon name="map" scale={3} />,
        description: 'Where you are and what happened',
      },
      {
        id: 'character',
        label: 'Character',
        icon: <PixelIcon name="character" scale={3} />,
        description: 'View character stats',
      },
      {
        id: 'party',
        label: 'Party',
        icon: <PixelIcon name="party" scale={3} />,
        description: 'Manage party members',
        badge: state.party?.npcs?.filter((npc: unknown) => npc).length || 0,
      },
      {
        id: 'equipment',
        label: 'Equipment',
        icon: <PixelIcon name="equipment" scale={3} />,
        description: 'Manage inventory & gear',
      },
      {
        id: 'rest',
        label: 'Rest',
        icon: <PixelIcon name="tent" scale={3} />,
        description: 'Rest and recover',
      },
      ...(FEATURES.SURVIVAL_ENABLED
        ? [
            {
              id: 'survival',
              label: 'Survival',
              icon: <PixelIcon name="forage" scale={3} />,
              description: 'Forage and hunt',
              disabled: !!state.combatState?.active,
              disabledReason: 'Cannot forage during combat',
            },
          ]
        : []),
      {
        id: 'quests',
        label: 'Quests',
        icon: <PixelIcon name="scroll" scale={3} />,
        description: 'Track your quests',
        badge: state.activeQuests?.length || 0,
      },
      {
        id: 'save',
        label: 'Save',
        icon: <PixelIcon name="disk" scale={3} />,
        description: 'Save your game',
      },
      {
        id: 'config',
        label: 'Config',
        icon: <PixelIcon name="gear" scale={3} />,
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

    setOpenPanel(item.id === 'journal' ? null : item.id);
  };

  const handleClosePanel = () => {
    setOpenPanel(null);
  };

  // Escape turns back to the journal; a fight always opens on the journal page.
  useEffect(() => {
    if (!openPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setOpenPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPanel]);

  const combatActive = !!state.combatState?.battlefield;
  useEffect(() => {
    if (combatActive) setOpenPanel(null);
  }, [combatActive]);

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

  const inCombat = !!state.combatState?.battlefield;
  const showInterior = state.inInterior && !!interior.interiorMap;
  const pos = state.playerPosition;
  const currentHex = state.mapData?.find(h => h.col === pos?.col && h.row === pos?.row);
  const locationTitle = inCombat
    ? 'Battle is joined!'
    : showInterior
      ? (state.currentPOI?.poi.name ?? 'Within')
      : (currentHex?.poi?.name ?? currentHex?.terrain.name ?? 'The wilds');
  const hero = state.playerCharacter;
  const hpPct = hero?.maxHP ? Math.max(0, Math.min(1, hero.currentHP / hero.maxHP)) : 0;

  return (
    <div className="game-container journal-layout">
      <div className="journal-book">
        {/* Left page: where we are, and the map */}
        <section className="journal-page journal-page--map">
          <header className="journal-map-header">
            <div>
              <div className="journal-kicker">
                Day {state.gameTime?.day ?? 1} · {getTimeOfDay(state.gameTime?.hour ?? 8)}
              </div>
              <h2 className="journal-title">{locationTitle}</h2>
            </div>
            {import.meta.env.DEV && <DevTools terrainGeneratorRef={terrainGeneratorRef} />}
          </header>

          <main className="canvas-container journal-map">
            {inCombat ? (
              <CombatCanvasPane combat={combat} />
            ) : showInterior ? (
              <InteriorHexCanvas
                interiorMap={
                  interior.interiorMap as unknown as Parameters<
                    typeof InteriorHexCanvas
                  >[0]['interiorMap']
                }
                playerPosition={state.interiorPlayerPosition}
                playerClass={state.party?.player?.class}
                selectedHex={interior.selectedInteriorHex}
                onHexClick={interior.handleInteriorHexClick}
                onHexDoubleClick={interior.handleInteriorHexDoubleClick}
              />
            ) : state.mapData && state.mapData.length > 0 ? (
              <HexGridCanvas
                hexes={state.mapData as unknown as Parameters<typeof HexGridCanvas>[0]['hexes']}
                onHexDoubleClick={handleHexDoubleClick}
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <h2>Charting the land...</h2>
                <p style={{ color: 'var(--text-muted)' }}>Seed: {state.mapSeed || 'Not set'}</p>
              </div>
            )}
          </main>

          <footer className="journal-strip">
            <span>
              <PixelIcon name="coins" scale={3} />
              {hero?.gold || 0} gold
            </span>
            {FEATURES.SURVIVAL_ENABLED && (
              <span className={hero?.rations <= 2 ? 'journal-low' : undefined}>
                <PixelIcon name="forage" scale={3} />
                {hero?.rations || 0} rations
              </span>
            )}
            <span>
              <PixelIcon name="clock" scale={3} />
              {formatTime(state.gameTime)}
            </span>
            <span className="journal-position">
              <PixelIcon name="pin" scale={3} />({pos?.col ?? '?'}, {pos?.row ?? '?'})
            </span>
            {FEATURES.SURVIVAL_ENABLED && (
              <span
                className={forageStatus.ready ? undefined : 'journal-low'}
                title={forageStatus.message}
              >
                {forageStatus.ready ? 'Ready to forage' : 'Foraged recently'}
              </span>
            )}
          </footer>
        </section>

        {/* Right page: the codex (hero, context, journal entries) */}
        <section className="journal-page journal-page--codex">
          <nav className="journal-tabs" aria-label="Game menu">
            {menuItems.map(item => (
              <button
                key={item.id}
                type="button"
                className={`journal-tab${(openPanel ?? 'journal') === item.id ? ' is-open' : ''}`}
                onClick={() => handleMenuItemClick(item)}
                disabled={item.disabled}
                title={item.disabled ? item.disabledReason : `${item.label}: ${item.description}`}
                aria-label={item.label}
              >
                {item.icon}
                {!!item.badge && <span className="journal-tab-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>

          {openPanel && PAGES[openPanel] ? (
            <div className="journal-panel">
              <header className="journal-panel-header">
                <div>
                  <div className="journal-kicker">{PAGES[openPanel].kicker}</div>
                  <h2 className="journal-title">{PAGES[openPanel].title}</h2>
                </div>
                <button type="button" className="jp-link" onClick={handleClosePanel}>
                  <PixelIcon name="arrowLeft" /> Back to the journal
                </button>
              </header>
              <div className="journal-panel-body">
                {openPanel === 'character' && <CharacterStats character={state.playerCharacter} />}
                {openPanel === 'party' && (
                  <PartyList
                    party={state.party}
                    onMemberSelect={
                      handlePartyMemberSelect as unknown as Parameters<
                        typeof PartyList
                      >[0]['onMemberSelect']
                    }
                  />
                )}
                {openPanel === 'equipment' && <Equipment character={selectedCharacter} />}
                {openPanel === 'rest' && <RestMenu onClose={handleClosePanel} />}
                {openPanel === 'quests' && <QuestLog />}
                {openPanel === 'save' && (
                  <SaveSlotManager mode="save" onClose={handleClosePanel} embedded />
                )}
                {openPanel === 'config' && <Settings />}
              </div>
            </div>
          ) : (
            <>
              {hero && (
                <div className="journal-hero">
                  <PixelIcon name={`player:${state.party?.player?.class ?? ''}`} scale={4} />
                  <div className="journal-hero-body">
                    <h2 className="journal-title">{hero.name}</h2>
                    <div className="journal-kicker">
                      {hero.class} · level {hero.level}
                    </div>
                    <div
                      className="journal-hp"
                      role="meter"
                      aria-label="Hit points"
                      aria-valuenow={hero.currentHP}
                      aria-valuemin={0}
                      aria-valuemax={hero.maxHP}
                    >
                      <span style={{ width: `${hpPct * 100}%` }} />
                    </div>
                    <small>
                      {hero.currentHP} of {hero.maxHP} hit points · armour {hero.armorClass}
                    </small>
                  </div>
                </div>
              )}

              <div className={`journal-context${inCombat ? ' is-combat' : ''}`}>
                {inCombat ? (
                  <CombatActionPane combat={combat} />
                ) : showInterior ? (
                  <InteriorActions
                    playerPosition={state.interiorPlayerPosition}
                    interiorMap={
                      interior.interiorMap as unknown as Parameters<
                        typeof InteriorActions
                      >[0]['interiorMap']
                    }
                  />
                ) : (
                  <HexActions />
                )}
              </div>

              <div className="journal-entries">
                <GameLog />
              </div>
            </>
          )}
        </section>
      </div>

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
