/**
 * DevTools - Development-only toolbox for rapid game testing
 *
 * Only rendered when import.meta.env.DEV is true.
 * Groups tools into collapsible sections for easy navigation.
 */

import { useState, type CSSProperties, type RefObject } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { Enemy } from '../../game/Enemy';
import { Character } from '../../game/Character';
import { AIEngine } from '../../game/ai/AIEngine';
import { WEATHER_TYPES } from '../../WeatherSystem';
import { POI_TYPES } from '../../poiSystem';
import { SaveManager } from '../../utils/SaveManager';
import logger from '../../utils/logger';
import type { TerrainGenerator } from '../../terrainGenerator';

/** A selectable option in a DevSelectRow dropdown. */
interface DevOption {
  label: string;
  key?: string | number;
  type?: string;
  [key: string]: unknown;
}

/** A pre-configured combat encounter for the Force Combat menu. */
interface EnemyPreset {
  label: string;
  encounterName: string;
  encounterType: string;
  enemies: Array<{ name: string; cr: number; type: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENEMY_PRESETS: EnemyPreset[] = [
  {
    label: '3 Goblins (CR 1/4)',
    encounterName: 'Goblin Skirmish (DEV)',
    encounterType: 'standard',
    enemies: [
      { name: 'Goblin Warrior', cr: 0.25, type: 'goblinoid' },
      { name: 'Goblin Archer', cr: 0.25, type: 'goblinoid' },
      { name: 'Goblin Warrior', cr: 0.25, type: 'goblinoid' },
    ],
  },
  {
    label: 'Undead Pack (CR 1/4)',
    encounterName: 'Undead Skirmish (DEV)',
    encounterType: 'standard',
    enemies: [
      { name: 'Skeleton', cr: 0.25, type: 'undead' },
      { name: 'Skeleton', cr: 0.25, type: 'undead' },
      { name: 'Zombie', cr: 0.25, type: 'undead' },
    ],
  },
  {
    label: 'Boss Fight (CR 5)',
    encounterName: 'Boss Encounter (DEV)',
    encounterType: 'boss',
    enemies: [{ name: 'Hill Giant', cr: 5, type: 'giant' }],
  },
  {
    label: 'Ambush (CR 1)',
    encounterName: 'Goblin Ambush (DEV)',
    encounterType: 'ambush',
    enemies: [
      { name: 'Hobgoblin', cr: 1, type: 'goblinoid' },
      { name: 'Goblin Archer', cr: 0.25, type: 'goblinoid' },
      { name: 'Goblin Archer', cr: 0.25, type: 'goblinoid' },
      { name: 'Goblin Warrior', cr: 0.25, type: 'goblinoid' },
    ],
  },
];

const WEATHER_OPTIONS: DevOption[] = [
  { label: 'Clear Skies', key: 'CLEAR' },
  { label: 'Light Rain', key: 'LIGHT_RAIN' },
  { label: 'Rain', key: 'RAIN' },
  { label: 'Heavy Rain', key: 'HEAVY_RAIN' },
  { label: 'Storm', key: 'STORM' },
  { label: 'Mist', key: 'MIST' },
  { label: 'Fog', key: 'FOG' },
  { label: 'Dense Fog', key: 'DENSE_FOG' },
  { label: 'Light Snow', key: 'LIGHT_SNOW' },
  { label: 'Snow', key: 'SNOW' },
  { label: 'Blizzard', key: 'BLIZZARD' },
  { label: 'Strong Winds', key: 'WIND' },
];

const POI_OPTIONS: DevOption[] = [
  { label: 'Dungeon', type: POI_TYPES.DUNGEON },
  { label: 'Ruins', type: POI_TYPES.RUINS },
  { label: 'Shrine', type: POI_TYPES.SHRINE },
  { label: 'Cave', type: POI_TYPES.CAVE },
  { label: 'Tower', type: POI_TYPES.TOWER },
  { label: 'Encounter', type: POI_TYPES.ENCOUNTER },
  { label: 'Camp', type: POI_TYPES.CAMP },
  { label: 'Village', type: POI_TYPES.VILLAGE },
  { label: 'Town', type: POI_TYPES.TOWN },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const DROPDOWN_STYLE: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: '0.25rem',
  backgroundColor: 'var(--panel-bg)',
  border: '2px solid rgba(255, 69, 0, 0.6)',
  borderRadius: '6px',
  boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
  minWidth: '260px',
  maxHeight: '80vh',
  overflowY: 'auto',
  zIndex: 1000,
};

const SECTION_HEADER_STYLE: CSSProperties = {
  padding: '0.4rem 0.75rem',
  fontSize: '0.7rem',
  fontWeight: '700',
  letterSpacing: '0.08em',
  color: 'rgba(255, 69, 0, 0.8)',
  textTransform: 'uppercase',
  borderTop: '1px solid var(--border-color)',
  marginTop: '0.25rem',
  userSelect: 'none',
};

const ITEM_BASE_STYLE: CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  backgroundColor: 'transparent',
  color: 'var(--text-color)',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  transition: 'background-color 0.15s',
  fontFamily: 'inherit',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DevSection({ title }: { title: string }) {
  return <div style={SECTION_HEADER_STYLE}>{title}</div>;
}

function DevButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...ITEM_BASE_STYLE,
        color: danger ? '#ff6b6b' : 'var(--text-color)',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-lighter)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function DevSelectRow<T extends DevOption>({
  icon,
  label,
  options,
  onSelect,
}: {
  icon: string;
  label: string;
  options: T[];
  onSelect: (opt: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...ITEM_BASE_STYLE,
          justifyContent: 'space-between',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-lighter)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{icon}</span>
          <span>{label}</span>
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{open ? '▲' : '▶'}</span>
      </button>

      {open && (
        <div
          style={{
            backgroundColor: 'var(--bg-color)',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          {options.map(opt => (
            <button
              key={opt.key ?? opt.type ?? opt.label}
              onClick={() => {
                onSelect(opt);
                setOpen(false);
              }}
              style={{
                ...ITEM_BASE_STYLE,
                paddingLeft: '2rem',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-lighter)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TeleportRow({ onTeleport }: { onTeleport: (col: number, row: number) => void }) {
  const [col, setCol] = useState('');
  const [row, setRow] = useState('');

  const handleGo = () => {
    const c = parseInt(col, 10);
    const r = parseInt(row, 10);
    if (!isNaN(c) && !isNaN(r)) {
      onTeleport(c, r);
      setCol('');
      setRow('');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.75rem',
      }}
    >
      <span style={{ fontSize: '0.85rem' }}>📍</span>
      <input
        type="number"
        placeholder="Col"
        value={col}
        onChange={e => setCol(e.target.value)}
        style={{
          width: '52px',
          padding: '0.2rem 0.35rem',
          fontSize: '0.8rem',
          backgroundColor: 'var(--bg-color)',
          color: 'var(--text-color)',
          border: '1px solid var(--border-color)',
          borderRadius: '3px',
          fontFamily: 'inherit',
        }}
      />
      <input
        type="number"
        placeholder="Row"
        value={row}
        onChange={e => setRow(e.target.value)}
        style={{
          width: '52px',
          padding: '0.2rem 0.35rem',
          fontSize: '0.8rem',
          backgroundColor: 'var(--bg-color)',
          color: 'var(--text-color)',
          border: '1px solid var(--border-color)',
          borderRadius: '3px',
          fontFamily: 'inherit',
        }}
      />
      <button
        onClick={handleGo}
        style={{
          padding: '0.2rem 0.5rem',
          fontSize: '0.8rem',
          backgroundColor: 'rgba(255, 69, 0, 0.3)',
          color: 'var(--text-color)',
          border: '1px solid rgba(255, 69, 0, 0.5)',
          borderRadius: '3px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Go
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DevTools component
// ---------------------------------------------------------------------------

interface DevToolsProps {
  terrainGeneratorRef?: RefObject<TerrainGenerator | null>;
}

function DevTools({ terrainGeneratorRef }: DevToolsProps) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const closeAfter =
    (fn: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      fn(...args);
      setOpen(false);
    };

  const getTerrainType = () => {
    if (!state.mapData) return 'plains';
    const hex = state.mapData.find(
      h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
    );
    return hex?.terrain?.name?.toLowerCase() || 'plains';
  };

  const getPlayer = () => state.playerCharacter;

  // ── Combat ────────────────────────────────────────────────────────────────

  const handleForceCombat = async (preset: EnemyPreset) => {
    if (!state.party) {
      addMessage('[DEV] No party found!', 'error');
      return;
    }
    const allies = state.party.getAllMembers().filter(Boolean);
    if (allies.length === 0) {
      addMessage('[DEV] No party members!', 'error');
      return;
    }

    addMessage(`[DEV] Starting: ${preset.encounterName}`, 'system');

    const enemies = preset.enemies.map(e => new Enemy(e.name, e.cr, e.type));

    const aiLoadPromises = enemies.map(async enemy => {
      try {
        enemy.aiConfig = await AIEngine.loadAI(enemy.family, enemy.variant);
      } catch {
        enemy.aiConfig = AIEngine.getFallbackAI();
      }
    });
    await Promise.all(aiLoadPromises);

    dispatch({
      type: actions.START_COMBAT,
      payload: {
        allies,
        enemies,
        encounterName: preset.encounterName,
        encounterType: preset.encounterType,
        terrainType: getTerrainType(),
        gameLogger: addMessage,
      },
    });

    logger.combat.info('DEV Force Combat', {
      preset: preset.label,
      allies: allies.map((a: { name: string }) => a.name),
      enemies: enemies.map(e => e.name),
    });
  };

  // ── Character ─────────────────────────────────────────────────────────────

  const handleRestoreHP = () => {
    const player = getPlayer();
    if (!player) return;
    const updated = Character.fromJSON(player.toJSON());
    updated.currentHP = updated.maxHP;
    dispatch({ type: actions.UPDATE_CHARACTER, payload: updated });
    addMessage(`[DEV] HP restored to ${updated.maxHP}/${updated.maxHP}`, 'success');
    logger.general.info('DEV Restore HP', { hp: updated.maxHP });
  };

  const handleAddXP = (amount: number) => {
    dispatch({ type: actions.AWARD_XP, payload: { xp: amount } });
    addMessage(`[DEV] +${amount} XP awarded`, 'success');
    logger.general.info('DEV Add XP', { amount });
  };

  const handleForceLevelUp = () => {
    const player = getPlayer();
    if (!player) return;
    const updated = Character.fromJSON(player.toJSON());
    // Award enough XP to guarantee a level-up
    const xpNeeded = Math.max(0, updated.xpToNextLevel - updated.xp) + 1;
    updated.awardXP(xpNeeded);
    if (updated.shouldLevelUp()) updated.levelUp();
    dispatch({ type: actions.UPDATE_CHARACTER, payload: updated });
    addMessage(`[DEV] Forced level up to ${updated.level}`, 'success');
    logger.general.info('DEV Force Level Up', { level: updated.level });
  };

  const handleAddGold = (amount: number) => {
    const player = getPlayer();
    if (!player) return;
    const updated = Character.fromJSON(player.toJSON());
    updated.gold = (updated.gold || 0) + amount;
    dispatch({ type: actions.UPDATE_CHARACTER, payload: updated });
    addMessage(`[DEV] +${amount}g added (total: ${updated.gold}g)`, 'success');
    logger.general.info('DEV Add Gold', { amount, total: updated.gold });
  };

  // ── Time ──────────────────────────────────────────────────────────────────

  const handleAdvanceTime = (minutes: number) => {
    dispatch({ type: actions.ADVANCE_TIME, payload: minutes });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const label = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
    addMessage(`[DEV] Time advanced +${label}`, 'system');
    logger.general.info('DEV Advance Time', { minutes });
  };

  // ── Map ───────────────────────────────────────────────────────────────────

  const handleRevealAll = () => {
    if (!state.mapData) {
      addMessage('[DEV] No map data yet', 'error');
      return;
    }
    // Dispatch REVEAL_AROUND_PLAYER for every hex in a grid scan
    // Use SET_MAP_DATA with all hexes marked as explored via ADD_EXPLORED_HEX
    state.mapData.forEach(hex => {
      dispatch({ type: actions.ADD_EXPLORED_HEX, payload: `${hex.col},${hex.row}` });
    });
    addMessage(`[DEV] Revealed ${state.mapData.length} hexes`, 'system');
    logger.general.info('DEV Reveal All', { hexCount: state.mapData.length });
  };

  const handleForceWeather = (opt: DevOption) => {
    if (!state.mapData) {
      addMessage('[DEV] No map data yet', 'error');
      return;
    }
    const weatherType = opt.key != null ? WEATHER_TYPES[opt.key] : undefined;
    if (!weatherType) return;

    // Patch weather on every hex in mapData
    const updatedHexes = state.mapData.map(hex => ({
      ...hex,
      weather: { condition: weatherType.name, ...weatherType.effects },
    }));

    dispatch({
      type: actions.SET_MAP_DATA,
      payload: {
        hexes: updatedHexes,
        regions: state.regions || [],
        hexToRegion: state.hexToRegion || null,
        weatherSystem: state.weatherSystem || null,
      },
    });

    addMessage(`[DEV] Weather forced: ${weatherType.name}`, 'system');
    logger.general.info('DEV Force Weather', { weather: weatherType.name });
  };

  const handleTeleport = (col: number, row: number) => {
    dispatch({ type: actions.SET_PLAYER_POSITION, payload: { col, row } });
    dispatch({ type: actions.REVEAL_AROUND_PLAYER, payload: { col, row } });
    addMessage(`[DEV] Teleported to (${col}, ${row})`, 'system');
    logger.general.info('DEV Teleport', { col, row });
  };

  const handleSpawnPOI = (opt: DevOption) => {
    if (!state.mapData || !terrainGeneratorRef?.current) {
      addMessage('[DEV] Map or terrain generator not ready', 'error');
      return;
    }
    const { col, row } = state.playerPosition;
    const currentHex = state.mapData.find(h => h.col === col && h.row === row);
    if (!currentHex) {
      addMessage('[DEV] Current hex not found', 'error');
      return;
    }

    const gen = terrainGeneratorRef.current;
    const terrain = (currentHex.terrain || { name: 'grassland', difficulty: 1 }) as unknown as Parameters<
      typeof gen.poiSystem.generatePOI
    >[3];
    const poi = gen.poiSystem.generatePOI(
      opt.type ?? '',
      col,
      row,
      terrain,
      10,
      7,
      () => gen.random()
    );

    if (!poi) {
      addMessage(`[DEV] Failed to generate ${opt.label}`, 'error');
      return;
    }

    const updatedHexes = state.mapData.map(h =>
      h.col === col && h.row === row ? { ...h, poi } : h
    );

    dispatch({
      type: actions.SET_MAP_DATA,
      payload: {
        hexes: updatedHexes,
        regions: state.regions || [],
        hexToRegion: state.hexToRegion || null,
        weatherSystem: state.weatherSystem || null,
      },
    });

    dispatch({ type: actions.DISCOVER_POI, payload: { col, row } });

    addMessage(`[DEV] Spawned ${poi.name || opt.label} at (${col}, ${row})`, 'discovery');
    logger.general.info('DEV Spawn POI', { type: opt.type, col, row, name: poi.name });
  };

  // ── Debug ─────────────────────────────────────────────────────────────────

  const handleDumpState = () => {
    logger.state.groupCollapsed('Full Game State Dump', () => {
      logger.state.debug('Player Character', state.playerCharacter);
      logger.state.debug('Party', state.party);
      logger.state.debug('Position', state.playerPosition);
      logger.state.debug('Game Time', state.gameTime);
      logger.state.debug('Combat State', state.combatState);
      logger.state.debug('Active Quests', state.activeQuests);
      logger.state.debug('Explored Hexes', state.exploredHexes?.size);
      logger.state.debug('Regions', state.regions);
      logger.state.debug('Weather System', state.weatherSystem);
    });
    addMessage('[DEV] State dumped to console (open DevTools)', 'system');
  };

  const handleWipeSaves = () => {
    Object.values(SaveManager.SAVE_SLOTS).forEach(slot => {
      try {
        localStorage.removeItem(slot);
      } catch {
        // ignore
      }
    });
    localStorage.removeItem(SaveManager.ACTIVE_SLOT_KEY);
    localStorage.removeItem(SaveManager.LAST_QUICKSAVE_KEY);
    addMessage('[DEV] All save slots wiped', 'system');
    logger.storage.warn('DEV Wipe Saves: all slots cleared');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.85rem',
          backgroundColor: open ? 'rgba(255, 69, 0, 0.8)' : 'rgba(255, 69, 0, 0.5)',
          color: '#fff',
          border: '1px solid rgba(255, 69, 0, 0.8)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '600',
          transition: 'background-color 0.2s',
          fontFamily: 'inherit',
        }}
      >
        DEV
      </button>

      {open && (
        <div onClick={e => e.stopPropagation()} style={DROPDOWN_STYLE}>
          {/* ── COMBAT ── */}
          <DevSection title="Combat" />
          <DevSelectRow
            icon="⚔️"
            label="Force Combat..."
            options={ENEMY_PRESETS.map((p, i) => ({ ...p, key: i }))}
            onSelect={opt => {
              handleForceCombat(opt);
              setOpen(false);
            }}
          />

          {/* ── CHARACTER ── */}
          <DevSection title="Character" />
          <DevButton icon="💊" label="Restore Full HP" onClick={closeAfter(handleRestoreHP)} />
          <DevButton icon="✨" label="+500 XP" onClick={closeAfter(() => handleAddXP(500))} />
          <DevButton icon="✨" label="+2000 XP" onClick={closeAfter(() => handleAddXP(2000))} />
          <DevButton icon="⬆️" label="Force Level Up" onClick={closeAfter(handleForceLevelUp)} />
          <DevButton icon="💰" label="+100 Gold" onClick={closeAfter(() => handleAddGold(100))} />
          <DevButton icon="💰" label="+1000 Gold" onClick={closeAfter(() => handleAddGold(1000))} />

          {/* ── TIME ── */}
          <DevSection title="Time" />
          <DevButton icon="⏰" label="+1 Hour" onClick={closeAfter(() => handleAdvanceTime(60))} />
          <DevButton
            icon="⏰"
            label="+8 Hours (Long Rest)"
            onClick={closeAfter(() => handleAdvanceTime(480))}
          />
          <DevButton icon="⏰" label="+1 Day" onClick={closeAfter(() => handleAdvanceTime(1440))} />

          {/* ── MAP ── */}
          <DevSection title="Map" />
          <DevButton icon="🗺️" label="Reveal All Map" onClick={closeAfter(handleRevealAll)} />
          <DevSelectRow
            icon="☀️"
            label="Force Weather..."
            options={WEATHER_OPTIONS}
            onSelect={opt => {
              handleForceWeather(opt);
              setOpen(false);
            }}
          />
          <DevSelectRow
            icon="🎲"
            label="Spawn POI Here..."
            options={POI_OPTIONS}
            onSelect={opt => {
              handleSpawnPOI(opt);
              setOpen(false);
            }}
          />
          <TeleportRow
            onTeleport={(c, r) => {
              handleTeleport(c, r);
              setOpen(false);
            }}
          />

          {/* ── DEBUG ── */}
          <DevSection title="Debug" />
          <DevButton
            icon="📋"
            label="Dump State to Console"
            onClick={closeAfter(handleDumpState)}
          />
          <DevButton
            icon="💾"
            label="Wipe All Saves"
            onClick={closeAfter(handleWipeSaves)}
            danger
          />
        </div>
      )}
    </div>
  );
}

export default DevTools;
