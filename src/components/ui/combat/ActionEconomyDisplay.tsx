/**
 * ActionEconomyDisplay - D&D 5e action economy, written as a turn tally:
 * Action / Bonus / Object are struck through once spent; movement is a small bar.
 */
import PixelIcon from '../PixelIcon';

interface TurnStateLike {
  movementUsed?: number;
  actionUsed?: boolean;
  bonusActionUsed?: boolean;
  freeObjectUsed?: boolean;
}

interface ActionEconomyDisplayProps {
  turnState?: TurnStateLike;
  character?: { moveDistance?: number };
}

function ActionEconomyDisplay({ turnState, character }: ActionEconomyDisplayProps) {
  const movementUsed = turnState?.movementUsed || 0;
  const movementTotal = (character?.moveDistance || 6) * 5; // Convert hexes to feet
  const movementLeft = Math.max(0, movementTotal - movementUsed);

  const marks = [
    { icon: 'action', label: 'Action', used: !!turnState?.actionUsed },
    { icon: 'bonus', label: 'Bonus', used: !!turnState?.bonusActionUsed },
    { icon: 'object', label: 'Object', used: !!turnState?.freeObjectUsed },
  ];

  return (
    <div className="ap-economy" aria-label="This turn">
      <ul className="ap-marks">
        {marks.map(m => (
          <li key={m.label} className={m.used ? 'is-spent' : undefined}>
            <PixelIcon name={m.icon} />
            <span>{m.label}</span>
            <span className="sr-only">{m.used ? 'spent' : 'ready'}</span>
          </li>
        ))}
      </ul>
      <div className="ap-move">
        <PixelIcon name="move" />
        <span>
          {movementLeft} of {movementTotal} ft
        </span>
        <div
          className="jp-bar jp-bar--good"
          role="meter"
          aria-label="Movement left"
          aria-valuenow={movementLeft}
          aria-valuemin={0}
          aria-valuemax={movementTotal}
        >
          <span style={{ width: `${movementTotal ? (movementLeft / movementTotal) * 100 : 0}%` }} />
        </div>
      </div>
    </div>
  );
}

export default ActionEconomyDisplay;
