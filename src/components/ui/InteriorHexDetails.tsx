/**
 * InteriorHexDetails - Shows details for interior hexes and interaction buttons
 */

import { getHexDistance } from '../../utils/hexMath';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { TIME_COSTS } from '../../game/TimeManager';
import './InteriorHexDetails.css';

interface HexLike {
  col: number;
  row: number;
  terrain: { name?: string; walkable?: boolean };
  content?: string | null;
}

interface LootItem {
  name: string;
  rarity: string;
  getRarityColor?: () => string;
}

interface InteriorEncounter {
  col: number;
  row: number;
  cr?: number;
  creatures?: string;
  defeated?: boolean;
  discovered?: boolean;
}

interface InteriorLoot {
  col: number;
  row: number;
  gold: number;
  items: LootItem[];
  consumables?: string[];
  rarity: string;
  type?: string;
  collected?: boolean;
  discovered?: boolean;
}

interface InteriorHazard {
  col: number;
  row: number;
  type: string;
  category: string;
  description: string;
  dc: number;
  saveType: string;
  damage: number;
  damageType: string;
  triggered?: boolean;
  discovered?: boolean;
}

interface InteriorMapLike {
  encounters?: InteriorEncounter[];
  loot?: InteriorLoot[];
  hazards?: InteriorHazard[];
}

interface InteriorHexDetailsProps {
  hex: HexLike | null;
  playerPosition?: { col: number; row: number } | null;
  interiorMap?: InteriorMapLike | null;
  poiKey: string;
  onMoveToHex?: (hex: HexLike) => void;
}

function InteriorHexDetails({
  hex,
  playerPosition,
  interiorMap,
  poiKey,
}: InteriorHexDetailsProps) {
  const { actions, dispatch } = useGameState();
  const { addMessage } = useGameLog();

  if (!hex) {
    return (
      <div className="interior-hex-details">
        <div className="no-selection">
          <p>Click a hex to view details</p>
        </div>
      </div>
    );
  }

  // Calculate distance from player
  const distance = playerPosition
    ? getHexDistance(hex.col, hex.row, playerPosition.col, playerPosition.row)
    : null;

  // Find content data (only show discovered content)
  const encounter = interiorMap?.encounters?.find(
    e => e.col === hex.col && e.row === hex.row && e.discovered
  );
  const loot = interiorMap?.loot?.find(l => l.col === hex.col && l.row === hex.row && l.discovered);
  const hazard = interiorMap?.hazards?.find(
    h => h.col === hex.col && h.row === hex.row && h.discovered
  );

  // Handle loot collection
  const handleCollectLoot = () => {
    if (!loot || loot.collected) return;

    // Build item list from Item instances
    const itemsList =
      loot.items.length > 0
        ? `\n\nItems:\n${loot.items
            .map(item => {
              return `• ${item.name} (${item.rarity})`;
            })
            .join('\n')}`
        : '';

    const goldText = loot.gold > 0 ? `You found ${loot.gold} gold!` : 'You search the area...';

    addMessage(
      `Treasure Collected! ${goldText}${itemsList}\n\nItems added to inventory!\n\nTime elapsed: ${TIME_COSTS.SEARCH} minutes`,
      'discovery'
    );

    // Advance time for searching/looting
    dispatch({
      type: actions.ADVANCE_TIME,
      payload: TIME_COSTS.SEARCH,
    });

    // Collect loot - pass full loot object with Item instances
    dispatch({
      type: actions.COLLECT_LOOT,
      payload: {
        poiKey,
        lootKey: `${loot.col},${loot.row}`,
        loot: {
          gold: loot.gold,
          items: loot.items,
        },
      },
    });
  };

  // Render encounter info
  const renderEncounterInfo = () => {
    if (!encounter) return null;

    return (
      <div className="content-section encounter-section">
        <h4>Encounter (Defeated)</h4>
        <p>
          <strong>CR:</strong> {encounter.cr}
        </p>
        <p>
          <strong>Creatures:</strong> {encounter.creatures}
        </p>
        <p className="status-defeated">Defeated</p>
      </div>
    );
  };

  // Render loot info
  const renderLootInfo = () => {
    if (!loot) return null;

    const isChest = loot.type === 'chest';

    return (
      <div className={`content-section ${isChest ? 'chest-section' : 'loot-section'}`}>
        <h4>{isChest ? '💰 Treasure Chest' : 'Loot'}</h4>
        <p>
          <strong>Gold:</strong> {loot.gold} gp
        </p>

        {loot.consumables && loot.consumables.length > 0 && (
          <div className="loot-consumables">
            <p>
              <strong>Consumables:</strong>
            </p>
            <ul>
              {loot.consumables.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {loot.items && loot.items.length > 0 && (
          <div className="loot-items">
            <p>
              <strong>Items:</strong>
            </p>
            <ul>
              {loot.items.map((item, i) => (
                <li key={i} style={{ color: item.getRarityColor ? item.getRarityColor() : '#fff' }}>
                  {item.name} ({item.rarity})
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="rarity-badge" style={{ color: getRarityColor(loot.rarity) }}>
          {loot.rarity.toUpperCase()}
        </p>

        {loot.collected ? (
          <p className="status-collected">Collected</p>
        ) : (
          distance === 0 && (
            <button className="btn-primary" onClick={handleCollectLoot}>
              Collect
            </button>
          )
        )}
      </div>
    );
  };

  // Render hazard info
  const renderHazardInfo = () => {
    if (!hazard) return null;

    return (
      <div className="content-section hazard-section">
        <h4>Hazard</h4>
        <p>
          <strong>Type:</strong> {hazard.type}
        </p>
        <p>
          <strong>Category:</strong> {hazard.category}
        </p>
        <p>{hazard.description}</p>
        <p>
          <strong>DC {hazard.dc}</strong> {hazard.saveType} save
        </p>
        <p>
          <strong>Damage:</strong> {hazard.damage} {hazard.damageType}
        </p>
        {hazard.triggered && <p className="status-triggered">Triggered</p>}
      </div>
    );
  };

  // Get rarity color
  const getRarityColor = (rarity: string): string => {
    const colors: Record<string, string> = {
      common: '#9d9d9d',
      uncommon: '#1eff00',
      rare: '#0070dd',
      'very rare': '#a335ee',
      legendary: '#ff8000',
    };
    return colors[rarity] || colors.common;
  };

  return (
    <div className="interior-hex-details">
      <div className="hex-info">
        <h3>
          Hex ({hex.col}, {hex.row})
        </h3>
        <p>
          <strong>Terrain:</strong> {hex.terrain.name}
        </p>
        {distance !== null && (
          <p>
            <strong>Distance:</strong> {distance} {distance === 1 ? 'hex' : 'hexes'}
          </p>
        )}
        {hex.content && (
          <p>
            <strong>Content:</strong> {hex.content}
          </p>
        )}
      </div>

      {renderEncounterInfo()}
      {renderLootInfo()}
      {renderHazardInfo()}

      {!hex.content && (
        <div className="empty-hex">
          <p>Nothing of interest here.</p>
        </div>
      )}
    </div>
  );
}

export default InteriorHexDetails;
