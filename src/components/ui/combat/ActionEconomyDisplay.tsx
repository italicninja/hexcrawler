/**
 * ActionEconomyDisplay - Visual tracker for D&D 5e action economy
 * Shows Action, Bonus Action, Movement, and Free Object Interaction status
 */
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

interface EconomyItemProps {
  icon: string;
  label: string;
  isUsed?: boolean;
  showMovement?: boolean;
  movementData?: { used: number; total: number };
}

function ActionEconomyDisplay({ turnState, character }: ActionEconomyDisplayProps) {
  const movementUsed = turnState?.movementUsed || 0;
  const movementTotal = (character?.moveDistance || 6) * 5; // Convert hexes to feet

  const actionUsed = turnState?.actionUsed || false;
  const bonusActionUsed = turnState?.bonusActionUsed || false;
  const objectInteractionUsed = turnState?.freeObjectUsed || false;

  const EconomyItem = ({ icon, label, isUsed, showMovement, movementData }: EconomyItemProps) => (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{
        backgroundColor: 'var(--bg-lighter)',
        border: '1px solid var(--border-color)',
      }}
    >
      <span className="text-xl" role="img" aria-label={label}>
        {icon}
      </span>
      <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {showMovement ? (
        <span
          className="text-sm font-bold"
          style={{
            color:
              (movementData?.used ?? 0) >= (movementData?.total ?? 0)
                ? 'var(--text-muted)'
                : '#2ecc71',
          }}
        >
          {movementData?.used ?? 0}/{movementData?.total ?? 0} ft
        </span>
      ) : (
        <span
          className="text-lg font-bold"
          style={{
            color: isUsed ? 'var(--text-muted)' : '#2ecc71',
          }}
        >
          {isUsed ? '✓' : '○'}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2 p-3"
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderBottom: '2px solid var(--border-color)',
      }}
    >
      <EconomyItem icon="⚔️" label="Action" isUsed={actionUsed} />
      <EconomyItem icon="✨" label="Bonus Action" isUsed={bonusActionUsed} />
      <EconomyItem
        icon="🚶"
        label="Movement"
        showMovement={true}
        movementData={{ used: movementUsed, total: movementTotal }}
      />
      <EconomyItem icon="🔧" label="Object" isUsed={objectInteractionUsed} />
    </div>
  );
}

export default ActionEconomyDisplay;
