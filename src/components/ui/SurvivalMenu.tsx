// @ts-nocheck
import { useState, useRef, useMemo } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { DiceRoller } from '../../game/DiceRoller';
import { Character } from '../../game/Character';
import SurvivalManager from '../../game/SurvivalManager';
import { TIME_COSTS } from '../../game/TimeManager';

function SurvivalMenu({ onClose }) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const [isForaging, setIsForaging] = useState(false);

  const character = state.playerCharacter;
  if (!character) return null;

  // Get current hex terrain (memoized, using HexGrid for O(1) lookup)
  const currentHex = useMemo(() => {
    return state.hexGrid
      ? state.hexGrid.get(state.playerPosition.col, state.playerPosition.row)
      : state.mapData?.find(
          hex => hex.col === state.playerPosition.col && hex.row === state.playerPosition.row
        );
  }, [state.hexGrid, state.mapData, state.playerPosition.col, state.playerPosition.row]);

  const terrainKey = currentHex?.terrain?.key || 'grassland';
  const terrainName = currentHex?.terrain?.name || 'Grassland';

  // Get adjacent hexes (uses HexGrid spatial index for O(1) lookup if available)
  const getAdjacentHexes = (col, row) => {
    if (state.hexGrid) {
      return state.hexGrid.getNeighbors(col, row);
    }

    // Fallback to manual lookup
    const isEvenRow = row % 2 === 0;
    const offsets = isEvenRow
      ? [
          { dc: -1, dr: 0 },
          { dc: 1, dr: 0 },
          { dc: -1, dr: -1 },
          { dc: 0, dr: -1 },
          { dc: -1, dr: 1 },
          { dc: 0, dr: 1 },
        ]
      : [
          { dc: -1, dr: 0 },
          { dc: 1, dr: 0 },
          { dc: 0, dr: -1 },
          { dc: 1, dr: -1 },
          { dc: 0, dr: 1 },
          { dc: 1, dr: 1 },
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

  // Create dice roller with logger (no seed - we want random rolls for gameplay)
  const diceRoller = new DiceRoller(null, addMessage);

  const handleForage = () => {
    if (!currentHex) return;

    // Get all hexes (current + adjacent)
    const adjacentHexes = getAdjacentHexes(state.playerPosition.col, state.playerPosition.row);
    const allHexes = [currentHex, ...adjacentHexes];

    // Check cooldowns
    const currentDay = state.gameTime.day;
    const FORAGE_COOLDOWN = 3;

    if (!character.foragedHexes) {
      character.foragedHexes = {};
    }

    const hexesOnCooldown = allHexes.filter(hex => {
      const hexKey = `${hex.col},${hex.row}`;
      const lastForaged = character.foragedHexes[hexKey];
      return lastForaged && currentDay - lastForaged < FORAGE_COOLDOWN;
    });

    if (hexesOnCooldown.length === allHexes.length) {
      const daysRemaining =
        FORAGE_COOLDOWN -
        (currentDay - character.foragedHexes[`${currentHex.col},${currentHex.row}`]);
      addMessage(
        `All hexes in this area have been foraged recently. Wait ${daysRemaining} more day(s).`,
        'warning'
      );
      return;
    }

    setIsForaging(true);

    // Create a proper copy of the character
    const updatedCharacter = Character.fromJSON(state.playerCharacter.toJSON());

    // Perform forage check
    const result = SurvivalManager.forage(updatedCharacter, allHexes, diceRoller, currentDay);

    // Mark all hexes as foraged
    result.hexesForaged.forEach(hexKey => {
      updatedCharacter.foragedHexes[hexKey] = currentDay;
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

    setIsForaging(false);
  };

  // Get exhaustion info
  const exhaustionEffects = SurvivalManager.getExhaustionEffects(character.exhaustionLevel);

  // Determine foraging difficulty (biome-specific)
  const forageDCs = {
    grassland: 10,
    forest: 10,
    hills: 12,
    mountains: 15,
    desert: 20,
    swamp: 12,
    tundra: 15,
    water: 20,
    river: 12,
  };

  const getDifficultyLabel = dc => {
    if (dc <= 10) return 'Easy';
    if (dc <= 12) return 'Moderate';
    if (dc <= 15) return 'Hard';
    if (dc <= 18) return 'Very Hard';
    return 'Nearly Impossible';
  };

  // Check cooldown status
  const currentDay = state.gameTime.day;
  const FORAGE_COOLDOWN = 3;

  if (!currentHex) return null;

  const adjacentHexes = getAdjacentHexes(state.playerPosition.col, state.playerPosition.row);
  const allHexes = [currentHex, ...adjacentHexes];

  const hexesOnCooldown = allHexes.filter(hex => {
    const hexKey = `${hex.col},${hex.row}`;
    const lastForaged = character.foragedHexes?.[hexKey];
    return lastForaged && currentDay - lastForaged < FORAGE_COOLDOWN;
  });

  const isAreaFullyForaged = hexesOnCooldown.length === allHexes.length;
  const hasPartialCooldown = hexesOnCooldown.length > 0;

  let cooldownMessage = '';
  if (isAreaFullyForaged && currentHex) {
    const hexKey = `${currentHex.col},${currentHex.row}`;
    const daysRemaining = FORAGE_COOLDOWN - (currentDay - (character.foragedHexes?.[hexKey] || 0));
    cooldownMessage = `Area on cooldown (${daysRemaining} days remaining)`;
  } else if (hasPartialCooldown) {
    cooldownMessage = `${hexesOnCooldown.length} of ${allHexes.length} hexes recently foraged`;
  }

  // Calculate average DC for display
  const validHexes = allHexes.filter(hex => hex?.terrain?.key && hex.terrain.key !== 'water');
  let averageDC = 15;
  let goodHexCount = 0;

  if (validHexes.length > 0) {
    let totalDC = 0;
    validHexes.forEach(hex => {
      const hexDC = forageDCs[hex.terrain.key] || 15;
      totalDC += hexDC;
      if (hexDC <= 10) goodHexCount++;
    });
    averageDC = Math.ceil(totalDC / validHexes.length);
  }

  return (
    <div
      className="survival-menu"
      style={{
        padding: '1rem',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '0.5rem',
        maxWidth: '400px',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Survival</h3>

      {/* Current Status */}
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.25rem',
        }}
      >
        <p style={{ margin: '0.25rem 0' }}>
          Rations:{' '}
          <span style={{ color: character.rations <= 2 ? '#e74c3c' : 'inherit' }}>
            {character.rations} days
          </span>
        </p>
        {character.exhaustionLevel > 0 && (
          <p style={{ margin: '0.25rem 0', color: '#e74c3c', fontWeight: 'bold' }}>
            Exhaustion: Level {character.exhaustionLevel}
          </p>
        )}
        <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Terrain: {terrainName}
        </p>
      </div>

      {/* Exhaustion Warning */}
      {character.exhaustionLevel > 0 && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            border: '1px solid #e74c3c',
            borderRadius: '0.25rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#e74c3c' }}>
            <strong>⚠ {exhaustionEffects.description}</strong>
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Rest with food and water to reduce exhaustion.
          </p>
        </div>
      )}

      {/* Forage for Food */}
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          border: '1px solid var(--border-color)',
          borderRadius: '0.25rem',
        }}
      >
        <h4 style={{ marginTop: 0 }}>Forage for Food (4 hours)</h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Thoroughly search current hex + 6 adjacent hexes for food.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Area DC: {averageDC} -{' '}
          <span style={{ fontWeight: 'bold' }}>{getDifficultyLabel(averageDC)}</span>
          <br />
          Success: 1d4 + {goodHexCount} rations ({goodHexCount} rich hexes)
          <br />
          Failure: 0 rations
          <br />
          Cooldown: 3 days per hex
        </p>
        {cooldownMessage && (
          <p
            style={{
              fontSize: '0.85rem',
              color: isAreaFullyForaged ? '#e74c3c' : '#f39c12',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}
          >
            {cooldownMessage}
          </p>
        )}

        <button
          onClick={handleForage}
          disabled={isForaging || isAreaFullyForaged}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor:
              isForaging || isAreaFullyForaged ? 'var(--bg-tertiary)' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: isForaging || isAreaFullyForaged ? 'not-allowed' : 'pointer',
            opacity: isAreaFullyForaged ? 0.6 : 1,
          }}
        >
          {isForaging ? 'Foraging...' : isAreaFullyForaged ? 'Area on Cooldown' : 'Forage for Food'}
        </button>
      </div>

      {/* Survival Tips */}
      <div
        style={{
          padding: '0.75rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.25rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: 'var(--text-color)' }}>
          Survival Tips:
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>Each hex travelled consumes 1 ration and takes 1 day</li>
          <li>Foraging searches 7 hexes (current + adjacent) and takes 4 hours</li>
          <li>Foraged hexes have a 3-day cooldown before they can be foraged again</li>
          <li>DC is averaged across all hexes, rich terrain (DC ≤10) grants bonus rations</li>
          <li>Going 3+ days without food causes exhaustion</li>
          <li>Long rests with food reduce exhaustion by 1 level</li>
        </ul>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginTop: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      )}
    </div>
  );
}

export default SurvivalMenu;
