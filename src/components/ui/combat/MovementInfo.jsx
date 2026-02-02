import PropTypes from 'prop-types';

/**
 * MovementInfo - Display movement remaining during combat
 * Shows a visual bar and text representation of remaining movement
 */
function MovementInfo({ remaining, max }) {
  if (max <= 0) {
    return null;
  }

  const percent = (remaining / max) * 100;

  // Color-coded: green (full/high), yellow (medium), red (low)
  const getColor = pct => {
    if (pct >= 75) return { bg: 'bg-green-500', text: 'text-green-400' };
    if (pct >= 35) return { bg: 'bg-yellow-500', text: 'text-yellow-400' };
    return { bg: 'bg-red-500', text: 'text-red-400' };
  };

  const colors = getColor(percent);

  return (
    <div
      className="p-3 rounded-lg"
      style={{
        backgroundColor: 'var(--panel-bg)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-color)' }}>
          Movement
        </span>
        <span className={`text-sm font-bold ${colors.text}`}>
          {remaining} ft / {max} ft
        </span>
      </div>

      {/* Movement bar */}
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-lighter)',
        }}
      >
        <div
          className={`h-full transition-all duration-300 ${colors.bg}`}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>

      {/* Text indicator */}
      {remaining > 0 && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {remaining} ft remaining
        </div>
      )}
      {remaining === 0 && <div className="text-xs mt-1 text-red-400">No movement remaining</div>}
    </div>
  );
}

MovementInfo.propTypes = {
  remaining: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
};

export default MovementInfo;
