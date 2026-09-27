import { random } from '../../utils/seededRandom';
import { useState, useMemo } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import { RestManager } from '../../game/RestManager';
import { applyStarvation } from '../../game/SurvivalManager';
import { generateRestFlavor } from '../../utils/flavorTextGenerator';
import PixelIcon from './PixelIcon';
import { isSettlement } from '../../constants/gameConstants';
import './RestMenu.css';

interface RestMenuProps {
  onClose?: () => void;
}

function RestMenu({ onClose }: RestMenuProps) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const [hitDiceToSpend, setHitDiceToSpend] = useState(1);
  const [isResting, setIsResting] = useState(false);

  // Get current hex (memoized, using HexGrid for O(1) lookup).
  // Must run before the early return below — hooks may not be conditional.
  const currentHex = useMemo(() => {
    return state.hexGrid
      ? state.hexGrid.get(state.playerPosition.col, state.playerPosition.row)
      : state.mapData?.find(
          h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
        );
  }, [state.hexGrid, state.mapData, state.playerPosition.col, state.playerPosition.row]);

  const character = state.playerCharacter;
  if (!character) return null;

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

    // Perform short rest on a clone (RestManager mutates its argument)
    const rested = character.clone();
    const result = RestManager.shortRest(rested, hitDiceToSpend);

    // Dispatch action to update character and time
    dispatch({
      type: actions.SHORT_REST,
      payload: { character: rested },
    });

    // Log rest result
    if (result.success) {
      addMessage(result.message, 'info');

      // Optional flavor (30% chance)
      if (random() < 0.3) {
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

    // RestManager / applyStarvation mutate their argument, so work on a clone
    const rested = character.clone();

    if (interrupted) {
      // Rest was interrupted - only recover partial HP
      RestManager.shortRest(rested, Math.floor(rested.hitDiceRemaining / 2));

      dispatch({
        type: actions.SHORT_REST, // Use short rest since interrupted
        payload: { character: rested },
      });

      // Log interruption
      addMessage('Your rest is interrupted by hostile creatures!', 'warning');

      // Optional interrupted flavor (30% chance)
      if (random() < 0.3) {
        const flavor = generateRestFlavor('long', true);
        if (flavor) addMessage(flavor, 'warning');
      }

      // TODO: Trigger random encounter here
      setIsResting(false);
      return;
    }

    // Perform long rest
    const result = RestManager.longRest(rested, currentGameTime);

    // Check for starvation effects after rest
    const starvationResult = applyStarvation(rested);

    // Dispatch action to update character and time
    dispatch({
      type: actions.LONG_REST,
      payload: { character: rested },
    });

    // Log rest result
    if (result.success) {
      addMessage(result.message, 'info');

      // Log starvation warning if applicable
      if (starvationResult.exhaustionGained > 0) {
        addMessage(starvationResult.message, 'warning');
      }

      // Optional peaceful flavor (30% chance)
      if (random() < 0.3) {
        const flavor = generateRestFlavor('long', false);
        if (flavor) addMessage(flavor, 'info');
      }
    }

    setIsResting(false);
  };

  const handleInnRest = () => {
    const currentGameTime = getGameTimeInHours();
    const costPerPerson = 10;

    // Perform inn rest on a clone (RestManager mutates its argument)
    const rested = character.clone();
    const result = RestManager.innRest(rested, state.party, costPerPerson, currentGameTime);

    if (!result.success) {
      // Cannot stay at inn - logged to game log
      return;
    }

    setIsResting(true);

    // Dispatch action to update character and time
    dispatch({
      type: actions.INN_REST,
      payload: { character: rested },
    });

    // Log rest result
    if (result.success) {
      addMessage(result.message, 'info');

      // Optional inn flavor (30% chance)
      if (random() < 0.3) {
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
  const isInTown = state.inInterior && isSettlement(state.currentPOI?.poi?.type);

  // Calculate inn rest cost (currentHex already defined via useMemo above)
  const costPerPerson = 10;
  const livingMembers = state.party ? state.party.getLivingMembers().length : 1;
  const totalInnCost = livingMembers * costPerPerson;
  const canAffordInn = character.gold >= totalInnCost;
  const isFullHP = character.currentHP >= character.maxHP;
  const hpPercent = character.maxHP > 0 ? (character.currentHP / character.maxHP) * 100 : 0;
  const interruptionChance = RestManager.calculateInterruptionChance(
    currentHex?.terrain?.name?.toLowerCase() || 'grassland',
    currentHex?.terrain?.difficulty || 1
  );

  // Headings and prose deliberately avoid the phrases "short rest" / "long rest": the QA
  // agent clicks the buttons via Playwright's case-insensitive `text=Short Rest` match.
  return (
    <div className="rest-menu">
      <p className="jp-prose">
        {isFullHP
          ? 'You are hale and whole. Still, the road is long, and a fire and a little sleep never hurt anyone.'
          : 'Make camp, bind your wounds, and let the fire burn low. The wilds can keep their own counsel for a while.'}
      </p>

      <ul className="jp-rows">
        <li className="jp-row">
          <span>Hit points</span>
          <span>
            {character.currentHP} / {character.maxHP}
          </span>
        </li>
      </ul>
      <div className="jp-bar rest-menu-hp">
        <span style={{ width: `${hpPercent}%` }} />
      </div>
      <ul className="jp-rows">
        <li className="jp-row">
          <span>Hit dice</span>
          <span>
            {character.hitDiceRemaining} / {maxHitDice} ({character.hitDie})
          </span>
        </li>
        <li className="jp-row">
          <span>Purse</span>
          <span>{character.gold} gp</span>
        </li>
      </ul>

      <h4 className="jp-heading">
        <PixelIcon name="clock" /> A breather &middot; one hour
      </h4>
      <p className="jp-note">Spend hit dice to recover HP. Some class abilities are recovered.</p>
      <div className="rest-menu-dice">
        <label htmlFor="hit-dice-slider">
          Hit dice to spend <b>{hitDiceToSpend}</b>
        </label>
        <input
          id="hit-dice-slider"
          type="range"
          min="0"
          max={character.hitDiceRemaining}
          value={hitDiceToSpend}
          onChange={e => setHitDiceToSpend(parseInt(e.target.value, 10))}
          disabled={!canShortRest || isResting}
        />
        <div className="rest-menu-scale" aria-hidden="true">
          <span>0</span>
          <span>{character.hitDiceRemaining}</span>
        </div>
      </div>
      <div className="jp-actions">
        <button
          type="button"
          className="jp-link jp-link--primary"
          onClick={handleShortRest}
          disabled={!canShortRest || hitDiceToSpend === 0 || isResting}
        >
          {isResting ? 'Resting...' : 'Take Short Rest'}
        </button>
      </div>

      <h4 className="jp-heading">
        <PixelIcon name="tent" /> Through the night &middot; eight hours
      </h4>
      <p className="jp-note">
        Recover all HP, half of max hit dice, and all class abilities. Can only be done once per
        24 hours.
      </p>
      <ul className="jp-rows">
        <li className="jp-row">
          <span>Chance of interruption</span>
          <span>{interruptionChance}%</span>
        </li>
      </ul>
      {!canLongRestCheck.allowed && <p className="rest-menu-warning">{canLongRestCheck.reason}</p>}
      <div className="jp-actions">
        <button
          type="button"
          className="jp-link jp-link--primary"
          onClick={handleLongRest}
          disabled={!canLongRestCheck.allowed || isResting}
        >
          {isResting ? 'Resting...' : 'Take Long Rest'}
        </button>
      </div>

      <h4 className="jp-heading">
        <PixelIcon name="coins" /> The inn
      </h4>
      {isInTown ? (
        <>
          <p className="jp-note">
            Pay for a safe night&apos;s rest at the local inn. Guaranteed safety with no
            interruptions.
          </p>
          <ul className="jp-rows">
            <li className="jp-row">
              <span>Per party member</span>
              <span>{costPerPerson} gp</span>
            </li>
            <li className="jp-row">
              <span>
                Total ({livingMembers} party member{livingMembers > 1 ? 's' : ''})
              </span>
              <span>{totalInnCost} gp</span>
            </li>
          </ul>
          <ul className="rest-menu-perks">
            <li>
              <PixelIcon name="check" /> Guaranteed safe rest (no interruption)
            </li>
            <li>
              <PixelIcon name="check" /> Recover all HP and hit dice
            </li>
            <li>
              <PixelIcon name="check" /> Includes meal and water for all party members
            </li>
            <li>
              <PixelIcon name="check" /> Recover all class abilities
            </li>
          </ul>
          {!canAffordInn && (
            <p className="rest-menu-warning">You don&apos;t have enough gold to stay at the inn.</p>
          )}
          {isFullHP && <p className="rest-menu-warning">Your party is already fully rested.</p>}
          <div className="jp-actions">
            <button
              type="button"
              className="jp-link jp-link--primary"
              onClick={handleInnRest}
              disabled={!canAffordInn || isFullHP || isResting}
            >
              {isResting ? 'Resting...' : `Stay the night: Rest (${totalInnCost}g)`}
            </button>
          </div>
        </>
      ) : (
        <p className="jp-note">Travel to a town to stay at an inn for a guaranteed safe rest.</p>
      )}

      {onClose && (
        <div className="jp-actions rest-menu-footer">
          <button type="button" className="jp-link" onClick={onClose}>
            Break camp
          </button>
        </div>
      )}
    </div>
  );
}

export default RestMenu;
