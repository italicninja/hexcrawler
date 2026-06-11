import { useState, useMemo } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { RestManager } from '../../game/RestManager';
import { applyStarvation } from '../../game/SurvivalManager';
import { generateRestFlavor } from '../../utils/flavorTextGenerator';

interface RestMenuProps {
  onClose?: () => void;
}

function RestMenu({ onClose }: RestMenuProps) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const [hitDiceToSpend, setHitDiceToSpend] = useState(1);
  const [isResting, setIsResting] = useState(false);

  const character = state.playerCharacter;
  if (!character) return null;

  // Get current hex (memoized, using HexGrid for O(1) lookup)
  const currentHex = useMemo(() => {
    return state.hexGrid
      ? state.hexGrid.get(state.playerPosition.col, state.playerPosition.row)
      : state.mapData?.find(
          h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
        );
  }, [state.hexGrid, state.mapData, state.playerPosition.col, state.playerPosition.row]);

  // Helper to convert game time to total hours since game start
  const getGameTimeInHours = () => {
    if (!state.gameTime) return 0;
    const { day, hour } = state.gameTime;
    return (day - 1) * 24 + hour;
  };

  const handleShortRest = () => {
    if (!RestManager.canShortRest(character)) {
      // Cannot short rest - no hit dice
      return;
    }

    setIsResting(true);

    // Perform short rest
    const result = RestManager.shortRest(character, hitDiceToSpend);

    // Dispatch action to update character and time
    dispatch({
      type: actions.SHORT_REST,
      payload: { character },
    });

    // Log rest result
    if (result.success) {
      addMessage(result.message, 'info');

      // Optional flavor (30% chance)
      if (Math.random() < 0.3) {
        const flavor = generateRestFlavor('short');
        if (flavor) addMessage(flavor, 'info');
      }
    }

    setIsResting(false);
  };

  const handleLongRest = () => {
    const currentGameTime = getGameTimeInHours();
    const canRest = RestManager.canLongRest(character, currentGameTime);

    if (!canRest.allowed) {
      // Cannot long rest - logged to game log
      return;
    }

    setIsResting(true);

    // Check for rest interruption (using currentHex from useMemo above)
    const terrainType = currentHex?.terrain?.name?.toLowerCase() || 'grassland';
    const terrainDifficulty = currentHex?.terrain?.difficulty || 1;

    const interrupted = RestManager.isRestInterrupted(terrainType, terrainDifficulty);

    if (interrupted) {
      // Rest was interrupted - only recover partial HP (mutates character in place)
      RestManager.shortRest(character, Math.floor(character.hitDiceRemaining / 2));

      dispatch({
        type: actions.SHORT_REST, // Use short rest since interrupted
        payload: { character },
      });

      // Log interruption
      addMessage('Your rest is interrupted by hostile creatures!', 'warning');

      // Optional interrupted flavor (30% chance)
      if (Math.random() < 0.3) {
        const flavor = generateRestFlavor('long', true);
        if (flavor) addMessage(flavor, 'warning');
      }

      // TODO: Trigger random encounter here
      setIsResting(false);
      return;
    }

    // Perform long rest
    const result = RestManager.longRest(character, currentGameTime);

    // Check for starvation effects after rest
    const starvationResult = applyStarvation(character);

    // Dispatch action to update character and time
    dispatch({
      type: actions.LONG_REST,
      payload: { character },
    });

    // Log rest result
    if (result.success) {
      addMessage(result.message, 'info');

      // Log starvation warning if applicable
      if (starvationResult.exhaustionGained > 0) {
        addMessage(starvationResult.message, 'warning');
      }

      // Optional peaceful flavor (30% chance)
      if (Math.random() < 0.3) {
        const flavor = generateRestFlavor('long', false);
        if (flavor) addMessage(flavor, 'info');
      }
    }

    setIsResting(false);
  };

  const handleInnRest = () => {
    const currentGameTime = getGameTimeInHours();
    const costPerPerson = 10;

    // Perform inn rest
    const result = RestManager.innRest(character, state.party, costPerPerson, currentGameTime);

    if (!result.success) {
      // Cannot stay at inn - logged to game log
      return;
    }

    setIsResting(true);

    // Dispatch action to update character and time
    dispatch({
      type: actions.INN_REST,
      payload: { character },
    });

    // Log rest result
    if (result.success) {
      addMessage(result.message, 'info');

      // Optional inn flavor (30% chance)
      if (Math.random() < 0.3) {
        const flavor = generateRestFlavor('inn');
        if (flavor) addMessage(flavor, 'info');
      }
    }

    setIsResting(false);
  };

  const maxHitDice = character.level;
  const canShortRest = RestManager.canShortRest(character);
  const canLongRestCheck = RestManager.canLongRest(character, getGameTimeInHours());

  // Check if player is inside a town interior (not just standing on a town hex)
  const isInTown = state.inInterior && state.currentPOI?.poi?.type === 'town';

  // Calculate inn rest cost (currentHex already defined via useMemo above)
  const costPerPerson = 10;
  const livingMembers = state.party ? state.party.getLivingMembers().length : 1;
  const totalInnCost = livingMembers * costPerPerson;
  const canAffordInn = character.gold >= totalInnCost;
  const isFullHP = character.currentHP >= character.maxHP;

  return (
    <div
      className="rest-menu"
      style={{
        padding: '1rem',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '0.5rem',
        maxWidth: '400px',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Rest</h3>

      {/* Character Status */}
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.25rem',
        }}
      >
        <p style={{ margin: '0.25rem 0' }}>
          HP: {character.currentHP} / {character.maxHP}
        </p>
        <p style={{ margin: '0.25rem 0' }}>
          Hit Dice: {character.hitDiceRemaining} / {maxHitDice} ({character.hitDie})
        </p>
        <p style={{ margin: '0.25rem 0' }}>Gold: {character.gold}</p>
      </div>

      {/* Short Rest */}
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          border: '1px solid var(--border-color)',
          borderRadius: '0.25rem',
        }}
      >
        <h4 style={{ marginTop: 0 }}>Short Rest (1 hour)</h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Spend hit dice to recover HP. Some class abilities are recovered.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="hit-dice-slider" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Hit Dice to Spend: {hitDiceToSpend}
          </label>
          <input
            id="hit-dice-slider"
            type="range"
            min="0"
            max={character.hitDiceRemaining}
            value={hitDiceToSpend}
            onChange={e => setHitDiceToSpend(parseInt(e.target.value, 10))}
            disabled={!canShortRest || isResting}
            style={{ width: '100%' }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>0</span>
            <span>{character.hitDiceRemaining}</span>
          </div>
        </div>

        <button
          onClick={handleShortRest}
          disabled={!canShortRest || hitDiceToSpend === 0 || isResting}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor:
              canShortRest && hitDiceToSpend > 0 ? 'var(--color-primary)' : 'var(--bg-tertiary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: canShortRest && hitDiceToSpend > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {isResting ? 'Resting...' : 'Take Short Rest'}
        </button>
      </div>

      {/* Long Rest */}
      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          border: '1px solid var(--border-color)',
          borderRadius: '0.25rem',
        }}
      >
        <h4 style={{ marginTop: 0 }}>Long Rest (8 hours)</h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Recover all HP, half of max hit dice, and all class abilities. Can only be done once per
          24 hours.
        </p>

        {!canLongRestCheck.allowed && (
          <p style={{ color: 'var(--color-warning)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            {canLongRestCheck.reason}
          </p>
        )}

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Warning: There is a{' '}
          {RestManager.calculateInterruptionChance(
            currentHex?.terrain?.name?.toLowerCase() || 'grassland',
            currentHex?.terrain?.difficulty || 1
          )}
          % chance of interruption.
        </p>

        <button
          onClick={handleLongRest}
          disabled={!canLongRestCheck.allowed || isResting}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: canLongRestCheck.allowed
              ? 'var(--color-success)'
              : 'var(--bg-tertiary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: canLongRestCheck.allowed ? 'pointer' : 'not-allowed',
          }}
        >
          {isResting ? 'Resting...' : 'Take Long Rest'}
        </button>
      </div>

      {/* Inn Rest (only visible in towns) */}
      {isInTown && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            border: '2px solid var(--color-primary)',
            borderRadius: '0.25rem',
            backgroundColor: 'rgba(74, 144, 226, 0.05)',
          }}
        >
          <h4 style={{ marginTop: 0 }}>Stay at Inn (8 hours)</h4>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Pay for a safe night&apos;s rest at the local inn. Guaranteed safety with no
            interruptions.
          </p>

          <div
            style={{
              marginBottom: '1rem',
              padding: '0.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '0.25rem',
            }}
          >
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
              <strong>Cost:</strong> {costPerPerson} gold per party member
            </p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
              <strong>Total:</strong> {totalInnCost} gold ({livingMembers} party member
              {livingMembers > 1 ? 's' : ''})
            </p>
          </div>

          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <p style={{ margin: '0.25rem 0' }}>✓ Guaranteed safe rest (no interruption)</p>
            <p style={{ margin: '0.25rem 0' }}>✓ Recover all HP and hit dice</p>
            <p style={{ margin: '0.25rem 0' }}>✓ Includes meal and water for all party members</p>
            <p style={{ margin: '0.25rem 0' }}>✓ Recover all class abilities</p>
          </div>

          {!canAffordInn && (
            <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              You don&apos;t have enough gold to stay at the inn.
            </p>
          )}

          {isFullHP && (
            <p
              style={{ color: 'var(--color-warning)', fontSize: '0.9rem', marginBottom: '0.5rem' }}
            >
              Your party is already fully rested.
            </p>
          )}

          <button
            onClick={handleInnRest}
            disabled={!canAffordInn || isFullHP || isResting}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor:
                canAffordInn && !isFullHP ? 'var(--color-primary)' : 'var(--bg-tertiary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: canAffordInn && !isFullHP ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
            }}
          >
            {isResting ? 'Resting...' : `Stay at Inn (${totalInnCost} gold)`}
          </button>
        </div>
      )}

      {!isInTown && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '0.25rem',
            fontSize: '0.9rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Travel to a town to stay at an inn for a guaranteed safe rest.
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '0.5rem',
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

export default RestMenu;
