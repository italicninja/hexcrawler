import { useState } from 'react';
import PropTypes from 'prop-types';
import CombatantCard from './CombatantCard.jsx';

/**
 * TurnOrderPanel - Display initiative order in sidebar
 * Shows all combatants in initiative order with current turn highlighted
 * Mobile-friendly with collapse/expand functionality
 */
function TurnOrderPanel({ turnOrder, currentTurnIndex, round }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!turnOrder || turnOrder.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--panel-bg)',
        border: '2px solid var(--border-color)',
      }}
    >
      {/* Header with collapse toggle */}
      <div
        className="flex justify-between items-center p-3 cursor-pointer select-none"
        style={{
          backgroundColor: 'var(--bg-lighter)',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div>
          <h3 className="font-bold text-lg m-0" style={{ color: 'var(--text-color)' }}>
            Turn Order
          </h3>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Round {round}
          </div>
        </div>
        <button
          className="text-2xl font-bold px-2 py-1 rounded transition-colors"
          style={{
            color: 'var(--text-color)',
            backgroundColor: 'transparent',
          }}
          onClick={e => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          aria-label={isCollapsed ? 'Expand turn order' : 'Collapse turn order'}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {/* Combatant list */}
      {!isCollapsed && (
        <div
          className="p-3 space-y-2 overflow-y-auto"
          style={{
            maxHeight: '60vh',
          }}
        >
          {turnOrder.map((combatant, index) => (
            <CombatantCard
              key={combatant.id || index}
              combatant={combatant}
              isActive={index === currentTurnIndex}
            />
          ))}
        </div>
      )}

      {/* Collapsed state - show current combatant only */}
      {isCollapsed && currentTurnIndex >= 0 && currentTurnIndex < turnOrder.length && (
        <div className="p-3">
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Current Turn:
          </div>
          <CombatantCard combatant={turnOrder[currentTurnIndex]} isActive={true} />
        </div>
      )}
    </div>
  );
}

TurnOrderPanel.propTypes = {
  turnOrder: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string.isRequired,
      initiative: PropTypes.number.isRequired,
      currentHP: PropTypes.number.isRequired,
      maxHP: PropTypes.number.isRequired,
      armorClass: PropTypes.number,
      isAlly: PropTypes.bool,
    })
  ).isRequired,
  currentTurnIndex: PropTypes.number.isRequired,
  round: PropTypes.number.isRequired,
};

export default TurnOrderPanel;
