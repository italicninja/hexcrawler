import { useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * TargetSelector - Overlay component for target selection
 * Shows valid targets and allows player to select one
 * For Phase 1, targeting is handled by canvas clicks
 * This component provides visual feedback and instructions
 */
function TargetSelector({ validTargets, onTargetSelect, onCancel, actionType }) {
  // Handle ESC key to cancel
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  /**
   * Get instruction text based on action type
   */
  const getInstructionText = () => {
    switch (actionType) {
      case 'attack':
        return 'Click on a valid target to attack';
      case 'spell':
        return 'Click on a valid target to cast spell';
      case 'ability':
        return 'Click on a valid target for ability';
      default:
        return 'Click on a valid target';
    }
  };

  /**
   * Get action color based on type
   */
  const getActionColor = () => {
    switch (actionType) {
      case 'attack':
        return '#e74c3c';
      case 'spell':
        return '#f39c12';
      case 'ability':
        return '#9b59b6';
      default:
        return 'var(--primary-color)';
    }
  };

  const actionColor = getActionColor();

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Instruction Banner */}
      <div
        className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-auto"
        style={{
          maxWidth: '90%'
        }}
      >
        <div
          className="px-6 py-4 rounded-lg shadow-lg"
          style={{
            backgroundColor: 'var(--panel-bg)',
            border: `3px solid ${actionColor}`,
            boxShadow: `0 0 20px ${actionColor}40`
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-bold mb-1" style={{ color: actionColor }}>
                {actionType?.toUpperCase() || 'TARGET SELECTION'}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-light)' }}>
                {getInstructionText()}
              </div>
              {validTargets && validTargets.length > 0 && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {validTargets.length} valid target{validTargets.length !== 1 ? 's' : ''} available
                </div>
              )}
            </div>
            <button
              className="px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105"
              style={{
                backgroundColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
              onClick={onCancel}
            >
              Cancel (ESC)
            </button>
          </div>
        </div>
      </div>

      {/* Target List (optional info panel) */}
      {validTargets && validTargets.length > 0 && (
        <div
          className="absolute right-4 top-20 pointer-events-auto max-h-[70vh] overflow-y-auto"
          style={{
            maxWidth: '300px'
          }}
        >
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'var(--panel-bg)',
              border: '2px solid var(--border-color)'
            }}
          >
            <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-color)' }}>
              Valid Targets
            </h3>
            <div className="space-y-2">
              {validTargets.map((target, index) => (
                <button
                  key={target.id || index}
                  className="w-full text-left p-2 rounded transition-all hover:scale-102"
                  style={{
                    backgroundColor: 'var(--bg-lighter)',
                    border: '1px solid var(--border-color)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = actionColor;
                    e.currentTarget.style.backgroundColor = `${actionColor}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-lighter)';
                  }}
                  onClick={() => onTargetSelect(target)}
                >
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-color)' }}>
                    {target.name}
                  </div>
                  <div className="text-xs flex gap-2 mt-1" style={{ color: 'var(--text-muted)' }}>
                    <span>HP: {target.currentHP}/{target.maxHP}</span>
                    <span>AC: {target.armorClass || target.ac || 10}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No valid targets message */}
      {(!validTargets || validTargets.length === 0) && (
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
        >
          <div
            className="px-6 py-4 rounded-lg shadow-lg text-center"
            style={{
              backgroundColor: 'var(--panel-bg)',
              border: '2px solid var(--border-color)'
            }}
          >
            <div className="text-lg font-bold mb-2" style={{ color: 'var(--text-color)' }}>
              No Valid Targets
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-light)' }}>
              There are no valid targets for this action.
            </p>
            <button
              className="px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105"
              style={{
                backgroundColor: 'var(--primary-color)',
                color: 'white'
              }}
              onClick={onCancel}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

TargetSelector.propTypes = {
  validTargets: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string.isRequired,
      currentHP: PropTypes.number.isRequired,
      maxHP: PropTypes.number.isRequired,
      armorClass: PropTypes.number,
      ac: PropTypes.number
    })
  ),
  onTargetSelect: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  actionType: PropTypes.string
};

export default TargetSelector;
