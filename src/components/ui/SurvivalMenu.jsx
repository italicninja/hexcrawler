import { useState } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import { DiceRoller } from '../../game/DiceRoller';
import SurvivalManager from '../../game/SurvivalManager';
import { TIME_COSTS } from '../../game/TimeManager';
import { toast } from 'sonner';

function SurvivalMenu({ onClose }) {
  const { state, dispatch, actions } = useGameState();
  const [isForaging, setIsForaging] = useState(false);
  const [isFindingWater, setIsFindingWater] = useState(false);

  const character = state.playerCharacter;
  if (!character) return null;

  // Get current hex terrain
  const currentHex = state.mapData?.find(
    hex => hex.col === state.playerPosition.col && hex.row === state.playerPosition.row
  );
  const terrainKey = currentHex?.terrain?.key || 'grassland';
  const terrainName = currentHex?.terrain?.name || 'Grassland';

  // Create dice roller (use map seed for deterministic results when available, otherwise random)
  const diceRoller = new DiceRoller(state.mapSeed || null);

  const handleForage = () => {
    setIsForaging(true);

    // Create a copy of character for mutation
    const updatedCharacter = state.playerCharacter;

    // Perform forage check
    const result = SurvivalManager.forage(updatedCharacter, terrainKey, diceRoller);

    // Update character state
    dispatch({
      type: actions.UPDATE_CHARACTER,
      payload: updatedCharacter
    });

    // Advance time (foraging takes time - use SEARCH time cost)
    dispatch({
      type: actions.ADVANCE_TIME,
      payload: TIME_COSTS.SEARCH
    });

    // Show result
    if (result.success) {
      toast.success('Foraging Successful!', {
        description: result.message,
        duration: 5000
      });
    } else {
      toast.error('Foraging Failed', {
        description: result.message,
        duration: 5000
      });
    }

    setIsForaging(false);
  };

  const handleFindWater = () => {
    setIsFindingWater(true);

    // Create a copy of character for mutation
    const updatedCharacter = state.playerCharacter;

    // Perform water search
    const result = SurvivalManager.findWater(updatedCharacter, terrainKey, diceRoller);

    // Update character state
    dispatch({
      type: actions.UPDATE_CHARACTER,
      payload: updatedCharacter
    });

    // Advance time (finding water takes time - use SEARCH time cost)
    dispatch({
      type: actions.ADVANCE_TIME,
      payload: TIME_COSTS.SEARCH
    });

    // Show result
    if (result.success) {
      toast.success('Water Found!', {
        description: result.message,
        duration: 5000
      });
    } else {
      toast.error('No Water Found', {
        description: result.message,
        duration: 5000
      });
    }

    setIsFindingWater(false);
  };

  // Get exhaustion info
  const exhaustionEffects = SurvivalManager.getExhaustionEffects(character.exhaustionLevel);

  // Determine foraging/water difficulty
  const forageDCs = {
    grassland: 10,
    forest: 10,
    hills: 12,
    mountains: 15,
    desert: 20,
    swamp: 12,
    tundra: 15,
    water: 20,
    river: 12
  };

  const waterDCs = {
    river: 5,
    water: 5,
    swamp: 8,
    forest: 10,
    grassland: 12,
    hills: 15,
    mountains: 15,
    tundra: 18,
    desert: 20
  };

  const forageDC = forageDCs[terrainKey] || 15;
  const waterDC = waterDCs[terrainKey] || 15;

  const getDifficultyLabel = (dc) => {
    if (dc <= 10) return 'Easy';
    if (dc <= 12) return 'Moderate';
    if (dc <= 15) return 'Hard';
    if (dc <= 18) return 'Very Hard';
    return 'Nearly Impossible';
  };

  return (
    <div className="survival-menu" style={{
      padding: '1rem',
      backgroundColor: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: '0.5rem',
      maxWidth: '400px'
    }}>
      <h3 style={{ marginTop: 0 }}>Survival</h3>

      {/* Current Status */}
      <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.25rem' }}>
        <p style={{ margin: '0.25rem 0' }}>
          Rations: <span style={{ color: character.rations <= 2 ? '#e74c3c' : 'inherit' }}>
            {character.rations} days
          </span>
        </p>
        <p style={{ margin: '0.25rem 0' }}>
          Water: <span style={{ color: character.water <= 2 ? '#e74c3c' : 'inherit' }}>
            {character.water} days
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
        <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: '0.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#e74c3c' }}>
            <strong>⚠ {exhaustionEffects.description}</strong>
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Rest with food and water to reduce exhaustion.
          </p>
        </div>
      )}

      {/* Forage for Food */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.25rem' }}>
        <h4 style={{ marginTop: 0 }}>Forage for Food (30 min)</h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Make a Survival check (Wisdom) to find food in the wilderness.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          DC {forageDC} - <span style={{ fontWeight: 'bold' }}>{getDifficultyLabel(forageDC)}</span>
          <br />
          Success: Gain 1d4 days of rations
        </p>

        <button
          onClick={handleForage}
          disabled={isForaging || isFindingWater}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: isForaging || isFindingWater ? 'var(--bg-tertiary)' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: isForaging || isFindingWater ? 'not-allowed' : 'pointer'
          }}
        >
          {isForaging ? 'Foraging...' : 'Forage for Food'}
        </button>
      </div>

      {/* Find Water */}
      <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.25rem' }}>
        <h4 style={{ marginTop: 0 }}>Find Water (30 min)</h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Make a Survival check (Wisdom) to find a water source.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          DC {waterDC} - <span style={{ fontWeight: 'bold' }}>{getDifficultyLabel(waterDC)}</span>
          <br />
          Success: Gain 1d4+1 days of water
        </p>

        <button
          onClick={handleFindWater}
          disabled={isForaging || isFindingWater}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: isForaging || isFindingWater ? 'var(--bg-tertiary)' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: isForaging || isFindingWater ? 'not-allowed' : 'pointer'
          }}
        >
          {isFindingWater ? 'Searching...' : 'Find Water'}
        </button>
      </div>

      {/* Survival Tips */}
      <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: 'var(--text-color)' }}>
          Survival Tips:
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>Food and water are consumed during long rests</li>
          <li>Going 3+ days without food causes exhaustion</li>
          <li>Going 1+ days without water causes exhaustion</li>
          <li>Desert terrain causes faster dehydration</li>
          <li>Long rests with food/water reduce exhaustion by 1 level</li>
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
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      )}
    </div>
  );
}

SurvivalMenu.propTypes = {
  onClose: PropTypes.func
};

export default SurvivalMenu;
