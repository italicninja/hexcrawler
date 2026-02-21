// @ts-nocheck
import PropTypes from 'prop-types';

/**
 * ActionEconomyDisplay - Visual tracker for D&D 5e action economy
 * Shows Action, Bonus Action, Movement, and Free Object Interaction status
 */
function ActionEconomyDisplay({ turnState, character }) {
  const movementUsed = turnState?.movementUsed || 0;
  const movementTotal = (character?.moveDistance || 6) * 5; // Convert hexes to feet

  const actionUsed = turnState?.actionUsed || false;
  const bonusActionUsed = turnState?.bonusActionUsed || false;
  const objectInteractionUsed = turnState?.freeObjectUsed || false;

  const EconomyItem = ({ icon, label, isUsed, showMovement, movementData }) => (
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
            color: movementData.used >= movementData.total ? 'var(--text-muted)' : '#2ecc71',
          }}
        >
          {movementData.used}/{movementData.total} ft
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

  EconomyItem.propTypes = {
    icon: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    isUsed: PropTypes.bool,
    showMovement: PropTypes.bool,
    movementData: PropTypes.shape({
      used: PropTypes.number,
      total: PropTypes.number,
    }),
  };

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
