// @ts-nocheck
/**
 * InteriorHexDetails - Shows details for interior hexes and interaction buttons
 */

import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { DiceRoller } from '../../game/DiceRoller';
import { getCombatDuration, TIME_COSTS } from '../../game/TimeManager';
import { Combat } from '../../game/Combat';
import { Enemy } from '../../game/Enemy';
import { Character } from '../../game/Character';
import './InteriorHexDetails.css';

function InteriorHexDetails({ hex, playerPosition, interiorMap, poiKey, onMoveToHex }) {
  const { state, actions, dispatch } = useGameState();
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
  const getHexDistance = (col1, row1, col2, row2) => {
    const x1 = col1 - Math.floor(row1 / 2);
    const z1 = row1;
    const y1 = -x1 - z1;

    const x2 = col2 - Math.floor(row2 / 2);
    const z2 = row2;
    const y2 = -x2 - z2;

    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
  };

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

  // Handle encounter engagement
  const handleEngageEncounter = () => {
    if (!encounter || encounter.defeated) return;

    const combatTime = getCombatDuration();

    // TODO: Real combat system
    addMessage(
      `Combat! You engage ${encounter.creatures}!\n\n(Combat system coming soon - auto-resolving...)\n\nYou defeat the enemies!\n\nTime elapsed: ${combatTime} minutes`,
      'encounter'
    );

    // Advance time for combat
    dispatch({
      type: actions.ADVANCE_TIME,
      payload: combatTime,
    });

    // Mark encounter as defeated
    dispatch({
      type: actions.DEFEAT_ENCOUNTER,
      payload: {
        poiKey,
        encounterKey: `${encounter.col},${encounter.row}`,
      },
    });
  };

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
  const getRarityColor = rarity => {
    const colors = {
      common: '#9d9d9d',
      uncommon: '#1eff00',
      rare: '#0070dd',
      'very rare': '#a335ee',
      legendary: '#ff8000',
    };
    return colors[rarity] || colors.common;
  };

  // Handle move button click
  const handleMoveClick = () => {
    if (distance === 0) {
      addMessage('You are already on this hex', 'info');
      return;
    }
    if (!hex.terrain.walkable) {
      addMessage('Cannot move - hex is not walkable (wall or obstacle)', 'warning');
      return;
    }
    if (distance > 1) {
      addMessage(
        `Too far - hex is ${distance} away. You can only move 1 hex at a time.`,
        'warning'
      );
      return;
    }
    if (onMoveToHex) {
      onMoveToHex(hex);
    }
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
